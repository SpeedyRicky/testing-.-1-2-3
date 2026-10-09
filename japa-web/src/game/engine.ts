// Pure game logic over scenarios.json. No React, no randomness (rolls are passed in),
// so every rule is unit-testable. Same semantics as the Godot runner (narrative.gd).
import type {
  Choice, Conditions, CoreStat, DashboardAction, Effects, GameState, Op, RouteId, RouteStats,
  ScenarioDatabase, Scene, StatKey, Toast,
} from "./types";
import data from "./scenarios.json";

export const DB = data as unknown as ScenarioDatabase;

const CORE: ReadonlySet<string> = new Set<CoreStat>([
  "timeRemainingDays", "energy", "walletCad", "walletNgn", "desperation", "streetCred",
]);
const PERCENT: ReadonlySet<string> = new Set(["energy", "desperation"]);
const MAX_HOPS = 16;

export const isCore = (key: string): key is CoreStat => CORE.has(key);

export function getStat(state: GameState, key: StatKey): number {
  if (isCore(key)) return state[key];
  return state.routeStats[key as keyof RouteStats] ?? 0;
}

/** Numbers add. Energy and desperation clamp to 0-100; wallets and time never go negative.
 *  Route stats are left unclamped so thresholds behave exactly as in the Godot game. */
export function applyEffects(state: GameState, effects: Effects = {}): GameState {
  const next: GameState = { ...state, routeStats: { ...state.routeStats } };
  for (const [key, delta] of Object.entries(effects) as [StatKey, number][]) {
    if (!Number.isFinite(delta)) continue;
    if (isCore(key)) {
      const v = next[key] + delta;
      next[key] = PERCENT.has(key) ? Math.min(100, Math.max(0, v)) : Math.max(0, v);
    } else {
      const k = key as keyof RouteStats;
      next.routeStats[k] = (next.routeStats[k] ?? 0) + delta;
    }
  }
  return next;
}

export function check(current: number, op: Op, target: number): boolean {
  switch (op) {
    case ">=": return current >= target;
    case ">": return current > target;
    case "<=": return current <= target;
    case "<": return current < target;
    case "==": return current === target;
    case "!=": return current !== target;
    default: return false;
  }
}

export function evaluate(state: GameState, conditions: Conditions = {}): boolean {
  return (Object.entries(conditions) as [StatKey, [Op, number]][]).every(([key, [op, target]]) =>
    check(getStat(state, key), op, target));
}

/** Enters a scene: applies onEnter, follows RESOLUTION branches, and records an outcome on terminal scenes. */
export function enterScene(db: ScenarioDatabase, state: GameState, sceneId: string): GameState {
  let s = state;
  let id = sceneId;
  let decidedBy: string | undefined;
  for (let hop = 0; ; hop++) {
    const scene = db.scenes[id];
    if (!scene) {
      return { ...s, currentSceneId: id, outcome: { result: "fail", reason: `MISSING_SCENE:${id}`, title: "Content error" } };
    }
    s = applyEffects(s, scene.onEnter);
    s = { ...s, currentSceneId: id, history: [...s.history, { sceneId: id }] };
    if (!scene.branch) {
      if (scene.outcome) s = { ...s, outcome: { ...scene.outcome, decidedBy } };
      return s;
    }
    if (hop >= MAX_HOPS) return { ...s, outcome: { result: "fail", reason: "BRANCH_LOOP", title: "Content error" } };
    decidedBy = id;
    id = (scene.branch.find((b) => !b.when || evaluate(s, b.when)) ?? scene.branch[scene.branch.length - 1]).nextSceneId;
  }
}

export function newRun(db: ScenarioDatabase, route: RouteId, carry: Partial<GameState> = {}): GameState {
  const cfg = db.routes[route];
  const init = cfg.initialState ?? {};
  const base: GameState = {
    activeRoute: route,
    currentLocation: "",
    timeRemainingDays: 180,
    energy: 100,
    walletCad: 0,
    walletNgn: 0,
    desperation: 30,
    streetCred: 10,
    currentSceneId: cfg.startSceneId ?? "",
    flags: {},
    lastChoice: null,
    outcome: null,
    history: [],
    ...init,
    routeStats: { ...(init.routeStats ?? {}) },
    ...carry,
  };
  if (!cfg.startSceneId) return base;
  return enterScene(db, { ...base, history: [] }, cfg.startSceneId);
}

export function currentScene(db: ScenarioDatabase, state: GameState): Scene | undefined {
  return db.scenes[state.currentSceneId];
}

export interface PresentedChoice extends Choice {
  index: number;
  enabled: boolean;
}

export function presentChoices(db: ScenarioDatabase, state: GameState): PresentedChoice[] {
  if (state.outcome) return [];
  return (currentScene(db, state)?.choices ?? []).map((c, index) => ({
    ...c, index, enabled: !c.requires || evaluate(state, c.requires),
  }));
}

/** Takes a dialogue choice. Invalid or locked choices return the same state object. */
export function choose(db: ScenarioDatabase, state: GameState, index: number): GameState {
  if (state.outcome) return state;
  const choice = currentScene(db, state)?.choices?.[index];
  if (!choice || (choice.requires && !evaluate(state, choice.requires))) return state;
  let s = applyEffects(state, choice.effects);
  const history = [...s.history];
  history[history.length - 1] = { ...history[history.length - 1], answer: choice.text, label: choice.label };
  s = { ...s, history, lastChoice: { label: choice.label, feedback: choice.feedback ?? "" } };
  return enterScene(db, s, choice.nextSceneId);
}

