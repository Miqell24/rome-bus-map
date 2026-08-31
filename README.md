# Rome Public Transport — interactive map

Interactive, poster-grade map of the public transport network of **Rome**:
Atac's 327 lines across the comune, 100 more run by the operators of the near
province, and the four metro lines in their official colours — 5 244 stops,
9 349 km.

## Live

Local build on port 8169 (`npm run serve`).

Everything comes from ONE feed published by **Roma Servizi per la Mobilità**
(the AVM dataset, `romamobilita.it/sites/default/files/rome_static_gtfs.zip`),
rebuilt in place and shipped with shapes.

| mode | route_type | graph |
|---|---|---|
| buses | 3 | OSM roadways |
| metro A, B, B1, C | 1 | `railway=subway` + `light_rail` |

**NOT IN THE FEED, and so not on this map:** Rome's six tram lines (2, 3, 5, 8,
14, 19) and its three ex-concession railways (Roma–Lido, Roma–Viterbo,
Termini–Centocelle). Atac runs them all, but this bundle carries only its buses
and the metro — the feed's own gap, not a decision made here. What IS in it
under a tram-like name is "3L", the bus that stands in for tram 3 while the
track is closed.

**Stop names.** 8 130 of 8 299 shout ("STAZIONE PONTE MAMMOLO"), and the caps
lose their accents or write them as a trailing apostrophe (CITTA'). They are
rewritten by `pipeline/lib/caps.mjs` through a dictionary harvested from the
OSM extract this build already reads — the Athens recipe, retold in Italian.
Two Roman traps are handled explicitly: `DI`, `CI`, `LI` and `MI` are valid
Roman numerals on paper, so the preposition test has to run *before* the
numeral test, and P.ZA / V.LE / L.GO get an abbreviation table of their own,
because Italian writes them with a lowercase tail that no general rule can
guess.

The metro keys the feed uses are MEA/MEB/MEB1/MEC; the station signs say A, B,
B1 and C, and that is what gets printed.

## Pipeline

`npm run download` fetches the feed and cuts the OSM extract. **The OSM
data comes from Geofabrik, not Overpass** — the public mirrors were answering
504 to every request on the day this map was built, even for a single small
city box — so `pipeline/pbf-tiles.py` (needs `pip3 install --user osmium`)
clips the tiles out of `centro-latest.osm.pbf`, writing exactly the JSON shape Overpass would
have returned, node ids included.

`npm run build` map-matches every line (HMM/Viterbi on the OSM graph) and
writes GeoJSON to `data/out/`; `npm run lines` adds the line-by-line view.
`npm run serve` hosts the map at <http://localhost:8169>.

Data: Roma Servizi per la Mobilità ·
base map © OpenFreeMap / OpenMapTiles / OpenStreetMap contributors.
