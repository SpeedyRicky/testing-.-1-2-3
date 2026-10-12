// Pure game logic over scenarios.json. No React, no randomness (rolls are passed in),
// so every rule is unit-testable. Same semantics as the Godot runner (narrative.gd).
import type { Gamble,
  Choice, Conditions, CoreStat, CrsTables, DashboardAction, Effects, GameState, Op, Rank, RouteId, RouteStats,
  ScenarioDatabase, Scene, StatKey, Toast,
} from "./types";
import data from "./scenarios.json";

export const DB = data as unknown as ScenarioDatabase;

const CORE: ReadonlySet<string> = new Set<CoreStat>([
  "timeRemainingDays", "energy", "walletCad", "walletNgn", "desperation", "streetCred",
]);
const PERCENT: ReadonlySet<string> = new Set(["energy", "desperation"]);
/** Route stats that are 0-100 meters rather than open-ended scores. */
const PERCENT_ROUTE: ReadonlySet<string> = new Set(["papers", "kwCredibility", "kwEvidence"]);
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
      const v = (next.routeStats[k] ?? 0) + delta;
      next.routeStats[k] = PERCENT_ROUTE.has(k) ? Math.min(100, Math.max(0, v)) : v;
    }
  }
  return withDerived(next);
}

/** Overwrites values (e.g. a test result), then recalculates derived stats. */
export function applySet(state: GameState, values: Effects = {}): GameState {
  const next: GameState = { ...state, routeStats: { ...state.routeStats } };
  for (const [key, value] of Object.entries(values) as [StatKey, number][]) {
    if (!Number.isFinite(value)) continue;
    if (isCore(key)) next[key] = value;
    else next.routeStats[key as keyof RouteStats] = value;
  }
  return withDerived(next);
}

// --- Express Entry: Comprehensive Ranking System ---------------------------------

export interface CrsBreakdown {
  age: number;
  education: number;
  language: number;
  secondLanguage: number;
  canadianWork: number;
  transferability: number;
  additional: number;
  total: number;
}

function perAbility(table: { minClb: number; points: number }[], clb: number): number {
  let pts = 0;
  for (const row of table) if (clb >= row.minClb) pts = row.points;
  return pts;
}

/** CRS for a candidate without a spouse, assuming the same CLB in all four abilities.
 *  Arranged employment earns nothing (removed March 25, 2025). */
export function computeCrs(t: CrsTables, rs: RouteStats): CrsBreakdown {
  const ageYears = rs.ageYears ?? 30;
  const age = t.age[String(Math.min(45, Math.max(17, ageYears)))] ?? 0;
  const eduLevel = rs.ecaComplete || (rs.canadianEducation ?? 0) > 0 ? rs.educationLevel ?? 0 : 0;
  const education = t.education[eduLevel] ?? 0;
  const clb = rs.clbFirst ?? 0;
  const nclc = rs.nclcFrench ?? 0;
  const language = perAbility(t.languagePerAbility, clb) * 4;
  const secondLanguage = perAbility(t.secondLanguagePerAbility, nclc) * 4;
  const canYears = Math.min(5, rs.canadianWorkYears ?? 0);
  const canadianWork = t.canadianWork[canYears] ?? 0;

  // Skill transferability: two groups of up to 50, 100 in total.
  const post1 = eduLevel >= 2;
  const post2 = eduLevel >= 5;
  const eduLang = clb >= 9 ? (post2 ? 50 : post1 ? 25 : 0) : clb >= 7 ? (post2 ? 25 : post1 ? 13 : 0) : 0;
  const eduCan = canYears >= 2 ? (post2 ? 50 : post1 ? 25 : 0) : canYears >= 1 ? (post2 ? 25 : post1 ? 13 : 0) : 0;
  const fw = rs.foreignWorkYears ?? 0;
  const fwBand = fw >= 3 ? 2 : fw >= 1 ? 1 : 0;
  const fwLang = clb >= 9 ? [0, 25, 50][fwBand] : clb >= 7 ? [0, 13, 25][fwBand] : 0;
  const fwCan = canYears >= 2 ? [0, 25, 50][fwBand] : canYears >= 1 ? [0, 13, 25][fwBand] : 0;
  const groupCap = t.transferability.groupCap;
  const transferability = Math.min(t.transferability.cap, Math.min(groupCap, eduLang + eduCan) + Math.min(groupCap, fwLang + fwCan));

  const a = t.additional;
  const french = nclc >= 7 ? (clb >= 5 ? a.frenchWithEnglish : a.frenchWithWeakEnglish) : 0;
  const additional = Math.min(600,
    (rs.pnpNomination ? a.pnp : 0) + (rs.siblingInCanada ? a.sibling : 0) + french
    + (a.canadianEducation[rs.canadianEducation ?? 0] ?? 0));

  const total = age + education + language + secondLanguage + canadianWork + transferability + additional;
  return { age, education, language, secondLanguage, canadianWork, transferability, additional, total };
}

