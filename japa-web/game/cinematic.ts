// Turns "state before" + "state after" a choice into a description of the cutscene to play.
// Pure: no React, no timers, so the rules for what animates are unit-tested.
import type { BarSpec, GameState, RouteStats, ScenarioDatabase, StatKey } from "./types";

export type Tone = "good" | "bad" | "neutral" | "danger" | "triumph";

export interface Delta {
  key: StatKey;
  label: string;
  value: number;
  /** True when this change helps the player (a fall in desperation is good). */
  good: boolean;
  format?: "ngn" | "cad";
}

export interface CinematicSpec {
  tone: Tone;
  label: string;
  line: string;
  feedback: string;
  deltas: Delta[];
  money: "gain" | "loss" | null;
}

const LABELS: Partial<Record<StatKey, string>> = {
  walletNgn: "Cash",
  walletCad: "Funds",
  energy: "Energy",
  desperation: "Village People",
  streetCred: "Street Cred",
  timeRemainingDays: "Days left",
  papers: "Papers",
  investorInterest: "Investor Interest",
  technicalCredibility: "Technical Credibility",
  scalabilityScore: "Scalability",
  employerTrust: "Employer Trust",
  lmiaProbability: "LMIA Probability",
  crsScore: "CRS",
  clbFirst: "English CLB",
  nclcFrench: "French NCLC",
  academicStanding: "Grades",
  officerConfidence: "Officer confidence",
  networkScore: "Network",
  resumeScore: "Resume",
  employerLeads: "Employer leads",
  kwCredibility: "Credibility",
  kwEvidence: "Evidence",
  canadianWorkYears: "Canadian work (yrs)",
  ageYears: "Age",
};

/** Bookkeeping counters the player never needs to see animate. */
const HIDDEN: ReadonlySet<string> = new Set([
  "programType", "scholarshipTried", "familyAsked", "landSold", "crowdfunded", "ecaComplete", "pnpNomination",
  "educationLevel", "canadianEducation", "foreignWorkYears", "siblingInCanada", "loanTaken", "hasDegree",
  "conflictRegion", "kwBasis", "kwAtAirport", "eeCategory",
]);

/** Stats where a rise is bad news. Age is only bad for the CRS, which already shows its own change. */
const RISE_IS_BAD: ReadonlySet<string> = new Set(["desperation", "ageYears"]);

const CORE: StatKey[] = ["walletNgn", "walletCad", "energy", "desperation", "streetCred", "timeRemainingDays"];

export function diffStats(db: ScenarioDatabase, before: GameState, after: GameState): Delta[] {
  const bars: BarSpec[] = db.routes[before.activeRoute]?.bars ?? [];
  const barFor = (k: StatKey) => bars.find((b) => b.key === k);
  const keys = new Set<StatKey>([...CORE, ...(Object.keys({ ...before.routeStats, ...after.routeStats }) as StatKey[])]);
  const out: Delta[] = [];
  for (const key of keys) {
    if (HIDDEN.has(key)) continue;
    const isCore = (CORE as string[]).includes(key);
    const a = isCore ? (before[key as keyof GameState] as number) : before.routeStats[key as keyof RouteStats] ?? 0;
    const b = isCore ? (after[key as keyof GameState] as number) : after.routeStats[key as keyof RouteStats] ?? 0;
    const value = Math.round(b - a);
    if (!value) continue;
    const bar = barFor(key);
    out.push({
      key,
      label: bar?.label.replace(" %", "") ?? LABELS[key] ?? key,
      value,
      good: RISE_IS_BAD.has(key) || bar?.invert ? value < 0 : value > 0,
      format: bar?.format ?? (key === "walletNgn" ? "ngn" : key === "walletCad" ? "cad" : undefined),
    });
  }
  // Money first, then the biggest moves, at most six chips.
  return out
    .sort((x, y) => Number(!!y.format) - Number(!!x.format) || Math.abs(y.value) - Math.abs(x.value))
    .slice(0, 6);
}

export function describeChoice(
  db: ScenarioDatabase,
  before: GameState,
  after: GameState,
  line: string,
  label = "",
  feedback = "",
): CinematicSpec {
  const deltas = diffStats(db, before, after);
  let tone: Tone;
  if (after.outcome?.result === "fail") {
    tone = after.outcome.reason === "MISREPRESENTATION" || /FRAUD|BRIBE|UNAUTHORIZED/.test(after.outcome.reason) ? "danger" : "bad";
  } else if (after.outcome?.result === "win") {
    tone = "triumph";
  } else if (/FRAUD/.test(label)) {
    tone = "danger";
  } else {
    // Weigh the moves: each good change counts +1, each bad one -1.
    const score = deltas.reduce((s, d) => s + (d.good ? 1 : -1), 0);
    tone = score > 0 ? "good" : score < 0 ? "bad" : "neutral";
  }
  const money = deltas.find((d) => d.format);
  return {
    tone,
    label: label || (tone === "triumph" ? "SUCCESS" : tone === "danger" ? "FLAGGED" : ""),
    line,
    feedback,
    deltas,
    money: money ? (money.value > 0 ? "gain" : "loss") : null,
  };
}