// --- Resolution screens --------------------------------------------------------

export interface Criterion {
  key: StatKey;
  op: Op;
  threshold: number;
  value: number;
  passed: boolean;
}

/** Explains the winning branch of a RESOLUTION scene against the current state. */
export function explainResolution(db: ScenarioDatabase, resolveSceneId: string, state: GameState): Criterion[] {
  const winning = db.scenes[resolveSceneId]?.branch?.find((b) => b.when)?.when ?? {};
  return (Object.entries(winning) as [StatKey, [Op, number]][]).map(([key, [op, threshold]]) => {
    const value = getStat(state, key);
    return { key, op, threshold, value, passed: check(value, op, threshold) };
  });
}

/** Pass marks per stat for a route, read from its RESOLUTION scenes, so bars can draw them. */
export function thresholdsFor(db: ScenarioDatabase, route: RouteId): Partial<Record<StatKey, number>> {
  const out: Partial<Record<StatKey, number>> = {};
  for (const scene of Object.values(db.scenes)) {
    if (scene.route !== route || !scene.branch) continue;
    const when = scene.branch.find((b) => b.when)?.when ?? {};
    for (const [key, [, t]] of Object.entries(when) as [StatKey, [Op, number]][]) out[key] = t;
  }
  return out;
}

// --- Dashboard (Tourist Gamble) -------------------------------------------------

export function dashboardOf(db: ScenarioDatabase, state: GameState) {
  return currentScene(db, state)?.dashboard;
}

export function leadChance(state: GameState, action: DashboardAction): number {
  if (!action.leadChance) return 0;
  const bonus = 1 + (state.routeStats.networkScore ?? 0) / 60 + (state.routeStats.resumeScore ?? 0) / 50;
  return Math.min(0.75, action.leadChance * bonus);
}

export function canTake(state: GameState, action: DashboardAction): boolean {
  if (state.outcome) return false;
  for (const key of ["energy", "walletCad", "walletNgn"] as const) {
    const d = action.effects[key] ?? 0;
    if (d < 0 && state[key] + d < 0) return false;
  }
  return true;
}

/** Takes a dashboard action. `rolls` = [lead roll, consequence roll], each in [0, 1).
 *  Returns the new state and the toast to show (null if nothing happened). */
export function takeAction(
  db: ScenarioDatabase, state: GameState, actionId: string, rolls: [number, number],
): { state: GameState; toast: Omit<Toast, "id"> | null } {
  const dash = dashboardOf(db, state);
  const action = dash?.actions.find((a) => a.id === actionId);
  if (!dash || !action || !canTake(state, action)) return { state, toast: null };

  if (action.fatal) {
    const text = action.consequences[0];
    return {
      state: {
        ...state, currentLocation: action.location,
        outcome: { result: "fail", reason: "UNAUTHORIZED_WORK", title: "Run over", subtitle: action.fatal },
        history: [...state.history, { sceneId: state.currentSceneId, answer: action.label }],
      },
      toast: { title: action.label, text, tone: "bad" },
    };
  }

  const [leadRoll, textRoll] = rolls;
  const gotLead = leadRoll < leadChance(state, action);
  const pool = gotLead && action.leadConsequences?.length ? action.leadConsequences : action.consequences;
  const text = pool[Math.floor(textRoll * pool.length) % pool.length];
  const days = -(action.effects.timeRemainingDays ?? 0);

  let s = applyEffects(state, action.effects);
  s = applyEffects(s, {
    walletCad: -dash.dailyCostCad * days,
    ...(gotLead ? { employerLeads: 1, desperation: -10 } : {}),
  });
  if (s.timeRemainingDays <= dash.lowTimeDays) s = applyEffects(s, { desperation: 2 });
  s = {
    ...s,
    currentLocation: action.location,
    history: [...s.history, { sceneId: state.currentSceneId, answer: action.label }],
  };

  if ((s.routeStats.employerLeads ?? 0) >= dash.leadsToWin) {
    s = enterScene(db, s, dash.winSceneId);
  } else if (s.walletCad <= 0) {
    s = { ...s, outcome: { result: "fail", reason: "OUT_OF_MONEY", title: "Out of money", subtitle: "You book the cheapest flight back to Lagos." } };
  } else if (s.timeRemainingDays <= 0) {
    s = { ...s, outcome: { result: "fail", reason: "STAY_EXPIRED", title: "Time's up", subtitle: "Your authorized stay is over. Without an offer or an approved extension, it is time to leave." } };
  } else if (s.desperation >= 100) {
    s = { ...s, outcome: { result: "fail", reason: "BURNOUT", title: "Burnout", subtitle: "Desperation hit 100. You stop sleeping, stop eating, and stop making good decisions." } };
  }

  const tone = gotLead ? "good" : (action.effects.desperation ?? 0) > 0 ? "bad" : "neutral";
  return { state: s, toast: { title: gotLead ? "Employer lead!" : action.label, text, tone } };
}

/** "HIGH_VALUE_MATCH" or "HIGH VALUE MATCH" -> "High value match", keeping acronyms. */
const ACRONYMS = new Set(["roi", "lmia", "ielts", "clb", "suv", "pnp", "ircc"]);
export function formatLabel(raw: string): string {
  if (!raw) return "";
  const words = raw.split(/[_\s]+/).map((w) => w.toLowerCase());
  const s = words.map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w)).join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
