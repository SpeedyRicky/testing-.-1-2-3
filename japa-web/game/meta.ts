// Meta-progression across runs: Japa Points (JP), titles, the Oja market (perks and flair), the daily challenge
// and the day streak. Pure: the browser store lives in app/components/Meta.tsx.
import { applyEffects } from "./engine";
import type { Effects, GameState, RouteId, RunMods, ScenarioDatabase } from "./types";

export interface Perk {
  id: string;
  name: string;
  blurb: string;
  cost: number;
  effects?: Effects;
  moneyFactor?: number;
  trapFactor?: number;
  oddsBonus?: number;
  familyStress?: number;
  fxShield?: number;
  scamRadar?: boolean;
}

export const PERKS: Perk[] = [
  { id: "malt-bread", name: "Malt and Agege bread", blurb: "Start every run with +15 energy.", cost: 60, effects: { energy: 15 } },
  { id: "steady-head", name: "Steady head", blurb: "Village People Interference starts 10 lower.", cost: 80, effects: { desperation: -10 } },
  { id: "aunty-connect", name: "Aunty's connect", blurb: "Start with 15% more money, honestly given.", cost: 110, moneyFactor: 1.15 },
  { id: "prayer-warrior", name: "Prayer warrior", blurb: "Village People traps strike 30% less often.", cost: 130, trapFactor: 0.7 },
  { id: "night-reader", name: "Night reader", blurb: "+6% on every risky choice: you did the reading.", cost: 150, oddsBonus: 0.06 },
  { id: "wey-sabi-number", name: "Wey Sabi's real number", blurb: "+10 Street Cred: the one mentor who actually sabi.", cost: 70, effects: { streetCred: 10 } },
  // No perk can buy a test score or immunity from scams: they make the work easier, not the lesson disappear.
  { id: "study-plan", name: "Study plan: Band 8 track", blurb: "+35 IELTS prep at the start: about +14% on your English test and nursing exam odds. You did the work.", cost: 120, effects: { ieltsPrep: 35 } },
  { id: "scam-radar", name: "Scam radar", blurb: "A ⚠️ marks choices that lead straight to a scam or fraud ending, in the first 3 scenes that have one each run. You still decide.", cost: 100, scamRadar: true },
  { id: "boundaries", name: "Boundaries", blurb: "Family-money pop-ups (black tax, land sales, Mummy's calls) add 40% less stress.", cost: 90, familyStress: 0.6 },
  { id: "dollar-habit", name: "Dollar savings habit", blurb: "Saving in dollars early: naira crashes cost you half as much.", cost: 150, fxShield: 0.5 },
];
export const MAX_EQUIPPED = 2;

export interface Flair { id: string; emoji: string; name: string; cost: number }
export const FLAIRS: Flair[] = [
  { id: "ng", emoji: "🇳🇬", name: "Naija to the bone", cost: 0 },
  { id: "maple", emoji: "🍁", name: "Maple leaf", cost: 40 },
  { id: "passport", emoji: "🛂", name: "Stamped passport", cost: 60 },
  { id: "jollof", emoji: "🍛", name: "Jollof diplomat", cost: 60 },
  { id: "cap", emoji: "🎓", name: "Convocation cap", cost: 80 },
  { id: "crown", emoji: "👑", name: "Japa royalty", cost: 200 },
];

/** Lifetime JP decides your title. */
export const TITLES: { min: number; title: string }[] = [
  { min: 0, title: "JJC" },
  { min: 100, title: "Japa apprentice" },
  { min: 300, title: "Visa hustler" },
  { min: 700, title: "Paper chase pro" },
  { min: 1500, title: "Japa legend" },
];
export const titleFor = (lifetime: number) => [...TITLES].reverse().find((t) => lifetime >= t.min)!.title;
export const nextTitle = (lifetime: number) => TITLES.find((t) => t.min > lifetime) ?? null;

// --- Daily challenge -------------------------------------------------------------------------------

