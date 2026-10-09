// The app's state machine. One reducer; each route keeps its own GameState,
// so switching modes never loses progress.
import { DB, choose, newRun, takeAction } from "./engine";
import type { GameState, RouteId, ScenarioDatabase, Toast } from "./types";

export interface AppState {
  activeRoute: RouteId;
  runs: Partial<Record<RouteId, GameState>>;
  toast: Toast | null;
}

export type AppEvent =
  | { type: "SELECT_ROUTE"; route: RouteId }
  | { type: "CHOOSE"; index: number }
  | { type: "TAKE_ACTION"; actionId: string; rolls: [number, number] }
  | { type: "RESTART" }
  | { type: "DISMISS_TOAST" }
  | { type: "FOLLOW_UNLOCK" };

export const PLAYABLE: RouteId[] = (Object.keys(DB.routes) as RouteId[]).filter((r) => DB.routes[r].status === "playable");

export function initialState(db: ScenarioDatabase = DB): AppState {
  const runs: Partial<Record<RouteId, GameState>> = {};
  for (const r of PLAYABLE) runs[r] = newRun(db, r);
  return { activeRoute: PLAYABLE[0], runs, toast: null };
}

export function activeRun(state: AppState): GameState | undefined {
  return state.runs[state.activeRoute];
}

const withRun = (state: AppState, run: GameState): AppState =>
  run === state.runs[state.activeRoute] ? state : { ...state, runs: { ...state.runs, [state.activeRoute]: run } };

export function makeReducer(db: ScenarioDatabase = DB) {
  return function reducer(state: AppState, event: AppEvent): AppState {
    const run = activeRun(state);
    switch (event.type) {
      case "SELECT_ROUTE":
        if (event.route === state.activeRoute || db.routes[event.route]?.status !== "playable") return state;
        return { ...state, activeRoute: event.route, toast: null };
      case "CHOOSE":
        return run ? withRun(state, choose(db, run, event.index)) : state;
      case "TAKE_ACTION": {
        if (!run) return state;
        const r = takeAction(db, run, event.actionId, event.rolls);
        if (!r.toast) return state;
        return { ...withRun(state, r.state), toast: { ...r.toast, id: (state.toast?.id ?? 0) + 1 } };
      }
      case "RESTART":
        return { ...state, runs: { ...state.runs, [state.activeRoute]: newRun(db, state.activeRoute) }, toast: null };
      case "DISMISS_TOAST":
        return state.toast ? { ...state, toast: null } : state;
      case "FOLLOW_UNLOCK": {
        // e.g. Tourist Gamble win -> LMIA interview, carrying the player's condition across.
        const target = run && run.outcome?.result === "win" ? db.scenes[run.currentSceneId]?.unlocksRoute : undefined;
        if (!run || !target) return state;
        const carried = newRun(db, target, {
          desperation: run.desperation,
          walletCad: run.walletCad,
          walletNgn: run.walletNgn,
          streetCred: run.streetCred,
          timeRemainingDays: run.timeRemainingDays,
          flags: { ...run.flags, [`from_${run.activeRoute.toLowerCase()}`]: true },
        });
        return { ...state, activeRoute: target, runs: { ...state.runs, [target]: carried }, toast: null };
      }
    }
  };
}

export const reducer = makeReducer();
