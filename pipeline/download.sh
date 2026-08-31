#!/usr/bin/env bash
# Downloads input data: the Roma Servizi per la Mobilità GTFS, the OSM
# extract, MapLibre GL. Everything is cached — re-running only fetches what is
# missing.
#
# Roma Servizi per la Mobilità publishes the AVM dataset as one open GTFS,
# rebuilt in place: Atac's buses, the four provincial operators, and the metro.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/gtfs data/osm/tiles web/vendor

# pyosmium does the cutting; it is the one dependency outside Node here.
need_osmium () {
  python3 -c "import osmium" 2>/dev/null && return 0
  echo "brak pakietu osmium — zainstaluj: pip3 install --user osmium" >&2
  return 1
}

# 1) GTFS
if [ ! -f data/gtfs/routes.txt ]; then
  echo "== Roma Servizi per la Mobilità GTFS =="
  curl -fL --retry 3 --max-time 1800 -o data/rome-gtfs.zip \
    "https://romamobilita.it/sites/default/files/rome_static_gtfs.zip"
  unzip -o data/rome-gtfs.zip -d data/gtfs
fi

# 2) OSM — from the Geofabrik extract, not Overpass.
#    4 x 4 road tiles over the comune and the near province, out of the
#    Geofabrik italy/centro extract (Lazio has no file of its own).
#    pipeline/pbf-tiles.py cuts the tiles out of the .pbf and writes exactly the
#    JSON shape Overpass would have returned (ways with tags, NODE IDS and
#    geometry — buildGraph silently drops ways without el.nodes).
if [ ! -f data/osm/tiles/t16.json ] || [ ! -f data/osm/rome-rail.json ]; then
  need_osmium
  if [ ! -f data/centro-latest.osm.pbf ]; then
    echo "== Geofabrik centro-latest.osm.pbf =="
    curl -fL --retry 5 --retry-delay 5 -C - --max-time 3600 -o data/centro-latest.osm.pbf \
      "https://download.geofabrik.de/europe/italy/centro-latest.osm.pbf"
  fi
  echo "== cutting OSM tiles out of the extract =="
  python3 pipeline/pbf-tiles.py
fi

# 3) MapLibre GL (vendored, no CDN at runtime)
if [ ! -f web/vendor/maplibre-gl.js ]; then
  echo "== MapLibre GL =="
  curl -fL --retry 3 -o web/vendor/maplibre-gl.js  https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js
  curl -fL --retry 3 -o web/vendor/maplibre-gl.css https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.css
fi

echo "OK — data ready:"
du -sh data/gtfs data/osm 2>/dev/null || true
