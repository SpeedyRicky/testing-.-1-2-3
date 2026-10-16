// Builds the journey map (Nigeria, the Atlantic and Canada) from Natural Earth via the world-atlas package.
// Natural Earth is public domain. Output: game/maps/world.json, a few KB.
//   node --experimental-strip-types scripts/world/build-world.ts
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import { encode, simplify, type Pt } from "../../game/maps/geo.ts";

const VIEW = { west: -130, east: 22, north: 64, south: -2 };
const W = 1000;
const H = Math.round((W * (VIEW.north - VIEW.south)) / (VIEW.east - VIEW.west));
const project = (lon: number, lat: number): Pt => [((lon - VIEW.west) / (VIEW.east - VIEW.west)) * W, ((VIEW.north - lat) / (VIEW.north - VIEW.south)) * H];

const topo = JSON.parse(readFileSync("node_modules/world-atlas/countries-50m.json", "utf8"));
const fc = feature(topo, topo.objects.countries) as unknown as { features: { id: string; properties: { name: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] };
const HIGHLIGHT: Record<string, string> = { "566": "NG", "124": "CA" };
const land: number[][] = [], nigeria: number[][] = [], canada: number[][] = [];
for (const f of fc.features) {
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates as number[][][]] : (f.geometry.coordinates as number[][][][]);
  for (const poly of polys) {
    const ring = poly[0].map(([lon, lat]) => project(lon, lat));
    const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
    if (Math.max(...xs) < -20 || Math.min(...xs) > W + 20 || Math.max(...ys) < -20 || Math.min(...ys) > H + 20) continue;
    const e = encode(simplify(ring, HIGHLIGHT[f.id] ? 0.6 : 1.1), 8);
    if (!e || e.length < 8) continue;
    (HIGHLIGHT[f.id] === "NG" ? nigeria : HIGHLIGHT[f.id] === "CA" ? canada : land).push(e);
  }
}
const places = {
  lagos: project(3.3212, 6.5774), abuja: project(7.2632, 9.0068), pearson: project(-79.6306, 43.6777),
  halifax: project(-63.5752, 44.6488), stjohns: project(-52.7126, 47.5615), moncton: project(-64.7782, 46.0878),
  charlottetown: project(-63.1311, 46.2382), winnipeg: project(-97.1384, 49.8951), saskatoon: project(-106.67, 52.1332),
  edmonton: project(-113.4938, 53.5461),
};
const round = (p: Pt) => [Math.round(p[0]), Math.round(p[1])];
writeFileSync("game/maps/world.json", JSON.stringify({ width: W, height: H, land, nigeria, canada,
  places: Object.fromEntries(Object.entries(places).map(([k, p]) => [k, round(p)])), attribution: "Natural Earth (public domain)" }));
console.log("world.json", Math.round(readFileSync("game/maps/world.json").length / 1024), "KB", { land: land.length, nigeria: nigeria.length, canada: canada.length, W, H });
