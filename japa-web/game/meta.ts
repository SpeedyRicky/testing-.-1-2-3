// Meta-progression across runs: Japa Points (JP), titles, the Oja market (perks and flair), the daily challenge
// and the day streak. Pure: the browser store lives in app/components/Meta.tsx.
import { applyEffects } from "./engine";
import type { Effects, GameState, RouteId, RunMods } from "./types";

export interface Perk {
  id: string;
  name: string;
  blurb: string;
  cost: number;
  effects?: Effects;
  moneyFactor?: number;
  trapFactor?: number;
  oddsBonus?: number;
}

export const PERKS: Perk[] = [
  { id: "malt-bread", name: "Malt and Agege bread", blurb: "Start every run with +15 energy.", cost: 60, effects: { energy: 15 } },
  { id: "steady-head", name: "Steady head", blurb: "Village People Interference starts 10 lower.", cost: 80, effects: { desperation: -10 } },
  { id: "aunty-connect", name: "Aunty's connect", blurb: "Start with 15% more money, honestly given.", cost: 110, moneyFactor: 1.15 },
  { id: "prayer-warrior", name: "Prayer warrior", blurb: "Village People traps strike 30% less often.", cost: 130, trapFactor: 0.7 },
  { id: "night-reader", name: "Night reader", blurb: "+6% on every risky choice: you did the reading.", cost: 150, oddsBonus: 0.06 },
  { id: "wey-sabi-number", name: "Wey Sabi's real number", blurb: "+10 Street Cred: the one mentor who actually sabi.", cost: 70, effects: { streetCred: 10 } },
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

// --- Run modifiers -----------------------------------------------------------------------------------

/** Equipped perks plus (optionally) the daily modifier, combined into one set of run modifiers. */
export function bundleFor(perkIds: string[], daily?: { day: string; modifier: DailyModifier }): RunMods & { effects: Effects } {
  const parts = [...PERKS.filter((p) => perkIds.includes(p.id)), ...(daily ? [daily.modifier.mods] : [])];
  const effects: Effects = {};
  let moneyFactor = 1;
  let trapFactor = 1;
  let oddsBonus = 0;
  for (const p of parts) {
    for (const [k, v] of Object.entries(p.effects ?? {})) effects[k as keyof Effects] = (effects[k as keyof Effects] ?? 0) + (v ?? 0);
    moneyFactor *= p.moneyFactor ?? 1;
    trapFactor *= p.trapFactor ?? 1;
    oddsBonus += p.oddsBonus ?? 0;
  }
  return { effects, moneyFactor, trapFactor, oddsBonus, ...(daily ? { daily: daily.day, label: daily.modifier.name } : {}) };
}

/** Applies a bundle to a fresh run: starting effects, money factor, and the modifiers the engine reads later. */
export function applyBundle(run: GameState, b: RunMods & { effects: Effects }): GameState {
  const money = b.moneyFactor ?? 1;
  let s: GameState = { ...run, walletCad: Math.round(run.walletCad * money), walletNgn: Math.round(run.walletNgn * money) };
  s = applyEffects(s, b.effects);
  const mods: RunMods = { trapFactor: b.trapFactor, oddsBonus: b.oddsBonus, daily: b.daily, label: b.label };
  return { ...s, mods };
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