export interface DailyModifier { id: string; name: string; blurb: string; mods: Omit<Perk, "id" | "name" | "blurb" | "cost"> }
export const DAILY_MODIFIERS: DailyModifier[] = [
  { id: "naira-crash", name: "Naira crash day", blurb: "Your money is worth 25% less today.", mods: { moneyFactor: 0.75 } },
  { id: "harmattan", name: "Harmattan", blurb: "Dust, dry lips, low battery: start with 20 less energy.", mods: { effects: { energy: -20 } } },
  { id: "wey-sabi-in-town", name: "Wey Sabi is in town", blurb: "Village People traps strike 50% more often.", mods: { trapFactor: 1.5 } },
  { id: "lucky-friday", name: "Lucky Friday", blurb: "+10% on every risky choice.", mods: { oddsBonus: 0.1 } },
  { id: "strike-season", name: "Strike season", blurb: "ASUU, NUT, JOHESU: every risky choice is 10% harder.", mods: { oddsBonus: -0.1 } },
  { id: "owambe-weekend", name: "Owambe weekend", blurb: "Good vibes: Village People Interference starts 15 lower.", mods: { effects: { desperation: -15 } } },
];

/** A stable number from a string (FNV-1a). */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Today's challenge: the same route and modifier for every player on the same day. */
export function dailyFor(day: string, routes: RouteId[]): { day: string; route: RouteId; modifier: DailyModifier } {
  const h = hash(day);
  return { day, route: routes[h % routes.length], modifier: DAILY_MODIFIERS[Math.floor(h / 7) % DAILY_MODIFIERS.length] };
}

// --- Scam radar ----------------------------------------------------------------------------------------

const SCAM_LABEL = /FRAUD|SCAM|FAKE|BOUGHT|BRIBE|LEAK|MISREP/i;

/** Choice indices the Scam radar marks here: scam or fraud choices, in the first three scenes of a run that have one. */
export function radarMarks(db: ScenarioDatabase, run: GameState): Set<number> {
  if (!run.mods?.scamRadar || run.outcome) return new Set();
  const suspicious = (sceneId: string) => (db.scenes[sceneId]?.choices ?? []).flatMap((c, i) => {
    const end = db.scenes[c.nextSceneId]?.outcome;
    const trap = SCAM_LABEL.test(c.label ?? "") || (end?.result === "fail" && !/BURNOUT|EXPIRED|NOT_SELECTED|NO_OFFER|REFUSED/.test(end.reason));
    return trap ? [i] : [];
  });
  const scenes = [...new Set([...run.history.map((h) => h.sceneId), run.currentSceneId])].filter((id) => suspicious(id).length);
  const pos = scenes.indexOf(run.currentSceneId);
  return pos >= 0 && pos < 3 ? new Set(suspicious(run.currentSceneId)) : new Set();
}

// --- Run modifiers -----------------------------------------------------------------------------------

/** Equipped perks plus (optionally) the daily modifier, combined into one set of run modifiers. */
export function bundleFor(perkIds: string[], daily?: { day: string; modifier: DailyModifier }): RunMods & { effects: Effects } {
  const parts = [...PERKS.filter((p) => perkIds.includes(p.id)), ...(daily ? [daily.modifier.mods] : [])];
  const effects: Effects = {};
  let moneyFactor = 1;
  let trapFactor = 1;
  let oddsBonus = 0;
  let familyStress = 1, fxShield = 1, scamRadar = false;
  for (const p of parts) {
    if ("familyStress" in p) familyStress *= p.familyStress ?? 1;
    if ("fxShield" in p) fxShield *= p.fxShield ?? 1;
    if ("scamRadar" in p && p.scamRadar) scamRadar = true;
    for (const [k, v] of Object.entries(p.effects ?? {})) effects[k as keyof Effects] = (effects[k as keyof Effects] ?? 0) + (v ?? 0);
    moneyFactor *= p.moneyFactor ?? 1;
    trapFactor *= p.trapFactor ?? 1;
    oddsBonus += p.oddsBonus ?? 0;
  }
  return { effects, moneyFactor, trapFactor, oddsBonus, familyStress, fxShield, scamRadar, ...(daily ? { daily: daily.day, label: daily.modifier.name } : {}) };
}

