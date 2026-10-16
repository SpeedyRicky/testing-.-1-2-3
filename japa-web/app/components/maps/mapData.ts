// Loads a city map on demand (one small JSON per city), so the web build only downloads the player's own cities.
// The offline build bundles them all.
import type { CityMap, StreetGraph } from "@/game/maps/geo";
import { buildGraph } from "@/game/maps/geo";
import index from "@/game/maps/data/index.json";

const cache = new Map<string, Promise<CityMap | null>>();
const graphs = new WeakMap<CityMap, StreetGraph>();

export const BUILT: ReadonlySet<string> = new Set((index as { built: string[] }).built);

export function loadMap(id: string): Promise<CityMap | null> {
  if (!BUILT.has(id)) return Promise.resolve(null);
  let p = cache.get(id);
  if (!p) {
    p = import(`../../../game/maps/data/${id}.json`).then((m) => (m.default ?? m) as CityMap).catch(() => null);
    cache.set(id, p);
  }
  return p;
}

export function graphFor(map: CityMap): StreetGraph {
  let g = graphs.get(map);
  if (!g) {
    g = buildGraph([...map.major, ...map.minor]);
    graphs.set(map, g);
  }
  return g;
}
