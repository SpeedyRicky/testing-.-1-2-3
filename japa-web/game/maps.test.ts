import { describe, expect, it } from "vitest";
import { DB, newRun } from "./engine";
import { along, bboxAround, buildGraph, clip, decode, encode, pathD, pathLength, projector, route, simplify, type Pt } from "./maps/geo";
import { CITIES, NIGERIA_CITIES } from "./maps/cities";
import { canadaCity, farSpots, journeyDestination, journeyProgress, mapIdFor, whereIs } from "./maps/places";
import { STATES } from "./nigeria";

describe("map geometry", () => {
  it("projects a box keeping the real aspect ratio, north up", () => {
    const b = bboxAround(6.5, 3.4, 10, 5);
    const { width, height, project } = projector(b, 1000);
    expect(width).toBe(1000);
    expect(height).toBeGreaterThan(480);
    expect(height).toBeLessThan(520);
    const [x, y] = project(6.5, 3.4);
    expect(Math.round(x)).toBe(500);
    expect(Math.round(y)).toBe(Math.round(height / 2));
    expect(project(b.north, b.west)).toEqual([0, 0]);
  });

  it("simplifies a wiggly line but keeps its ends and corners", () => {
    const pts: Pt[] = Array.from({ length: 101 }, (_, i) => [i, i === 50 ? 40 : Math.sin(i) * 0.2]);
    const s = simplify(pts, 1);
    expect(s[0]).toEqual([0, 0]);
    expect(s[s.length - 1]).toEqual(pts[100]);
    expect(s.some((p) => p[1] === 40)).toBe(true);
    expect(s.length).toBeLessThan(10);
  });

  it("clips to the box and round-trips the delta encoding", () => {
    const runs = clip([[-100, 10], [-50, 10], [10, 10], [50, 10], [200, 10]], 100, 100);
    expect(runs).toHaveLength(1);
    const e = encode(runs[0])!;
    expect(decode(e)).toEqual(runs[0].map(([x, y]) => [Math.round(x), Math.round(y)]));
    expect(pathD([0, 0, 10, 0, 0, 10], true)).toBe("M0 0l10 0 0 10z");
    expect(encode([[1, 1], [1.2, 1.1]])).toBeNull();
  });

  it("walks along the streets, not through buildings", () => {
    // An L-shaped road: the route from one end to the other must turn the corner.
    const g = buildGraph([encode([[0, 0], [100, 0], [100, 100]])!]);
    const r = route(g, [0, 0], [100, 100]);
    expect(r.some((p) => p[0] === 100 && p[1] === 0)).toBe(true);
    expect(pathLength(r)).toBeCloseTo(200, 0);
    expect(along(r, 0.5)).toEqual([100, 0]);
    // Two roads crossing within the snap distance are joined.
    const cross = buildGraph([encode([[0, 50], [100, 50]])!, encode([[50, 0], [51, 51], [50, 100]])!]);
    expect(pathLength(route(cross, [0, 50], [50, 100]))).toBeLessThan(110);
    // No roads at all: a straight line.
    expect(route(buildGraph([]), [0, 0], [3, 4])).toEqual([[0, 0], [3, 4]]);
  });
});

describe("cities and places", () => {
  it("every state has a map, and every city has a unique id", () => {
    for (const s of STATES) expect(NIGERIA_CITIES.some((c) => c.id === `ng-${s.code}`), s.code).toBe(true);
    expect(new Set(CITIES.map((c) => c.id)).size).toBe(CITIES.length);
  });

  it("scenes land on the right side of the Atlantic and the right hotspot", () => {
    const ng = newRun(DB, "NIGERIA_LIFE");
    expect(whereIs(DB, "LAGOS_DOCUMENT_GRIND", ng)).toEqual({ country: "NG", spot: "passport" });
    expect(whereIs(DB, "LAGOS_EMBASSY_QUEUE", ng)).toEqual({ country: "NG", spot: "vac" });
    expect(whereIs(DB, "LAGOS_YABA_DAWN", ng)).toEqual({ country: "NG", spot: "home" });
    const fy = newRun(DB, "FIRST_YEAR");
    expect(whereIs(DB, "FY_LANDING", fy)?.country).toBe("CA");
    const tg = newRun(DB, "TOURIST_GAMBLE");
    expect(whereIs(DB, "TOURIST_WHY", tg)?.country).toBe("NG");
    expect(whereIs(DB, "TOURIST_ARRIVAL", tg)?.country).toBe("CA");
    // Every scene with a place resolves to a hotspot every map can show.
    for (const id of Object.keys(DB.scenes)) {
      const w = whereIs(DB, id, newRun(DB, DB.scenes[id].route));
      if (w) expect(typeof w.spot).toBe("string");
    }
  });

  it("each route lives in its own Canadian city", () => {
    const aip = newRun(DB, "ATLANTIC_AIP");
    expect(canadaCity({ ...aip, routeStats: { ...aip.routeStats, aipProvince: 3 } })).toBe("ca-stjohns");
    const pnp = newRun(DB, "PNP_RURAL");
    expect(canadaCity({ ...pnp, routeStats: { ...pnp.routeStats, pnpProvince: 2 } })).toBe("ca-winnipeg");
    expect(canadaCity(newRun(DB, "TARGETED_TRADE"))).toBe("ca-edmonton");
    expect(mapIdFor({ country: "CA", spot: "airport" }, newRun(DB, "FIRST_YEAR"), "KN")).toBe("ca-gta");
    expect(mapIdFor({ country: "NG", spot: "market" }, newRun(DB, "NIGERIA_LIFE"), "KN")).toBe("ng-KN");
    expect(journeyDestination(newRun(DB, "FIRST_YEAR"))).toBe("pearson");
  });

  it("the visa centre is an edge arrow for cities without one, and inside the Abuja map", () => {
    const kano = NIGERIA_CITIES.find((c) => c.id === "ng-KN")!;
    const far = farSpots("KN", bboxAround(kano.lat, kano.lon, kano.halfW, kano.halfH), 1000);
    expect(far.vac?.offMap).toMatch(/Abuja/);
    const abuja = NIGERIA_CITIES.find((c) => c.id === "ng-FC")!;
    expect(farSpots("FC", bboxAround(abuja.lat, abuja.lon, abuja.halfW, abuja.halfH), 1000).vac?.offMap).toBeUndefined();
  });

  it("journey progress grows with levels and lands at 1 on a win", () => {
    const run = newRun(DB, "EXPRESS_ENTRY");
    const p0 = journeyProgress(DB, run);
    const later = { ...run, currentSceneId: "EE_FUNDS" };
    expect(journeyProgress(DB, later)).toBeGreaterThan(p0);
    expect(journeyProgress(DB, { ...run, outcome: { result: "win", reason: "X", title: "X" } })).toBe(1);
  });
});
