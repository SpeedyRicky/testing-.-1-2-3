// Builds the city maps from OpenStreetMap: roads, rivers, lagoons, rail and airfields from the Overpass API, simplified
// into small integer drawings (game/maps/data/<id>.json), plus real hotspots (markets, places of worship, bus
// stations, airports, government offices) where OSM has them.
//
//   node --experimental-strip-types scripts/maps/build-maps.ts [cityId ...]
//
// Runs in GitHub Actions (.github/workflows/japa-maps.yml); the Claude sandbox can't reach Overpass.
// Map data © OpenStreetMap contributors, available under the Open Database Licence (ODbL).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { CITIES, CANADA_SPOTS, NIGERIA_SPOTS, FICTIONAL, type CityDef, type SpotId } from "../../game/maps/cities.ts";
import { STATES } from "../../game/nigeria.ts";
import { bboxAround, clip, decode, encode, projector, simplify, type BBox, type MapSpot, type Pt } from "../../game/maps/geo.ts";

const OUT = "game/maps/data";
const WIDTH = 1000;
const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"];
const BUDGET = { NG: 34_000, CA: 44_000 };
const ATTRIBUTION = "Map data © OpenStreetMap contributors (ODbL)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function overpass(query: string): Promise<{ elements: OsmEl[] }> {
  // Offline dry run: MAPS_FIXTURE=file.json answers every query with the same response.
  if (process.env.MAPS_FIXTURE) return JSON.parse(readFileSync(process.env.MAPS_FIXTURE, "utf8"));
  let last = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const res = await fetch(url, {
        method: "POST", body: new URLSearchParams({ data: query }),
        headers: { "User-Agent": "japa-game-map-builder/1.0 (educational game; github.com/SpeedyRicky)" },
      });
      if (res.ok) return await res.json() as { elements: OsmEl[] };
      last = `${url} ${res.status}`;
    } catch (e) {
      last = `${url} ${(e as Error).message}`;
    }
    await sleep(4000 * (attempt + 1));
  }
  throw new Error(`Overpass failed: ${last}`);
}

interface OsmEl {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number; lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  members?: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[];
}

const bb = (b: BBox) => `${b.south.toFixed(5)},${b.west.toFixed(5)},${b.north.toFixed(5)},${b.east.toFixed(5)}`;

function shapeQuery(b: BBox, country: "NG" | "CA") {
  const B = bb(b);
  // Nigeria's maps are small towns as well as Lagos: tertiary roads give them shape. Canada's boxes are bigger.
  const minor = country === "NG" ? "tertiary|unclassified" : "tertiary";
  return `[out:json][timeout:180];
(
  way["highway"~"^(motorway|trunk|primary|secondary)$"](${B});
  way["highway"~"^(${minor})$"](${B});
  way["railway"="rail"](${B});
  way["waterway"~"^(river|canal)$"](${B});
  way["natural"="coastline"](${B});
  way["natural"="water"](${B});
  relation["natural"="water"](${B});
  way["aeroway"="aerodrome"](${B});
);
out geom;`;
}

function poiQuery(b: BBox) {
  const B = bb(b);
  return `[out:json][timeout:120];
(
  nwr["amenity"="marketplace"](${B});
  nwr["amenity"="place_of_worship"]["religion"~"^(christian|muslim)$"]["name"](${B});
  nwr["amenity"="bus_station"](${B});
  nwr["public_transport"="station"]["bus"="yes"](${B});
  nwr["aeroway"="aerodrome"](${B});
  nwr["name"~"Immigration|Passport|Service Canada|VFS|Visa Application",i](${B});
  nwr["amenity"="university"]["name"](${B});
  nwr["amenity"="bank"]["name"](${B});
  nwr["amenity"="townhall"](${B});
);
out center tags;`;
}

const lineOf = (geom: { lat: number; lon: number }[], project: (lat: number, lon: number) => Pt) =>
  geom.map((g) => project(g.lat, g.lon));

/** Joins way fragments of a multipolygon into closed rings where their ends meet. */
function stitch(parts: Pt[][]): { rings: Pt[][]; open: Pt[][] } {
  const key = (p: Pt) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
  const pool = parts.filter((p) => p.length > 1).map((p) => p.slice());
  const rings: Pt[][] = [], open: Pt[][] = [];
  while (pool.length) {
    let cur = pool.pop()!;
    let grew = true;
    while (grew && key(cur[0]) !== key(cur[cur.length - 1])) {
      grew = false;
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        const end = key(cur[cur.length - 1]);
        if (key(p[0]) === end) cur = cur.concat(p.slice(1));
        else if (key(p[p.length - 1]) === end) cur = cur.concat(p.slice(0, -1).reverse());
        else continue;
        pool.splice(i, 1);
        grew = true;
        break;
      }
    }
    (key(cur[0]) === key(cur[cur.length - 1]) ? rings : open).push(cur);
  }
  return { rings, open };
}