/** Applies a bundle to a fresh run: starting effects, money factor, and the modifiers the engine reads later. */
export function applyBundle(run: GameState, b: RunMods & { effects: Effects }): GameState {
  const money = b.moneyFactor ?? 1;
  let s: GameState = { ...run, walletCad: Math.round(run.walletCad * money), walletNgn: Math.round(run.walletNgn * money) };
  s = applyEffects(s, b.effects);
  const mods: RunMods = { trapFactor: b.trapFactor, oddsBonus: b.oddsBonus, daily: b.daily, label: b.label,
    familyStress: b.familyStress, fxShield: b.fxShield, scamRadar: b.scamRadar };
  return { ...s, mods };
}

// --- Achievements ---------------------------------------------------------------------------------

export interface AchievementContext {
  run: GameState;
  meta: MetaState;
  endingsFound: number;
  threeStarLevels: number;
  today: string;
}
export interface Achievement { id: string; name: string; blurb: string; jp: number; test: (c: AchievementContext) => boolean }

const SHADY = /FRAUD|MISREP|SCAM|BOUGHT|PAID_FOR|PAY_TO_PLAY|INFLATED|FAKE|HAZARD|CASH/i;
const labels = (r: GameState) => r.history.map((h) => h.label ?? "");
const ended = (r: GameState, ...ids: string[]) => ids.includes(r.currentSceneId);

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-run", name: "First japa", blurb: "Finish any run.", jp: 20, test: () => true },
  { id: "clean-hands", name: "Clean hands", blurb: "Win a route without a single shady move.", jp: 60,
    test: (c) => c.run.outcome?.result === "win" && !labels(c.run).some((l) => SHADY.test(l)) },
  { id: "honest-exit", name: "Honest exit", blurb: "Tell the officer the truth: you came to find work.", jp: 40,
    test: (c) => labels(c.run).includes("HONEST_EXIT") },
  { id: "scam-spotter", name: "Scam spotter", blurb: "Check or report a scam instead of paying it.", jp: 40,
    test: (c) => labels(c.run).some((l) => l === "VERIFIED" || l === "REPORTED") },
  { id: "pr", name: "Permanent resident", blurb: "Land with a COPR through Express Entry.", jp: 80, test: (c) => ended(c.run, "EE_COPR") },
  { id: "pgwp", name: "Convocation", blurb: "Graduate in Canada with a PGWP.", jp: 60,
    test: (c) => ended(c.run, "ST_PGWP_MASTERS", "ST_PGWP_COLLEGE", "ST_PGWP_BACHELORS") },
  { id: "protected", name: "Protected person", blurb: "Win a refugee claim with a true story.", jp: 80, test: (c) => ended(c.run, "KW_ACCEPTED") },
  { id: "los", name: "Letter of Support", blurb: "Win the Startup Visa pitch.", jp: 60, test: (c) => ended(c.run, "SUV_LOS_ISSUED") },
  { id: "kovacs", name: "Kovacs said yes", blurb: "Get an employer to start an LMIA, legally.", jp: 60, test: (c) => ended(c.run, "LMIA_SPONSORSHIP") },
  { id: "field", name: "Back in your field", blurb: "End Year One working in your profession.", jp: 80, test: (c) => ended(c.run, "FY_FIELD") },
  { id: "village-fan", name: "Village People's favourite", blurb: "Lose a run to Village People Interference at 100%.", jp: 20,
    test: (c) => c.run.desperation >= 100 },
  { id: "collector", name: "Collector", blurb: "Find 10 endings.", jp: 50, test: (c) => c.endingsFound >= 10 },
  { id: "completionist", name: "Completionist", blurb: "Find 30 endings.", jp: 150, test: (c) => c.endingsFound >= 30 },
  { id: "three-stars", name: "Three-star general", blurb: "Earn all three stars on a level.", jp: 40, test: (c) => c.threeStarLevels >= 1 },
  { id: "daily-win", name: "Daily winner", blurb: "Win a daily challenge.", jp: 50,
    test: (c) => c.run.mods?.daily === c.today && c.run.outcome?.result !== "fail" },
  { id: "streak-3", name: "Consistent", blurb: "Play three days in a row.", jp: 40, test: (c) => c.meta.streak.count >= 3 },
  { id: "streak-7", name: "Japa every day", blurb: "Play seven days in a row.", jp: 120, test: (c) => c.meta.streak.count >= 7 },
];

