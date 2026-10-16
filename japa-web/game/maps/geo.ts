// Pure geometry for the city maps: projection, simplification, clipping, compact encoding, and a street graph the
// avatar walks along. No imports, so the map build script (Node, type-stripped) and the game share it.

export type Pt = [number, number];

/** A drawn map: integer pixel coordinates in a width x height box. */
export interface CityMap {
  id: string;
  name: string;
  width: number;
  height: number;
  /** The real-world box the drawing covers, for placing far-away places (another city's visa centre) at the edge. */
  bbox: BBox;
  /** Polylines, delta-encoded: [x0, y0, dx1, dy1, dx2, dy2, ...]. */
  major: number[][];
  minor: number[][];
  rail: number[][];
  river: number[][];
  coast: number[][];
  /** Closed rings (lakes, lagoons, airport grounds). */
  water: number[][];
  airfield: number[][];
  /** Hotspots: real public places where OSM has them, otherwise a placeholder on a nearby street. */
  spots: Record<string, MapSpot>;
  attribution: string;
}

export interface MapSpot {
  x: number;
  y: number;
  /** What the pin says. Shops and offices are made-up names; public places use their real names. */
  label: string;
  /** True when the place came from OpenStreetMap; false when it was placed on a nearby street for the story. */
  real: boolean;
  /** The place is outside this map (e.g. the visa centre is in another city): drawn as an arrow at the edge. */
  offMap?: string;
}

export interface BBox { south: number; west: number; north: number; east: number }

/** Box around a centre, in kilometres either side. */
export function bboxAround(lat: number, lon: number, halfWkm: number, halfHkm: number): BBox {
  const dLat = halfHkm / 110.574;
  const dLon = halfWkm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return { south: lat - dLat, north: lat + dLat, west: lon - dLon, east: lon + dLon };
}

/** Local equirectangular projection into a box `width` wide, keeping the real aspect ratio. */
export function projector(b: BBox, width: number) {
  const lat0 = ((b.north + b.south) / 2) * (Math.PI / 180);
  const spanX = (b.east - b.west) * Math.cos(lat0);
  const spanY = b.north - b.south;
  const height = Math.round((width * spanY) / spanX);
  const project = (lat: number, lon: number): Pt => [
    ((lon - b.west) / (b.east - b.west)) * width,
    ((b.north - lat) / (b.north - b.south)) * height,
  ];
  return { width, height, project };
}

function perpDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (!len2) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Douglas-Peucker, iterative (long coastlines would overflow a recursive one). */
export function simplify(pts: Pt[], tolerance: number): Pt[] {
  if (pts.length <= 2) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    let best = -1, bestD = tolerance;
    for (let k = i + 1; k < j; k++) {
      const d = perpDist(pts[k], pts[i], pts[j]);
      if (d > bestD) { best = k; bestD = d; }
    }
    if (best > 0) { keep[best] = 1; stack.push([i, best], [best, j]); }
  }
  return pts.filter((_, k) => keep[k]);
}

/** Splits a polyline into the runs that fall inside the box (plus a margin), so roads don't run off forever. */
export function clip(pts: Pt[], width: number, height: number, margin = 8): Pt[][] {
  const inside = (p: Pt) => p[0] >= -margin && p[1] >= -margin && p[0] <= width + margin && p[1] <= height + margin;
  const out: Pt[][] = [];
  let run: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (inside(p)) {
      if (!run.length && i > 0) run.push(pts[i - 1]);
      run.push(p);
    } else if (run.length) {
      run.push(p);
      out.push(run);
      run = [];
    }
  }
  if (run.length > 1) out.push(run);
  return out;
}

/** Rounds to integers, drops repeated points and encodes as deltas. Returns null for a line too short to draw. */
export function encode(pts: Pt[], minLength = 2): number[] | null {
  const r: Pt[] = [];
  for (const [x, y] of pts) {
    const q: Pt = [Math.round(x), Math.round(y)];
    const last = r[r.length - 1];
    if (!last || last[0] !== q[0] || last[1] !== q[1]) r.push(q);
  }
  if (r.length < 2) return null;
  let len = 0;
  for (let i = 1; i < r.length; i++) len += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]);
  if (len < minLength) return null;
  const flat = [r[0][0], r[0][1]];
  for (let i = 1; i < r.length; i++) flat.push(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]);
  return flat;
}