function draw(lines: Pt[][], tol: number, w: number, h: number, minLen = 3): number[][] {
  const out: number[][] = [];
  for (const l of lines) for (const run of clip(l, w, h)) {
    const e = encode(simplify(run, tol), minLen);
    if (e) out.push(e);
  }
  return out;
}

function drawRings(rings: Pt[][], tol: number, w: number, h: number): number[][] {
  const out: number[][] = [];
  for (const r of rings) {
    // Rings are kept whole (SVG clips them); tiny ones are dropped.
    const s = simplify(r, tol);
    const xs = s.map((p) => p[0]), ys = s.map((p) => p[1]);
    if (Math.max(...xs) < 0 || Math.min(...xs) > w || Math.max(...ys) < 0 || Math.min(...ys) > h) continue;
    if ((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) < 40) continue;
    const e = encode(s, 6);
    if (e) out.push(e);
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

function pickSpots(city: CityDef, pois: OsmEl[], project: (lat: number, lon: number) => Pt, w: number, h: number,
  roadPoints: Pt[]): Record<string, MapSpot> {
  const state = city.country === "NG" ? STATES.find((s) => `ng-${s.code}` === city.id) : undefined;
  const centre: Pt = [w / 2, h / 2];
  const located = pois.map((e) => {
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    return lat === undefined || lon === undefined ? null : { tags: e.tags ?? {}, p: project(lat, lon) };
  }).filter((x): x is { tags: Record<string, string>; p: Pt } => !!x)
    .filter((x) => x.p[0] >= 0 && x.p[1] >= 0 && x.p[0] <= w && x.p[1] <= h);
  const dist = (p: Pt) => Math.hypot(p[0] - centre[0], p[1] - centre[1]);
  const best = (f: (t: Record<string, string>) => boolean, prefer?: (t: Record<string, string>) => boolean) => {
    const c = located.filter((x) => f(x.tags));
    const preferred = prefer ? c.filter((x) => prefer(x.tags)) : [];
    return (preferred.length ? preferred : c).sort((a, b) => dist(a.p) - dist(b.p))[0];
  };
  const spots: Record<string, MapSpot> = {};
  const put = (id: SpotId, hit: { tags: Record<string, string>; p: Pt } | undefined, fallback: string) => {
    if (hit) spots[id] = { x: Math.round(hit.p[0]), y: Math.round(hit.p[1]), label: hit.tags.name ?? fallback, real: true };
  };
  const market = state?.market;
  put("market", best((t) => t.amenity === "marketplace", market ? (t) => !!t.name && norm(t.name).includes(norm(market).replace("market", "")) : undefined), market ?? "Market");
  put("church", best((t) => t.amenity === "place_of_worship" && t.religion === "christian"), "Church");
  put("mosque", best((t) => t.amenity === "place_of_worship" && t.religion === "muslim"), "Mosque");
  put("buspark", best((t) => t.amenity === "bus_station" || (t.public_transport === "station" && t.bus === "yes")), city.country === "NG" ? "Motor park" : "Bus terminal");
  put("airport", best((t) => t.aeroway === "aerodrome" && !!(t.iata || t.icao)), "Airport");
  put("bank", best((t) => t.amenity === "bank"), "Bank");
  const uni = state?.university;
  put("university", best((t) => t.amenity === "university", uni ? (t) => !!t.name && norm(uni).startsWith(norm(t.name).slice(0, 10)) : undefined), uni ?? "University");
  if (city.country === "NG") {
    put("passport", best((t) => !!t.name && /immigration|passport/i.test(t.name)), "Immigration office");
    put("vac", best((t) => !!t.name && /vfs|visa application/i.test(t.name)), "Visa application centre");
  } else {
    put("servicecanada", best((t) => !!t.name && /service canada/i.test(t.name)), "Service Canada");
  }
  // Everything else (and anything OSM doesn't have) goes on a real street, spread around the centre, deterministically.
  const wanted = city.country === "NG" ? NIGERIA_SPOTS : CANADA_SPOTS;
  const onStreet = roadPoints.filter((p) => p[0] > w * 0.08 && p[0] < w * 0.92 && p[1] > h * 0.1 && p[1] < h * 0.9);
  let k = 0;
  for (const id of wanted) {
    if (spots[id] || id === "vac" || (id === "airport" && city.country === "NG")) continue;
    const angle = (k++ / wanted.length) * Math.PI * 2 + 0.6;
    const r = Math.min(w, h) * (0.16 + 0.12 * (k % 3));
    const target: Pt = [centre[0] + Math.cos(angle) * r, centre[1] + Math.sin(angle) * r];
    const p = onStreet.sort((a, b) => Math.hypot(a[0] - target[0], a[1] - target[1]) - Math.hypot(b[0] - target[0], b[1] - target[1]))[0] ?? target;
    const label = FICTIONAL[id] ?? ({ passport: "Immigration office", market: market ?? "Market", church: "Church", mosque: "Mosque",
      buspark: "Motor park", bank: "Bank", university: uni ?? "University", servicecanada: "Service Canada", tribunal: "Refugee Board office",
      airport: "Airport" } as Record<string, string>)[id] ?? id;
    spots[id] = { x: Math.round(p[0]), y: Math.round(p[1]), label, real: false };
  }
  return spots;
}

async function buildCity(city: CityDef) {
  const box = bboxAround(city.lat, city.lon, city.halfW, city.halfH);
  const { width: w, height: h, project } = projector(box, WIDTH);
  const shapes = (await overpass(shapeQuery(box, city.country))).elements;
  if (!process.env.MAPS_FIXTURE) await sleep(1500);
  const pois = (await overpass(poiQuery(bboxAround(city.lat, city.lon, city.halfW * 1.15, city.halfH * 1.15)))).elements;

  const major: Pt[][] = [], minor: Pt[][] = [], rail: Pt[][] = [], river: Pt[][] = [], coast: Pt[][] = [];
  const waterParts: Pt[][] = [], airParts: Pt[][] = [];
  for (const e of shapes) {
    const t = e.tags ?? {};
    if (e.type === "way" && e.geometry) {
      const l = lineOf(e.geometry, project);
      if (/^(motorway|trunk|primary|secondary)$/.test(t.highway ?? "")) major.push(l);
      else if (t.highway) minor.push(l);
      else if (t.railway === "rail") rail.push(l);
      else if (t.waterway) river.push(l);
      else if (t.natural === "coastline") coast.push(l);
      else if (t.natural === "water") waterParts.push(l);
      else if (t.aeroway === "aerodrome") airParts.push(l);
    } else if (e.type === "relation" && t.natural === "water") {
      for (const m of e.members ?? []) if (m.geometry && m.role !== "inner") waterParts.push(lineOf(m.geometry, project));
    }
  }
  const water = stitch(waterParts), air = stitch(airParts);
  river.push(...water.open);

  // Tighten the simplification until the city fits its budget.
  for (let tol = 0.8; ; tol *= 1.35) {
    const map = {
      id: city.id, name: city.name, width: w, height: h, bbox: box,
      major: draw(major, tol, w, h, 4), minor: draw(minor, tol * 1.4, w, h, 6), rail: draw(rail, tol * 1.5, w, h, 8),
      river: draw(river, tol * 1.5, w, h, 8), coast: draw(coast, tol * 1.5, w, h, 8),
      water: drawRings(water.rings, tol * 1.5, w, h), airfield: drawRings(air.rings, tol * 2, w, h),
      spots: {} as Record<string, MapSpot>, attribution: ATTRIBUTION,
    };
    const roadPoints: Pt[] = [];
    for (const l of [...map.major, ...map.minor]) roadPoints.push(...decode(l));
    map.spots = pickSpots(city, pois, project, w, h, roadPoints);
    const json = JSON.stringify(map);
    if (json.length <= BUDGET[city.country] || tol > 12) {
      if (tol > 1) map.minor = map.minor.filter((l) => l.length > 6);
      writeFileSync(`${OUT}/${city.id}.json`, JSON.stringify(map));
      console.log(`${city.id.padEnd(18)} ${String(Math.round(json.length / 1024)).padStart(3)} KB  roads ${map.major.length}+${map.minor.length}  water ${map.water.length}  spots real ${Object.values(map.spots).filter((s) => s.real).length}/${Object.keys(map.spots).length}  tol ${tol.toFixed(2)}`);
      return;
    }
  }
}

mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
const todo = CITIES.filter((c) => !only.length || only.includes(c.id));
const failed: string[] = [];
for (const city of todo) {
  try {
    await buildCity(city);
  } catch (e) {
    failed.push(city.id);
    console.error(`${city.id}: ${(e as Error).message}`);
  }
  if (!process.env.MAPS_FIXTURE) await sleep(2500);
}
// The index lists every map that exists, so the game only offers maps that were built.
const built = CITIES.filter((c) => existsSync(`${OUT}/${c.id}.json`)).map((c) => c.id);
writeFileSync(`${OUT}/index.json`, JSON.stringify({ built, attribution: ATTRIBUTION, builtAt: new Date().toISOString().slice(0, 10) }));
console.log(`built ${built.length}/${CITIES.length}${failed.length ? `; failed: ${failed.join(", ")}` : ""}`);
if (failed.length === todo.length) process.exit(1);