/** Achievements earned by this finished run that the player didn't already have. */
export function newAchievements(c: AchievementContext): Achievement[] {
  const have = new Set(c.meta.achievements ?? []);
  return ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.test(c));
}

// --- Earning JP ---------------------------------------------------------------------------------------

export interface MetaState {
  version: 1;
  jp: number;
  lifetime: number;
  owned: string[];
  equipped: string[];
  flair: string;
  streak: { count: number; lastDay: string | null };
  dailyDone: string | null;
  runs: number;
  /** Recent award keys, so a restored or replayed ending never pays twice. */
  awarded: string[];
  achievements?: string[];
}

export const NEW_META: MetaState = {
  version: 1, jp: 0, lifetime: 0, owned: ["ng"], equipped: [], flair: "ng",
  streak: { count: 0, lastDay: null }, dailyDone: null, runs: 0, awarded: [],
};

export interface Award { key: string; total: number; lines: { label: string; jp: number }[] }

/** JP for a finished run: finishing, winning, a new ending, and the daily challenge (more with a streak). */
export function runAward(run: GameState, opts: { key: string; newEnding: boolean; today: string; streak: number }): Award {
  const lines: Award["lines"] = [{ label: "Run finished", jp: 10 }];
  if (run.outcome?.result === "win") lines.push({ label: "Win", jp: 30 });
  if (run.outcome?.result === "neutral") lines.push({ label: "You made it through", jp: 15 });
  if (opts.newEnding) lines.push({ label: "New ending found", jp: 25 });
  if (run.mods?.daily === opts.today) {
    const bonus = run.outcome?.result === "fail" ? 20 : 60;
    lines.push({ label: `Daily challenge${opts.streak > 1 ? ` (streak ×${Math.min(2, 1 + opts.streak * 0.1).toFixed(1)})` : ""}`, jp: Math.round(bonus * Math.min(2, 1 + opts.streak * 0.1)) });
  }
  return { key: opts.key, total: lines.reduce((s, l) => s + l.jp, 0), lines };
}

/** Adds JP once per award key; returns the same state when it was already paid. */
export function grant(m: MetaState, a: Award): MetaState {
  if (!a.total || m.awarded.includes(a.key)) return m;
  return { ...m, jp: m.jp + a.total, lifetime: m.lifetime + a.total, awarded: [...m.awarded.slice(-80), a.key] };
}

/** A day played: the streak grows on consecutive days and resets after a gap. */
export function touchStreak(m: MetaState, today: string): MetaState {
  if (m.streak.lastDay === today) return m;
  const y = new Date(`${today}T12:00:00`);
  y.setDate(y.getDate() - 1);
  const consecutive = m.streak.lastDay === dayKey(y);
  return { ...m, streak: { count: consecutive ? m.streak.count + 1 : 1, lastDay: today } };
}

export function buy(m: MetaState, id: string): MetaState {
  const item = PERKS.find((p) => p.id === id) ?? FLAIRS.find((f) => f.id === id);
  if (!item || m.owned.includes(id) || m.jp < item.cost) return m;
  return { ...m, jp: m.jp - item.cost, owned: [...m.owned, id] };
}

export function toggleEquip(m: MetaState, id: string): MetaState {
  if (!m.owned.includes(id) || !PERKS.some((p) => p.id === id)) return m;
  if (m.equipped.includes(id)) return { ...m, equipped: m.equipped.filter((e) => e !== id) };
  if (m.equipped.length >= MAX_EQUIPPED) return m;
  return { ...m, equipped: [...m.equipped, id] };
}