export function decode(flat: number[]): Pt[] {
  const pts: Pt[] = [];
  let x = 0, y = 0;
  for (let i = 0; i < flat.length; i += 2) {
    x = i ? x + flat[i] : flat[i];
    y = i ? y + flat[i + 1] : flat[i + 1];
    pts.push([x, y]);
  }
  return pts;
}

/** SVG path data for a polyline (or a closed ring). */
export function pathD(flat: number[], closed = false): string {
  if (flat.length < 4) return "";
  let d = `M${flat[0]} ${flat[1]}l`;
  for (let i = 2; i < flat.length; i += 2) d += `${flat[i]} ${flat[i + 1]} `;
  return closed ? d.trimEnd() + "z" : d.trimEnd();
}

export function pointsD(pts: Pt[]): string {
  return pts.map((p, i) => `${i ? "L" : "M"}${Math.round(p[0])} ${Math.round(p[1])}`).join("");
}

// --- Street graph: the avatar walks along real roads -------------------------------------------------------------

export interface StreetGraph { nodes: Pt[]; edges: { to: number; w: number }[][] }

/** Joins every road vertex into a graph; vertices within `snap` pixels are merged, so crossing roads connect. */
export function buildGraph(lines: number[][], snap = 3): StreetGraph {
  const nodes: Pt[] = [];
  const edges: { to: number; w: number }[][] = [];
  const grid = new Map<string, number[]>();
  const cell = (x: number, y: number) => `${Math.floor(x / snap)},${Math.floor(y / snap)}`;
  const nodeAt = (p: Pt): number => {
    const cx = Math.floor(p[0] / snap), cy = Math.floor(p[1] / snap);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const n of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
        if (Math.hypot(nodes[n][0] - p[0], nodes[n][1] - p[1]) <= snap) return n;
      }
    }
    nodes.push(p);
    edges.push([]);
    const k = cell(p[0], p[1]);
    grid.set(k, [...(grid.get(k) ?? []), nodes.length - 1]);
    return nodes.length - 1;
  };
  for (const flat of lines) {
    const pts = decode(flat);
    let prev = -1;
    for (const p of pts) {
      const n = nodeAt(p);
      if (prev >= 0 && prev !== n) {
        const w = Math.hypot(nodes[n][0] - nodes[prev][0], nodes[n][1] - nodes[prev][1]);
        edges[prev].push({ to: n, w });
        edges[n].push({ to: prev, w });
      }
      prev = n;
    }
  }
  return { nodes, edges };
}

export function nearestNode(g: StreetGraph, p: Pt): number {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < g.nodes.length; i++) {
    if (!g.edges[i].length) continue;
    const d = Math.hypot(g.nodes[i][0] - p[0], g.nodes[i][1] - p[1]);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** Dijkstra with a binary heap. Returns the street route from a to b (including both ends), or a straight line. */
export function route(g: StreetGraph, a: Pt, b: Pt): Pt[] {
  const s = nearestNode(g, a), t = nearestNode(g, b);
  if (s < 0 || t < 0) return [a, b];
  const dist = new Float64Array(g.nodes.length).fill(Infinity);
  const prev = new Int32Array(g.nodes.length).fill(-1);
  const heap: [number, number][] = [[0, s]];
  dist[s] = 0;
  const push = (item: [number, number]) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = (): [number, number] => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, u] = pop();
    if (u === t) break;
    if (d > dist[u]) continue;
    for (const e of g.edges[u]) {
      const nd = d + e.w;
      if (nd < dist[e.to]) { dist[e.to] = nd; prev[e.to] = u; push([nd, e.to]); }
    }
  }
  if (!Number.isFinite(dist[t])) return [a, b];
  const path: Pt[] = [];
  for (let u = t; u >= 0; u = prev[u]) path.push(g.nodes[u]);
  path.reverse();
  return [a, ...path, b];
}

export function pathLength(pts: Pt[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return len;
}

/** The point a fraction t (0-1) of the way along a path. */
export function along(pts: Pt[], t: number): Pt {
  if (pts.length === 1) return pts[0];
  const total = pathLength(pts);
  let left = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (left <= seg && seg > 0) {
      const f = left / seg;
      return [pts[i - 1][0] + f * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + f * (pts[i][1] - pts[i - 1][1])];
    }
    left -= seg;
  }
  return pts[pts.length - 1];
}
