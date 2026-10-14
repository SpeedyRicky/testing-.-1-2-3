// Simulated playthroughs for balance: thousands of runs per route with simple player policies.
// Used by the balance tests and by `npm run simulate` to print a report.
import { DB, choose, dismissPopup, newRun, presentChoices, resolvePopup, takeAction, type PresentedChoice } from "./engine";
import { allEndings, endingKey } from "./endings";
import type { GameState, RouteId, ScenarioDatabase } from "./types";

export type Policy = "random" | "careful" | "smart";

/** A small seeded random source, so reports are reproducible. */
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHADY = /FRAUD|MISREP|SCAM|CASH|PAY_TO_PLAY|BOUGHT|PAID_FOR|LEAK|ARROGANCE|INFLATED|FAKE|HAZARD|IGNORED|SAME_FILE|WENT_HOME|BREACH/i;

function leadsToFail(db: ScenarioDatabase, c: PresentedChoice) {
  return db.scenes[c.nextSceneId]?.outcome?.result === "fail";
}

/** A careful player avoids shady choices and direct dead ends, prefers good odds, otherwise picks at random. */
function pick(db: ScenarioDatabase, s: GameState, policy: Policy, rnd: () => number): PresentedChoice | null {
  const options = presentChoices(db, s).filter((c) => c.enabled);
  if (!options.length) return null;
  if (policy === "random") return options[Math.floor(rnd() * options.length)];
  const safe = options.filter((c) => !SHADY.test(c.label ?? "") && !leadsToFail(db, c) && (c.odds === undefined || c.odds >= 0.35));
  const pool = safe.length ? safe : options;
  if (policy === "careful") return pool[Math.floor(rnd() * pool.length)];
  // A competent player: looks after energy and nerves when low, avoids going round in circles, likes good odds.
  const visits = (id: string) => s.history.filter((h) => h.sceneId === id).length;
  const score = (c: PresentedChoice) => {
    const e = c.effects ?? {};
    let v = rnd() * 2;
    if (s.energy < 35) v += (e.energy ?? 0) * 0.3;
    if (s.desperation > 65) v -= (e.desperation ?? 0) * 0.3;
    v -= visits(c.nextSceneId) * 3;
    if (c.odds !== undefined) v += (c.odds - 0.5) * 6;
    return v;
  };
  return [...pool].sort((a, b) => score(b) - score(a))[0];
}

/** A sensible crisis answer: the one that hurts desperation and energy least for the money it costs. */
function bestOption(s: GameState): number {
  const opts = s.popup?.options ?? [];
  let best = 0, bestV = -Infinity;
  opts.forEach((o, i) => {
    const e = o.effects as Record<string, number>;
    const v = -(e.desperation ?? 0) + (e.energy ?? 0) * 0.5 + (e.walletCad ?? 0) / 100 + (e.walletNgn ?? 0) / 100000 - (e.familyStrain ?? 0);
    if (v > bestV) { bestV = v; best = i; }
  });
  return best;
}

const DASH_PLAN = ["job_fair", "cold_message", "mentor_coffee", "resume"];

export interface RunResult {
  route: RouteId; result: "win" | "fail" | "neutral" | "stuck"; ending: string | null; moves: number; traps: number;
  /** For collapses (burnout and the like): the last scene before it. */
  collapsedAt: string | null;
}

export function playOnce(db: ScenarioDatabase, route: RouteId, policy: Policy, rnd: () => number, maxMoves = 400): RunResult {
  let s = newRun(db, route);
  let moves = 0;
  let traps = 0;
  let last = s.currentSceneId;
  while (!s.outcome && moves < maxMoves) {
    last = s.currentSceneId;
    moves++;
    const scene = db.scenes[s.currentSceneId];
    if (scene?.dashboard) {
      const acts = scene.dashboard.actions;
      let id: string;
      if (policy === "random") id = acts[Math.floor(rnd() * acts.length)].id;
      else id = s.energy < 35 ? "rest" : DASH_PLAN[Math.floor(rnd() * DASH_PLAN.length)];
      const r = takeAction(db, s, id, [rnd(), rnd()]);
      if (r.state === s) { s = takeAction(db, s, "rest", [rnd(), rnd()]).state; continue; }
      s = r.state;
      continue;
    }
    const c = pick(db, s, policy, rnd);
    if (!c) break;
    const next = choose(db, s, c.index, [rnd(), rnd(), rnd(), rnd()]);
    if (next.popup) traps++;
    s = next.popup?.options?.length
      ? dismissPopup(resolvePopup(db, next, policy === "random" ? Math.floor(rnd() * next.popup.options.length) : bestOption(next)))
      : dismissPopup(next);
  }
  const collapse = db.routes[route].collapse?.sceneId;
  return { route, result: s.outcome?.result ?? "stuck", ending: endingKey(db, s), moves, traps,
    collapsedAt: collapse && s.currentSceneId === collapse ? last : null };
}

export interface RouteReport {
  route: RouteId; policy: Policy; runs: number;
  win: number; neutral: number; fail: number; stuck: number;
  avgMoves: number; avgTraps: number; endings: Record<string, number>; collapses: Record<string, number>;
}

export function simulate(db: ScenarioDatabase, route: RouteId, policy: Policy, runs = 2000, seed = 7): RouteReport {
  const rnd = mulberry(seed);
  const rep: RouteReport = { route, policy, runs, win: 0, neutral: 0, fail: 0, stuck: 0, avgMoves: 0, avgTraps: 0, endings: {}, collapses: {} };
  for (let i = 0; i < runs; i++) {
    const r = playOnce(db, route, policy, rnd);
    rep[r.result]++;
    rep.avgMoves += r.moves / runs;
    rep.avgTraps += r.traps / runs;
    if (r.ending) rep.endings[r.ending] = (rep.endings[r.ending] ?? 0) + 1;
    if (r.collapsedAt) rep.collapses[r.collapsedAt] = (rep.collapses[r.collapsedAt] ?? 0) + 1;
  }
  return rep;
}

/** Endings no simulated player reached (random and careful together). */
export function unreached(db: ScenarioDatabase, reports: RouteReport[]): string[] {
  const seen = new Set(reports.flatMap((r) => Object.keys(r.endings)));
  return allEndings(db).map((e) => e.key).filter((k) => !seen.has(k));
}

export const PLAYABLE_ROUTES = (Object.keys(DB.routes) as RouteId[]).filter((r) => DB.routes[r].status === "playable");