/** Keeps derived stats current. Runs that track an Express Entry profile get a live CRS. */
function withDerived(state: GameState): GameState {
  if (!DB.crs || state.routeStats.ageYears === undefined) return state;
  const crsScore = computeCrs(DB.crs, state.routeStats).total;
  if (state.routeStats.crsScore === crsScore) return state;
  return { ...state, routeStats: { ...state.routeStats, crsScore } };
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

/** True if at least one condition holds. */
export function evaluateAny(state: GameState, conditions: Conditions = {}): boolean {
  return (Object.entries(conditions) as [StatKey, [Op, number]][]).some(([key, [op, target]]) =>
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

export function newRun(
  db: ScenarioDatabase, route: RouteId, carry: Partial<GameState> = {}, startSceneId?: string,
): GameState {
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
    popup: null,
    cadFloat: { amount: 0, tick: 0 },
    currentStage: null,
    ...init,
    ...carry,
    routeStats: { ...(init.routeStats ?? {}), ...(carry.routeStats ?? {}) },
  };
  const start = startSceneId ?? cfg.startSceneId;
  if (!start) return withDerived(base);
  return enterScene(db, withDerived({ ...base, history: [] }), start);
}

export function currentScene(db: ScenarioDatabase, state: GameState): Scene | undefined {
  return db.scenes[state.currentSceneId];
}

export interface PresentedChoice extends Choice {
  index: number;
  enabled: boolean;
  /** For risky choices: the chance of success right now, 0 to 1. */
  odds?: number;
}

/** The chance a risky choice succeeds from this state, after preparation bonuses, kept within its limits. */
export function gambleOdds(state: GameState, g: Gamble): number {
  let p = g.odds + (state.mods?.oddsBonus ?? 0);
  for (const b of g.bonus ?? []) p += getStat(state, b.key) * b.per;
  return Math.min(g.max ?? 0.95, Math.max(g.min ?? 0.05, p));
}

export function presentChoices(db: ScenarioDatabase, state: GameState): PresentedChoice[] {
  if (state.outcome) return [];
  return (currentScene(db, state)?.choices ?? []).map((c, index) => ({
    ...c, index, enabled: !c.requires || evaluate(state, c.requires),
    ...(c.gamble ? { odds: gambleOdds(state, c.gamble) } : {}),
  })).filter((c) => !c.hideUnless || evaluate(state, c.hideUnless));
}

/** Takes a dialogue choice. Invalid or locked choices return the same state object.
 *  `rolls` = [trap roll, trap pick roll, gamble roll] in [0, 1); only routes with traps use the first two, only
 *  risky choices the third (a missing gamble roll counts as 0: success, which keeps tests deterministic). */
export function choose(db: ScenarioDatabase, state: GameState, index: number, rolls: readonly number[] = [1, 0]): GameState {
  if (state.outcome || state.popup) return state;
  const choice = currentScene(db, state)?.choices?.[index];
  if (!choice || (choice.requires && !evaluate(state, choice.requires))) return state;
  const route = db.routes[state.activeRoute];
  let s = applySet(applyEffects(state, choice.effects), choice.set);
  let nextSceneId = choice.nextSceneId;
  let label = choice.label;
  let feedback = choice.feedback ?? "";
  if (choice.gamble) {
    // Odds come from the state before the choice: preparation counts, the choice's own cost doesn't.
    const won = (rolls[2] ?? 0) < gambleOdds(state, choice.gamble);
    const branch = won ? choice.gamble.success : choice.gamble.fail;
    s = applySet(applyEffects(s, branch.effects), branch.set);
    nextSceneId = branch.nextSceneId ?? nextSceneId;
    label = branch.label ?? (won ? "LUCKY_BREAK" : "NOT_THIS_TIME");
    feedback = branch.feedback;
  }
  const history = [...s.history];
  history[history.length - 1] = { ...history[history.length - 1], answer: choice.text, label };
  s = { ...s, history, lastChoice: label || feedback ? { label, feedback } : null };
  if (choice.floatCad) s = { ...s, cadFloat: { amount: choice.floatCad, tick: s.cadFloat.tick + 1 } };

  // Village People traps strike on ordinary moves, never on the move into an ending.
  const target = db.scenes[nextSceneId];
  const endingMove = !target || !!target.branch || !!target.outcome;
  const items = route.traps?.items.filter((t) => !t.when || evaluate(s, t.when)) ?? [];
  if (items.length && !endingMove && (rolls[0] ?? 1) < trapChance(db, s)) {
    const trap = items[Math.floor((rolls[1] ?? 0) * items.length) % items.length];
    s = applyEffects(s, trap.effects);
    s = { ...s, popup: { kind: "trap", id: trap.id, kicker: trap.kicker, title: trap.title, body: trap.body } };
  } else if (!endingMove && route.blessings && (rolls[3] ?? 1) < blessingChance(db, s)) {
    const pool = route.blessings.items.filter((b) => !b.when || evaluate(s, b.when));
    if (pool.length) {
      const b = pool[Math.floor((rolls[1] ?? 0) * pool.length) % pool.length];
      s = applyEffects(s, b.effects);
      s = { ...s, popup: { kind: "blessing", id: b.id, kicker: b.kicker, title: b.title, body: b.body, button: "Thank God" } };
    }
  }

  if (route.collapse && evaluateAny(s, route.collapse.any)) {
    return enterScene(db, s, route.collapse.sceneId);
  }
  return enterScene(db, s, nextSceneId);
}

// --- Lagos Life modifiers --------------------------------------------------------

/** Village People Interference is the desperation meter. */
export function trapChance(db: ScenarioDatabase, state: GameState): number {
  const t = db.routes[state.activeRoute].traps;
  if (!t) return 0;
  return (t.base + Math.pow(state.desperation / 100, t.exponent) * t.scale) * (state.mods?.trapFactor ?? 1);
}

/** Blessings come more often when Village People Interference is high. */
export function blessingChance(db: ScenarioDatabase, state: GameState): number {
  const b = db.routes[state.activeRoute].blessings;
  return b ? b.base + (state.desperation / 100) * b.scale : 0;
}

/** The parallel market jumps: wallet and papers shrink by the configured factors. */
export function applyMarketShock(db: ScenarioDatabase, state: GameState): GameState {
  const m = db.routes[state.activeRoute].marketShock;
  if (!m || state.outcome || state.popup) return state;
  const next: GameState = { ...state, routeStats: { ...state.routeStats } };
  for (const [key, factor] of Object.entries(m.multiply) as [StatKey, number][]) {
    if (isCore(key)) next[key] = Math.floor(next[key] * factor);
    else {
      const k = key as keyof RouteStats;
      next.routeStats[k] = Math.floor((next.routeStats[k] ?? 0) * factor);
    }
  }
  return { ...next, popup: { kind: "market", id: "market", kicker: m.kicker, title: m.title, body: m.body, button: m.button } };
}

export function dismissPopup(state: GameState): GameState {
  return state.popup ? { ...state, popup: null } : state;
}

/** The end-of-run rank for routes that define ranks (first match wins). */
export function rankFor(db: ScenarioDatabase, state: GameState): Rank | null {
  const ranks = db.routes[state.activeRoute].ranks ?? [];
  return ranks.find((r) =>
    (!r.sceneId || r.sceneId === state.currentSceneId)
    && (!r.reason || r.reason === state.outcome?.reason)
    && (!r.when || evaluate(state, r.when))) ?? null;
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
  // Networking and a Canadian-style resume help, with diminishing returns.
  const bonus = 1 + Math.min(1, (state.routeStats.networkScore ?? 0) / 120) + Math.min(0.6, (state.routeStats.resumeScore ?? 0) / 100);
  return Math.min(0.4, action.leadChance * bonus);
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
  db: ScenarioDatabase, state: GameState, actionId: string, rolls: readonly number[],
): { state: GameState; toast: Omit<Toast, "id"> | null } {
  const dash = dashboardOf(db, state);
  const action = dash?.actions.find((a) => a.id === actionId);
  if (!dash || !action || !canTake(state, action)) return { state, toast: null };

  if (action.fatal) {
    const text = action.consequences[0];
    return {
      state: {
        ...state, currentLocation: action.location, currentStage: action.stage ?? state.currentStage,
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
    currentStage: action.stage ?? s.currentStage,
    history: [...s.history, { sceneId: state.currentSceneId, answer: action.label }],
  };

  if (action.goToSceneId) {
    s = enterScene(db, s, action.goToSceneId);
  } else if ((s.routeStats.employerLeads ?? 0) >= dash.leadsToWin) {
    s = enterScene(db, s, dash.winSceneId);
  } else if (s.walletCad <= 0) {
    s = { ...s, outcome: { result: "fail", reason: "OUT_OF_MONEY", title: "Out of money", subtitle: "You book the cheapest flight back to Lagos." } };
  } else if (s.timeRemainingDays <= 0) {
    s = { ...s, outcome: { result: "fail", reason: "STAY_EXPIRED", title: "Time's up", subtitle: "Your authorized stay is over. Without an offer or an approved extension, it is time to leave." } };
  } else if (s.desperation >= 100) {
    s = { ...s, outcome: { result: "fail", reason: "BURNOUT", title: "Burnout", subtitle: "Desperation hit 100. You stop sleeping, stop eating, and stop making good decisions." } };
  }
  if (!s.outcome && !s.currentSceneId.startsWith("KW_") && db.scenes[s.currentSceneId]?.dashboard && !dash.actions.some((x) => !x.fatal && canTake(s, x))) {
    // Too tired to work the room and too broke to rest: nothing left to do.
    s = { ...s, outcome: { result: "fail", reason: "OUT_OF_MONEY", title: "Out of money", subtitle: "Too broke to rest and too tired to hustle. You book the cheapest flight back." } };
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
