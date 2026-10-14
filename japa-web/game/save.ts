// Mid-run saves: every route's run, for the signed-in player. Pure: the browser storage lives in Game.tsx.
import type { AppState } from "./machine";
import type { GameState, RouteId, ScenarioDatabase } from "./types";

export const SAVE_VERSION = 1;

export interface SaveFile {
  version: number;
  /** Version of scenarios.json the runs were made with; a content update can invalidate a run. */
  content: string;
  username: string;
  activeRoute: RouteId;
  runs: Partial<Record<RouteId, GameState>>;
  /** Checksum of the runs, so a half-written or hand-edited save is detected and ignored instead of crashing the game. */
  sum?: string;
}

/** FNV-1a, 32-bit: a fast integrity check (not security: anything stored on the player's device can be edited). */
export function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

const sumOf = (activeRoute: RouteId, runs: SaveFile["runs"]) => checksum(JSON.stringify([activeRoute, runs]));

export function makeSave(db: ScenarioDatabase, state: AppState): SaveFile | null {
  if (!state.profile) return null;
  return {
    version: SAVE_VERSION, content: db.meta.version, username: state.profile.username,
    activeRoute: state.activeRoute, runs: state.runs, sum: sumOf(state.activeRoute, state.runs),
  };
}

/** Every number in a run is finite (no NaN or Infinity from a corrupted save). */
function sane(run: GameState): boolean {
  const nums = [run.energy, run.walletCad, run.walletNgn, run.desperation, run.timeRemainingDays, run.streetCred,
    ...Object.values(run.routeStats ?? {})];
  return nums.every((n) => n === undefined || (typeof n === "number" && Number.isFinite(n)));
}

/** The runs from a save that still make sense with today's content; anything else starts fresh. */
export function readSave(db: ScenarioDatabase, raw: unknown, username: string): { activeRoute: RouteId; runs: Partial<Record<RouteId, GameState>> } | null {
  const s = raw as Partial<SaveFile> | null;
  if (!s || s.version !== SAVE_VERSION || s.username !== username || typeof s.runs !== "object" || !s.runs) return null;
  if (s.sum !== undefined && s.activeRoute && s.sum !== sumOf(s.activeRoute, s.runs)) return null;
  const runs: Partial<Record<RouteId, GameState>> = {};
  for (const [route, run] of Object.entries(s.runs) as [RouteId, GameState][]) {
    const cfg = db.routes[route];
    if (!cfg || cfg.status !== "playable" || !run || run.activeRoute !== route) continue;
    if (!db.scenes[run.currentSceneId] || db.scenes[run.currentSceneId].route !== route) continue;
    if (!Array.isArray(run.history) || typeof run.routeStats !== "object" || !sane(run)) continue;
    runs[route] = run;
  }
  if (!Object.keys(runs).length) return null;
  const activeRoute = s.activeRoute && runs[s.activeRoute] ? s.activeRoute : (Object.keys(runs)[0] as RouteId);
  return { activeRoute, runs };
}
