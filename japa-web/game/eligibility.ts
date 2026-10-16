// Which pathways a player can open, from their profile and what they've earned in play.
// Simplified versions of the real entry criteria: enough to teach who each route is for, not an eligibility check.
import type { GameState, RouteId, ScenarioDatabase } from "./types";
import { TRADE_JOBS, deriveGameProfile, situationOf, type PlayerProfile } from "./profile";

export interface Access {
  ok: boolean;
  /** Why it's open, or what's missing. */
  reason: string;
  /** How to open it by playing, when the profile alone can't. */
  viaPlay?: string;
  /** Opened by a win, not by the profile. */
  earned?: boolean;
}

/** Wins that put the player in Canada with status: each one opens Year One. */
export const LANDINGS: ReadonlySet<string> = new Set([
  "EE_COPR", "KW_ACCEPTED", "TT_WIN", "PN_SETTLED", "SF_REUNITED", "LMIA_SPONSORSHIP",
  "AIP_PR_WIN", "SP_PR", "ST_PGWP_MASTERS", "ST_PGWP_COLLEGE", "ST_PGWP_BACHELORS",
]);

const ROUTE_IDS: RouteId[] = [
  "NIGERIA_LIFE", "STUDY_PERMIT", "EXPRESS_ENTRY", "STARTUP_VISA", "TOURIST_GAMBLE", "CAREGIVER_LMIA", "FIRST_YEAR",
  "SPLIT_FAMILY", "TARGETED_TRADE", "PNP_RURAL", "ATLANTIC_AIP", "SPOUSAL_SPONSOR",
];

const open = (reason: string): Access => ({ ok: true, reason });
const shut = (reason: string, viaPlay?: string): Access => ({ ok: false, reason, viaPlay });

/** Access to every route. No profile (tests, previews) means everything is open. */
export function eligibility(profile: PlayerProfile | null, unlocked: readonly RouteId[] = []): Record<RouteId, Access> {
  if (!profile) return Object.fromEntries(ROUTE_IDS.map((r) => [r, open("Open")])) as Record<RouteId, Access>;
  const g = deriveGameProfile(profile);
  const sit = situationOf(profile);
  const worker = profile.role === "worker" ? profile.worker : undefined;
  const years = worker?.years ?? 0;
  const married = sit.marital !== "single";
  const trade = worker && TRADE_JOBS.has(worker.occupation);
  const funded = sit.savings !== "under-1m" || worker?.salary === "400k-1m" || worker?.salary === "over-1m";

  const rules: Record<RouteId, Access> = {
    NIGERIA_LIFE: open("Everyone starts at home: save, test, gather documents."),
    STUDY_PERMIT: profile.age >= 17
      ? open("You've finished (or are finishing) school, so a Canadian school can admit you. You'll still need an acceptance letter and proof of funds.")
      : shut("You need to be 17 or older to start this route in the game."),
    EXPRESS_ENTRY: !worker || years < 1
      ? shut("Federal Skilled Worker needs at least one year of continuous, paid, skilled work.", "Win the Student route: your post-graduation work permit opens Express Entry from inside Canada.")
      : worker.qualification === "ssce"
        ? shut("With only SSCE, scoring the 67 points Federal Skilled Worker needs is very hard. A post-secondary credential (OND, HND, degree) opens this route.", "Win the Student route: a Canadian credential and work permit open Express Entry.")
        : open(`${years} year${years === 1 ? "" : "s"} of skilled work and ${g.educationPhrase}: you can build an Express Entry profile.`),
    STARTUP_VISA: sit.startup
      ? open("You're building a business, so you can pitch to a designated organization.")
      : shut("The Start-up Visa is for founders with an innovative business and a designated organization's support. Tick \"I'm building a startup\" in your profile if that's you."),
    TOURIST_GAMBLE: profile.age < 18
      ? shut("You need to be 18 or older to apply for a visitor visa alone.")
      : funded
        ? open("You can show money for the trip and ties at home, so a visitor visa is possible.")
        : shut("A visitor visa officer wants to see funds for the trip and strong ties home. With under ₦1m and a modest income, you'd likely be refused. If you have more saved, update your profile."),
    CAREGIVER_LMIA: shut("This is the hidden interview: it only appears after a win on the Tourist Gamble.", "Win the Tourist Gamble."),
    FIRST_YEAR: shut("Year One starts the day you land with status.", "Win any route that lands you in Canada (Express Entry, Student, Trades, PNP Rural, Atlantic and more)."),
    SPLIT_FAMILY: married
      ? open(`You're ${sit.marital === "married-kids" ? "married with kids" : "married"}: one of you goes first, the other follows.`)
      : shut("Pilot & Passenger is the married-couple route: one spouse goes first, the family follows. Set your status to married in your profile if that's you."),
    TARGETED_TRADE: trade && years >= 2
      ? open(`${years} years as a ${worker!.occupation === "mechanic" ? "mechanic" : worker!.occupation}: enough for the Federal Skilled Trades minimum of two years.`)
      : trade
        ? shut(`Federal Skilled Trades needs two years of full-time trade experience; you have ${years}.`)
        : shut("Federal Skilled Trades is for electricians, plumbers, welders, carpenters, mechanics and other skilled trades with two years' experience."),
    PNP_RURAL: worker && years >= 1
      ? open("A year of work experience: you can apply to rural employers and a provincial stream.")
      : shut("Rural and provincial streams need at least one year of work experience and a local job offer.", "Win the Student route and graduate in a smaller city, or gain work experience first."),
    ATLANTIC_AIP: worker && years >= 1
      ? open("About a year (1,560 hours) of paid work in the last five years: you can apply to designated employers in Atlantic Canada.")
      : shut("The Atlantic Immigration Program needs about a year (1,560 hours) of paid work in the last five years, or a degree from a school in Atlantic Canada, plus a job offer from a designated employer."),
    SPOUSAL_SPONSOR: married && sit.spouseInCanada
      ? open("Your spouse is a Canadian citizen or permanent resident, so they can sponsor you.")
      : married
        ? shut("Spousal sponsorship needs a spouse or partner who is a Canadian citizen or permanent resident. If yours is, tick it in your profile.")
        : shut("Spousal sponsorship is for married, common-law or conjugal partners of Canadian citizens and permanent residents. Engaged couples don't qualify."),
  };
  for (const r of unlocked) if (rules[r] && !rules[r].ok) rules[r] = { ok: true, earned: true, reason: "Unlocked by your win." };
  return rules;
}

export const canPlay = (profile: PlayerProfile | null, unlocked: readonly RouteId[], route: RouteId) =>
  eligibility(profile, unlocked)[route].ok;

/** Routes a finished run opens: its scene's own unlock, plus Year One after any landing. */
export function earnedBy(db: ScenarioDatabase, run: GameState | undefined): RouteId[] {
  if (!run?.outcome || run.outcome.result === "fail") return [];
  const scene = db.scenes[run.currentSceneId];
  const out: RouteId[] = [];
  if (scene?.unlocksRoute) out.push(scene.unlocksRoute);
  if (LANDINGS.has(run.currentSceneId)) out.push("FIRST_YEAR");
  return out;
}
