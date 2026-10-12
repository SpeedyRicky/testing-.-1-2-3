// The app's state machine. One reducer; each route keeps its own GameState,
// so switching modes never loses progress.
import { DB, applyMarketShock, choose, dismissPopup, newRun, takeAction } from "./engine";
import type { Effects, GameState, RouteId, RunMods, ScenarioDatabase, Toast } from "./types";
import { applyBundle } from "./meta";
import { deriveGameProfile, familyFor, routePatches, type PlayerProfile } from "./profile";
import { isSibling } from "./family";

export interface AppState {
  profile: PlayerProfile | null;
  activeRoute: RouteId;
  runs: Partial<Record<RouteId, GameState>>;
  toast: Toast | null;
  /** Equipped perks, applied to each new run. */
  bundle?: Bundle | null;
}

export type AppEvent =
  | { type: "SELECT_ROUTE"; route: RouteId }
  | { type: "CHOOSE"; index: number; rolls?: number[] }
  | { type: "MARKET_SHOCK" }
  | { type: "DISMISS_POPUP" }
  | { type: "TAKE_ACTION"; actionId: string; rolls: number[] }
  | { type: "RESTART" }
  | { type: "DISMISS_TOAST" }
  | { type: "FOLLOW_UNLOCK" }
  | { type: "SET_PROFILE"; profile: PlayerProfile | null }
  /** Replay a level: restore the run as it was when the level started. */
  | { type: "LOAD_RUN"; run: GameState }
  /** Continue where the player left off (from a save). */
  | { type: "RESTORE_RUNS"; activeRoute: RouteId; runs: Partial<Record<RouteId, GameState>> }
  /** Equipped perks: applied to every run started from now on. */
  | { type: "SET_BUNDLE"; bundle: Bundle | null }
  /** Today's challenge: a fresh run of the route with the daily modifier on top of the perks. */
  | { type: "START_DAILY"; route: RouteId; bundle: Bundle };

export const PLAYABLE: RouteId[] = (Object.keys(DB.routes) as RouteId[]).filter((r) => DB.routes[r].status === "playable");

/** A fresh run of a route, starting from the player's profile when there is one. */
export type Bundle = RunMods & { effects: Effects };

export function startRoute(db: ScenarioDatabase, route: RouteId, profile: PlayerProfile | null, bundle?: Bundle | null): GameState {
  const run = newRun(db, route, (profile ? routePatches(profile)[route] : undefined) ?? {});
  return bundle ? applyBundle(run, bundle) : run;
}

export function initialState(db: ScenarioDatabase = DB, profile: PlayerProfile | null = null, bundle: Bundle | null = null): AppState {
  const runs: Partial<Record<RouteId, GameState>> = {};
  for (const r of PLAYABLE) runs[r] = startRoute(db, r, profile, bundle);
  return { profile, activeRoute: PLAYABLE[0], runs, toast: null, bundle };
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
        return run ? withRun(state, choose(db, run, event.index, event.rolls)) : state;
      case "MARKET_SHOCK":
        return run ? withRun(state, applyMarketShock(db, run)) : state;
      case "DISMISS_POPUP":
        return run ? withRun(state, dismissPopup(run)) : state;
      case "TAKE_ACTION": {
        if (!run) return state;
        const r = takeAction(db, run, event.actionId, event.rolls);
        if (!r.toast) return state;
        return { ...withRun(state, r.state), toast: { ...r.toast, id: (state.toast?.id ?? 0) + 1 } };
      }
      case "RESTART":
        return { ...state, runs: { ...state.runs, [state.activeRoute]: startRoute(db, state.activeRoute, state.profile, state.bundle) }, toast: null };
      case "SET_BUNDLE":
        return { ...state, bundle: event.bundle };
      case "START_DAILY":
        if (db.routes[event.route]?.status !== "playable") return state;
        return { ...state, activeRoute: event.route, runs: { ...state.runs, [event.route]: startRoute(db, event.route, state.profile, event.bundle) }, toast: null };
      case "SET_PROFILE":
        return initialState(db, event.profile, state.bundle);
      case "RESTORE_RUNS":
        return { ...state, activeRoute: event.activeRoute, runs: { ...state.runs, ...event.runs }, toast: null };
      case "LOAD_RUN":
        if (!db.routes[event.run.activeRoute] || !db.scenes[event.run.currentSceneId]) return state;
        return { ...state, activeRoute: event.run.activeRoute, runs: { ...state.runs, [event.run.activeRoute]: event.run }, toast: null };
      case "DISMISS_TOAST":
        return state.toast ? { ...state, toast: null } : state;
      case "FOLLOW_UNLOCK": {
        // e.g. Tourist Gamble win -> LMIA interview, carrying the player's condition across.
        const scene = run ? db.scenes[run.currentSceneId] : undefined;
        const target = run?.outcome && run.outcome.result !== "fail" ? scene?.unlocksRoute : undefined;
        if (!run || !scene || !target) return state;
        const carried = newRun(db, target, {
          desperation: run.desperation,
          walletCad: run.walletCad,
          walletNgn: run.walletNgn,
          streetCred: run.streetCred,
          timeRemainingDays: run.timeRemainingDays,
          flags: { ...run.flags, [`from_${run.activeRoute.toLowerCase()}`]: true },
          routeStats: carriedStats(scene.carry, state.profile),
        }, scene.unlockStartSceneId);
        return { ...state, activeRoute: target, runs: { ...state.runs, [target]: carried }, toast: null };
      }
    }
  };
}

/** CRS education after Canadian study. Codes: 3 two-year, 4 bachelor's, 5 two or more credentials
 *  (one of them 3+ years), 6 master's. The JSON marks a college diploma as 5 (assuming a prior degree). */
function combinedEducation(canadian: number, nigerianDegree: boolean): number {
  if (canadian >= 6) return canadian;
  if (canadian === 4) return nigerianDegree ? 5 : 4;
  if (canadian === 5) return nigerianDegree ? 5 : 3;
  return canadian;
}

/** Stats carried into the next route; age and work history follow the player's real profile. */
function carriedStats(carry: { routeStats?: GameState["routeStats"]; ageOffset?: number } | undefined, profile: PlayerProfile | null) {
  if (!carry?.routeStats) return undefined;
  if (!profile) return carry.routeStats;
  const g = deriveGameProfile(profile);
  return {
    ...carry.routeStats,
    ageYears: profile.age + (carry.ageOffset ?? 0),
    foreignWorkYears: g.foreignWorkYears,
    educationLevel: combinedEducation(carry.routeStats.educationLevel ?? 0, g.hasDegree),
    ...("siblingInCanada" in carry.routeStats ? { siblingInCanada: isSibling(familyFor(profile)) ? 1 : 0 } : {}),
  };
}

export const reducer = makeReducer();
