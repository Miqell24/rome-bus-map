// ALL-CAPS Italian stop names → normal mixed case.
//
// Atac shouts 8 130 of its 8 299 stop names ("STAZIONE PONTE MAMMOLO",
// "NERVI/PALAZZO SPORT") while the street names on the map come from OSM in
// proper case (Via Nomentana, Piazzale Flaminio), and the two sit next to each
// other. Lowercasing is not a `toLowerCase()` away: the caps names drop their
// accents or write them as a trailing apostrophe (CITTA', UNIVERSITA'), so the
// feed does not contain the information — but OSM does, properly written, in
// the very extract the build already reads. So we harvest a dictionary of
// accented word forms out of it and rewrite the caps names word by word
// through it (the Athens greek.mjs recipe, retold in Italian). Whatever the
// dictionary does not know falls back to plain title case, which is at worst
// an unaccented but readable Italian word.

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const UPPER = /[A-ZÀ-ÖØ-Þ]/;
const LOWER = /[a-zà-öø-ÿ]/;
const WORD = /[A-Za-zÀ-ÖØ-Þà-öø-ÿ]+/g;

// A dictionary of accented word forms, harvested from every name in the OSM
// extracts. Words that appear in several spellings keep the commonest one.
export function buildNameDict(osmDocs) {
  const seen = new Map(); // folded word → Map(spelling → count)
  for (const doc of osmDocs) {
    for (const e of doc.elements || []) {
      const name = e.tags && e.tags.name;
      if (!name || !LOWER.test(name)) continue; // caps names teach us nothing
      for (const w of name.match(WORD) || []) {
        if (w.length < 3) continue;
        const k = norm(w);
        let m = seen.get(k);
        if (!m) seen.set(k, (m = new Map()));
        m.set(w, (m.get(w) || 0) + 1);
      }
    }
  }
  const dict = new Map();
  for (const [k, m] of seen) {
    let best = null, bestN = -1;
    for (const [w, n] of m) if (n > bestN) { best = w; bestN = n; }
    dict.set(k, best);
  }
  return dict;
}

// Prepositions (simple and articulated) go lowercase anywhere but the front of
// the name. The bare articles are the trap — "PIAZZA DELLA REPUBBLICA" wants
// "della", but "LA STORTA" wants "La Storta" — so IL/LO/LA/I/GLI/LE drop their
// capital ONLY right after a preposition, which is how Italian writes its own
// street signs.
const PREPS = new Set(['DI', 'DE', 'DEL', 'DELLO', 'DELLA', 'DEI', 'DEGLI', 'DELLE',
  'DA', 'DAL', 'DALLO', 'DALLA', 'DAI', 'DAGLI', 'DALLE', 'A', 'AD', 'AL', 'ALLO',
  'ALLA', 'AI', 'AGLI', 'ALLE', 'IN', 'NEL', 'NELLO', 'NELLA', 'NEI', 'NEGLI',
  'NELLE', 'CON', 'SU', 'SUL', 'SULLO', 'SULLA', 'SUI', 'SUGLI', 'SULLE',
  'PER', 'TRA', 'FRA', 'E', 'ED']);
const ARTICLES = new Set(['IL', 'LO', 'LA', 'I', 'GLI', 'LE']);

const titleWord = (w) => w.charAt(0) + w.slice(1).toLowerCase();
const capWord = (w) => w.charAt(0).toUpperCase() + w.slice(1);

// The abbreviations Atac shouts on nearly a hundred poles. Italian writes them
// with a lowercase tail (P.za, V.le, L.go), which no general rule can guess —
// the dotted-initialism guard below would keep them shouting instead.
const ABBREV = new Map([
  ['P.ZA', 'P.za'], ['P.LE', 'P.le'], ['V.LE', 'V.le'], ['L.GO', 'L.go'],
  ['P.TA', 'P.ta'], ['V.LO', 'V.lo'], ['C.SO', 'C.so'], ['V.CO', 'V.co'],
  ['B.GO', 'B.go'], ['L.RGO', 'L.rgo'],
]);

// Rewrite one name, WORD BY WORD: a word that already carries a lowercase
// letter is left exactly as it is — that covers the names this feed already
// writes properly.
export function latinTitleCase(name, dict, acronyms) {
  if (!name || !UPPER.test(name) || LOWER.test(name)) return name;
  name = name.normalize('NFC');
  const toks = name.split(/(\s+)/);
  const words = toks.filter((t) => t && !/^\s+$/.test(t));
  let wi = -1, prevWord = '';
  return toks.map((tok) => {
    if (!tok || /^\s+$/.test(tok)) return tok;
    wi++;
    const prev = prevWord;
    prevWord = norm(tok).replace(/[^A-Z]/g, '') || prevWord;
    if (!UPPER.test(tok)) return tok; // digits, punctuation
    if (ABBREV.has(tok.toUpperCase())) return ABBREV.get(tok.toUpperCase());
    // a dotted initialism (S.P., F.S., G.R.A.) — every piece is an initial
    const pieces = tok.split('.').filter(Boolean);
    if (pieces.length > 1 && pieces.every((p) => p.replace(/[^A-ZÀ-ÖØ-Þ]/g, '').length <= 3)) return tok;
    const first = wi === 0;
    return tok.replace(WORD, (w, off) => {
      if (acronyms && acronyms.has(w)) return w;
      const k = norm(w);
      // Prepositions and articles are judged BEFORE the numerals: DI, CI, LI,
      // MI and DC are all valid Roman numerals on paper, and the numeral test
      // was leaving "Val DI Lanzo" and "Madonna DI Loreto" shouting.
      if (!first && PREPS.has(k)) return w.toLowerCase();
      if (!first && ARTICLES.has(k) && PREPS.has(prev)) return w.toLowerCase();
      // Roman numerals are everywhere in Roman street names — XX Settembre,
      // XXI Aprile, Via IV Novembre — and must survive untouched. Only I, V
      // and X are accepted, for the reason just above.
      if (/^[IVX]+$/.test(w) && w.length >= 2) return w;
      const known = dict && dict.get(k);
      // the dictionary hands back the case Italian actually uses ("della"),
      // which is right inside a name and wrong at the front of one
      let out = known ? titleWord(known) : titleWord(w);
      if (first) out = capWord(out);
      // CITTA' / UNIVERSITA' — the caps feed writes the accent as a trailing
      // apostrophe. If the dictionary knew the word it already came back
      // accented, so the apostrophe is now a duplicate: drop it.
      if (known && /[À-ÖØ-Þà-öø-ÿ]$/.test(out) && tok[off + w.length] === "'") return out;
      return out;
    });
  }).join('').replace(/([à-ù])'(?=\s|$)/g, '$1');
}
