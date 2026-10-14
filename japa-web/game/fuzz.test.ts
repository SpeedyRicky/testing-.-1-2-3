// Stress engine: thousands of random playthroughs on every route, with extreme and corrupted stat values injected
// mid-run. The game must never throw, never produce NaN/Infinity, never point at a missing scene, and saves must
// round-trip (or be rejected cleanly when tampered with).
import { describe, expect, it } from "vitest";
import { DB, choose, dismissPopup, newRun, presentChoices, resolvePopup, takeAction } from "./engine";
import { mulberry, PLAYABLE_ROUTES } from "./simulate";
import { initialState } from "./machine";
import { makeSave, readSave } from "./save";
import type { GameState } from "./types";

const EXTREMES = [0, -1, 1, -1e9, 1e9, 0.5, 99, 100, 101, -100, Number.MAX_SAFE_INTEGER];

function finite(s: GameState): string[] {
  const bad: string[] = [];
  for (const k of ["energy", "walletCad", "walletNgn", "desperation", "timeRemainingDays", "streetCred"] as const) {
    if (!Number.isFinite(s[k])) bad.push(k);
  }
  for (const [k, v] of Object.entries(s.routeStats)) if (v !== undefined && !Number.isFinite(v)) bad.push(k);
  return bad;
}

function corrupt(s: GameState, rnd: () => number): GameState {
  const pick = () => EXTREMES[Math.floor(rnd() * EXTREMES.length)];
  const keys = Object.keys(s.routeStats);
  const rk = keys[Math.floor(rnd() * keys.length)];
  return {
    ...s,
    energy: rnd() < 0.3 ? pick() : s.energy,
    walletCad: rnd() < 0.3 ? pick() : s.walletCad,
    walletNgn: rnd() < 0.3 ? pick() : s.walletNgn,
    desperation: rnd() < 0.3 ? pick() : s.desperation,
    routeStats: rk && rnd() < 0.5 ? { ...s.routeStats, [rk]: pick() } : s.routeStats,
  };
}

describe("stress engine", () => {
  for (const route of PLAYABLE_ROUTES) {
    it(`${route}: 400 random runs with extreme values never break the state`, () => {
      const rnd = mulberry(route.length * 7919);
      for (let run = 0; run < 400; run++) {
        let s = newRun(DB, route);
        for (let step = 0; step < 120 && !s.outcome; step++) {
          if (rnd() < 0.15) s = corrupt(s, rnd);
          const scene = DB.scenes[s.currentSceneId];
          expect(scene, `${route} lost at ${s.currentSceneId}`).toBeTruthy();
          if (scene.dashboard) {
            const acts = scene.dashboard.actions;
            s = takeAction(DB, s, acts[Math.floor(rnd() * acts.length)].id, [rnd(), rnd()]).state;
            continue;
          }
          const options = presentChoices(DB, s);
          if (!options.length) break;
          const c = options[Math.floor(rnd() * options.length)];
          let next = choose(DB, s, c.index, [rnd(), rnd(), rnd(), rnd()]);
          if (next.popup?.options?.length) next = resolvePopup(DB, next, Math.floor(rnd() * next.popup.options.length));
          s = dismissPopup(next);
          expect(finite(s), `${route} at ${s.currentSceneId}`).toEqual([]);
        }
        expect(DB.scenes[s.currentSceneId]).toBeTruthy();
        if (s.outcome) expect(["win", "fail", "neutral"]).toContain(s.outcome.result);
      }
    });
  }

  it("saves round-trip, and tampered or corrupted saves are rejected without crashing", () => {
    const app = { ...initialState(DB, null), profile: { username: "Tester" } as never };
    const save = makeSave(DB, app)!;
    const json = JSON.parse(JSON.stringify(save));
    expect(readSave(DB, json, "Tester")?.runs).toBeTruthy();
    const tampered = { ...json, runs: { ...json.runs, NIGERIA_LIFE: { ...json.runs.NIGERIA_LIFE, walletNgn: 999999999 } } };
    expect(readSave(DB, tampered, "Tester")).toBeNull();
    for (const junk of [null, 42, "save", [], { version: 99 }, { ...json, runs: "x" }]) expect(readSave(DB, junk, "Tester")).toBeNull();
    const nan = { ...json, sum: undefined, runs: { NIGERIA_LIFE: { ...json.runs.NIGERIA_LIFE, energy: null } } };
    expect(() => readSave(DB, nan, "Tester")).not.toThrow();
  });
});
