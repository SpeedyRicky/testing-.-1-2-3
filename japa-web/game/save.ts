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
}

export function makeSave(db: ScenarioDatabase, state: AppState): SaveFile | null {
  if (!state.profile) return null;
  return {
    version: SAVE_VERSION, content: db.meta.version, username: state.profile.username,
    activeRoute: state.activeRoute, runs: state.runs,
  };
}

/** The runs from a save that still make sense with today's content; anything else starts fresh. */
export function readSave(db: ScenarioDatabase, raw: unknown, username: string): { activeRoute: RouteId; runs: Partial<Record<RouteId, GameState>> } | null {
  const s = raw as Partial<SaveFile> | null;
  if (!s || s.version !== SAVE_VERSION || s.username !== username || typeof s.runs !== "object" || !s.runs) return null;
  const runs: Partial<Record<RouteId, GameState>> = {};
  for (const [route, run] of Object.entries(s.runs) as [RouteId, GameState][]) {
    const cfg = db.routes[route];
    if (!cfg || cfg.status !== "playable" || !run || run.activeRoute !== route) continue;
    if (!db.scenes[run.currentSceneId] || db.scenes[run.currentSceneId].route !== route) continue;
    if (!Array.isArray(run.history) || typeof run.routeStats !== "object") continue;
    runs[route] = run;
  }
  if (!Object.keys(runs).length) return null;
  const activeRoute = s.activeRoute && runs[s.activeRoute] ? s.activeRoute : (Object.keys(runs)[0] as RouteId);
  return { activeRoute, runs };
}
