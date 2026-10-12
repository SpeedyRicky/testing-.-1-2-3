import { describe, expect, it } from "vitest";
import {
  DB, applyEffects, applyMarketShock, choose, computeCrs, dismissPopup, enterScene, explainResolution, formatLabel, newRun,
  presentChoices, rankFor, takeAction, thresholdsFor, trapChance,
} from "./engine";
import { STAGES } from "../app/components/stages";
import { describeChoice, diffStats } from "./cinematic";
import {
  deriveGameProfile, familyFor, fillText, profileProblem, profileVars, usernameProblem, DEFAULT_AVATAR,
  type PlayerProfile,
} from "./profile";
import { STATES, placeFor, placeVars, vacCityFor } from "./nigeria";
import {
  PROVINCES, RELATIVE_NAMES, detectHeritage, makeRelative, provinceFor, relativeVars, seededRandom,
  type Heritage, type Relation, type Relative,
} from "./family";
import { initialState, makeReducer } from "./machine";
import { allEndings, endingKey, lessonFor } from "./endings";
import { levelIndexOf, levelProgress, levelsFor, starsFor } from "./levels";
import { GROOVES, moodFor } from "./music";
import type { GameState, RouteId, StatKey } from "./types";

const reducer = makeReducer();

/** Plays by choice text from a given state. */
function play2(start: GameState, picks: string[]): GameState {
  let s = start;
  for (const pick of picks) {
    const idx = presentChoices(DB, s).findIndex((c) => c.text.includes(pick));
    expect(idx, `choice containing "${pick}" at ${s.currentSceneId}`).toBeGreaterThanOrEqual(0);
    s = dismissPopup(choose(DB, s, idx, [1, 0]));
  }
  return s;
}

/** A Tourist Gamble run that has cleared the border and reached the dashboard. */
const landed = () => newRun(DB, "TOURIST_GAMBLE", {}, "TOURIST_HUB");

/** Plays by choice text. Rolls default to "no trap" so paths are deterministic. */
function play(route: RouteId, picks: string[], rolls: [number, number] = [1, 0]): GameState {
  let s = newRun(DB, route);
  for (const pick of picks) {
    const idx = presentChoices(DB, s).findIndex((c) => c.text.includes(pick));
    expect(idx, `choice containing "${pick}" at ${s.currentSceneId}`).toBeGreaterThanOrEqual(0);
    s = dismissPopup(choose(DB, s, idx, rolls));
  }
  return s;
}

describe("scenarios.json integrity", () => {
  const ids = new Set(Object.keys(DB.scenes));
  it("every nextSceneId, branch target and start scene exists", () => {
    const missing: string[] = [];
    for (const s of Object.values(DB.scenes)) {
      s.choices?.forEach((c) => !ids.has(c.nextSceneId) && missing.push(`${s.id} -> ${c.nextSceneId}`));
      s.branch?.forEach((b) => !ids.has(b.nextSceneId) && missing.push(`${s.id} -> ${b.nextSceneId}`));
      if (s.dashboard && !ids.has(s.dashboard.winSceneId)) missing.push(`${s.id} -> ${s.dashboard.winSceneId}`);
    }
    for (const [r, cfg] of Object.entries(DB.routes)) {
      if (cfg.startSceneId && !ids.has(cfg.startSceneId)) missing.push(`route ${r} start`);
    }
    expect(missing).toEqual([]);
  });

  it("every scene's id matches its key and its route exists", () => {
    for (const [key, s] of Object.entries(DB.scenes)) {
      expect(s.id).toBe(key);
      expect(DB.routes[s.route]).toBeDefined();
    }
  });

  it("no scene is a dead end", () => {
    for (const s of Object.values(DB.scenes)) {
      const exits = (s.choices?.length ?? 0) + (s.branch?.length ?? 0) + (s.outcome ? 1 : 0) + (s.dashboard ? 1 : 0);
      expect(exits, s.id).toBeGreaterThan(0);
    }
  });

  it("resolution branches end with an unconditional fallback", () => {
    for (const s of Object.values(DB.scenes)) {
      if (s.branch) expect(s.branch[s.branch.length - 1].when, s.id).toBeUndefined();
    }
  });

  it("every effect and condition names a known stat", () => {
    const known = new Set<string>([
      "timeRemainingDays", "energy", "walletCad", "walletNgn", "desperation", "streetCred",
      "investorInterest", "technicalCredibility", "scalabilityScore", "employerTrust", "lmiaProbability",
      "vocationalHoursLogged", "languageScoreClb", "provincialPoints", "networkScore", "resumeScore", "employerLeads",
      "papers", "ageYears", "educationLevel", "ecaComplete", "clbFirst", "nclcFrench", "foreignWorkYears",
      "canadianWorkYears", "canadianEducation", "pnpNomination", "siblingInCanada", "crsScore", "programType",
      "academicStanding", "officerConfidence", "scholarshipTried", "familyAsked", "landSold", "crowdfunded",
      "loanTaken", "hasDegree", "careerScore", "community", "pflRisk", "conflictRegion", "kwBasis", "kwAtAirport", "kwCredibility", "kwEvidence", "eeCategory",
    ]);
    const bad: string[] = [];
    for (const s of Object.values(DB.scenes)) {
      const maps: (object | undefined)[] = [s.onEnter, ...(s.choices ?? []).map((c) => c.effects), ...(s.dashboard?.actions ?? []).map((a) => a.effects)];
      for (const c of s.choices ?? []) maps.push(c.set, c.requires);
      for (const m of maps) for (const k of Object.keys(m ?? {})) if (!known.has(k)) bad.push(`${s.id}: ${k}`);
      for (const b of s.branch ?? []) for (const k of Object.keys(b.when ?? {})) if (!known.has(k)) bad.push(`${s.id}: ${k}`);
    }
    for (const [id, route] of Object.entries(DB.routes)) {
      for (const t of route.traps?.items ?? []) {
        for (const k of [...Object.keys(t.effects), ...Object.keys(t.when ?? {})]) if (!known.has(k)) bad.push(`${id} trap ${t.id}: ${k}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("Startup Visa pitch (same paths as the Godot tests)", () => {
  it("starts at Ms. Vance with 40/40/40", () => {
    const s = newRun(DB, "STARTUP_VISA");
    expect(s.currentSceneId).toBe("SUV_PITCH_START");
    expect(s.routeStats).toMatchObject({ investorInterest: 40, technicalCredibility: 40, scalabilityScore: 40 });
  });

  it("best pitch earns the Letter of Support", () => {
    const s = play("STARTUP_VISA", ["interoperable bridge", "event-driven", "key-person clause"]);
    expect(s.outcome).toMatchObject({ result: "win", reason: "SUV_LOS_ISSUED", decidedBy: "SUV_PITCH_RESOLVE" });
    expect(s.energy).toBe(90);
  });

  it("one weak answer is survivable", () => {
    expect(play("STARTUP_VISA", ["interoperable bridge", "event-driven", "best friends"]).outcome?.result).toBe("win");
  });

  it("a vague technical answer sinks it, and the resolution explains why", () => {
    const s = play("STARTUP_VISA", ["interoperable bridge", "advanced cloud", "key-person clause"]);
    expect(s.outcome).toMatchObject({ result: "fail", reason: "SUV_REJECTED" });
    expect(s.walletNgn).toBe(4000000);
    const crit = explainResolution(DB, "SUV_PITCH_RESOLVE", s);
    expect(crit.map((c) => [c.key, c.threshold, c.passed])).toEqual([
      ["investorInterest", 70, true],
      ["technicalCredibility", 65, false],
    ]);
  });

  it("the arrogance trap fails the pitch and adds desperation", () => {
    const s = play("STARTUP_VISA", ["simply superior", "event-driven", "key-person clause"]);
    expect(s.outcome?.result).toBe("fail");
    expect(s.desperation).toBe(30 + 15 + 20);
  });

  it("bars get their pass marks from the content", () => {
    expect(thresholdsFor(DB, "STARTUP_VISA")).toEqual({ investorInterest: 70, technicalCredibility: 65 });
    expect(thresholdsFor(DB, "CAREGIVER_LMIA")).toEqual({ lmiaProbability: 50, employerTrust: 20 });
  });

  it("invalid choices change nothing", () => {
    const s = newRun(DB, "STARTUP_VISA");
    expect(choose(DB, s, 99)).toBe(s);
    expect(choose(DB, s, -1)).toBe(s);
  });
});

describe("LMIA interview", () => {
  it("compliant path wins sponsorship", () => {
    expect(play("CAREGIVER_LMIA", ["I understand the hesitation", "follow the advertising rules"]).outcome)
      .toMatchObject({ result: "win", reason: "LMIA_SPONSORSHIP_STARTED" });
  });
  it("suggesting a fake posting ends the interview", () => {
    expect(play("CAREGIVER_LMIA", ["I understand the hesitation", "fake job listing"]).outcome?.reason)
      .toBe("BLATANT_MISREPRESENTATION");
  });
  it("desperation then a gamble is declined", () => {
    const s = play("CAREGIVER_LMIA", ["Please sir", "West African corridors"]);
    expect(s.outcome?.reason).toBe("NO_SPONSORSHIP");
    expect(s.history.find((h) => h.sceneId === "LMIA_INTERVIEW_KOVACS")?.label).toBe("CRITICAL LEAK");
  });
});

describe("Tourist Gamble dashboard", () => {
  const act = (s: GameState, id: string, lead = 0.99, text = 0) => takeAction(DB, s, id, [lead, text]);

  it("starts with 180 days, full energy, CAD 2,500", () => {
    expect(newRun(DB, "TOURIST_GAMBLE")).toMatchObject({ timeRemainingDays: 180, energy: 100, walletCad: 2500, desperation: 25 });
  });

  it("job fair costs a day, energy and money (plus daily cost) and returns a toast", () => {
    const { state, toast } = act(landed(), "job_fair");
    expect(state).toMatchObject({ timeRemainingDays: 179, energy: 70, walletCad: 2500 - 25 - 20, desperation: 22 });
    expect(state.routeStats.networkScore).toBe(8);
    expect(state.currentLocation).toContain("Convention Centre");
    expect(toast?.text).toContain("tote bags");
  });

  it("a lucky roll lands a lead and lowers desperation", () => {
    const { state, toast } = act(landed(), "cold_message", 0);
    expect(state.routeStats.employerLeads).toBe(1);
    expect(state.desperation).toBe(25 + 2 - 10);
    expect(toast).toMatchObject({ title: "Employer lead!", tone: "good" });
  });

  it("actions you can't afford in energy do nothing", () => {
    const s = { ...landed(), energy: 10 };
    expect(act(s, "job_fair").toast).toBeNull();
    expect(act(s, "rest").state.energy).toBe(50);
  });

  it("the cash job is an instant fail", () => {
    const { state } = act(landed(), "cash_job");
    expect(state.outcome).toMatchObject({ result: "fail", reason: "UNAUTHORIZED_WORK" });
    expect(act(state, "rest").toast).toBeNull();
  });

  it("running out the clock loses", () => {
    const s = { ...landed(), timeRemainingDays: 1 };
    expect(act(s, "rest").state.outcome?.reason).toBe("STAY_EXPIRED");
  });
});

describe("state machine", () => {
  it("lists only playable routes and opens on Lagos Life", () => {
    const app = initialState();
    expect(Object.keys(app.runs).sort()).toEqual(
      ["CAREGIVER_LMIA", "EXPRESS_ENTRY", "FIRST_YEAR", "NIGERIA_LIFE", "STARTUP_VISA", "STUDY_PERMIT", "TOURIST_GAMBLE"]);
    expect(app.activeRoute).toBe("NIGERIA_LIFE");
    expect(reducer(app, { type: "SELECT_ROUTE", route: "PNP_RURAL" })).toBe(app);
  });

  it("keeps each route's progress when switching", () => {
    let app = reducer(initialState(), { type: "SELECT_ROUTE", route: "STARTUP_VISA" });
    app = reducer(app, { type: "CHOOSE", index: 1 });
    app = reducer(app, { type: "SELECT_ROUTE", route: "TOURIST_GAMBLE" });
    app = reducer(app, { type: "CHOOSE", index: 0, rolls: [1, 0] }); // tell CBSA the truth
    app = reducer(app, { type: "TAKE_ACTION", actionId: "resume", rolls: [0.9, 0] });
    expect(app.toast?.id).toBe(1);
    app = reducer(app, { type: "SELECT_ROUTE", route: "STARTUP_VISA" });
    expect(app.runs.STARTUP_VISA?.currentSceneId).toBe("SUV_PITCH_CHEN");
    expect(app.runs.TOURIST_GAMBLE?.routeStats.resumeScore).toBe(15);
    expect(app.toast).toBeNull();
  });

  it("winning the tourist gamble unlocks Kovacs and carries desperation over", () => {
    let app = reducer(initialState(), { type: "SELECT_ROUTE", route: "TOURIST_GAMBLE" });
    app = reducer(app, { type: "CHOOSE", index: 0, rolls: [1, 0] }); // tell CBSA the truth
    expect(reducer(app, { type: "FOLLOW_UNLOCK" })).toBe(app);
    for (let i = 0; i < 3; i++) app = reducer(app, { type: "TAKE_ACTION", actionId: "cold_message", rolls: [0, 0] });
    const tourist = app.runs.TOURIST_GAMBLE!;
    expect(tourist.outcome).toMatchObject({ result: "win", reason: "INTERVIEW_SECURED" });
    app = reducer(app, { type: "FOLLOW_UNLOCK" });
    expect(app.activeRoute).toBe("CAREGIVER_LMIA");
    const lmia = app.runs.CAREGIVER_LMIA!;
    expect(lmia.desperation).toBe(tourist.desperation);
    expect(lmia.walletCad).toBe(tourist.walletCad);
    expect(lmia.flags.from_tourist_gamble).toBe(true);
    expect(lmia.currentSceneId).toBe("LMIA_INTERVIEW_KOVACS");
  });

  it("restart resets only the active route", () => {
    let app = reducer(initialState(), { type: "SELECT_ROUTE", route: "STARTUP_VISA" });
    app = reducer(app, { type: "CHOOSE", index: 1 });
    app = reducer(app, { type: "SELECT_ROUTE", route: "TOURIST_GAMBLE" });
    app = reducer(app, { type: "CHOOSE", index: 0, rolls: [1, 0] }); // tell CBSA the truth
    app = reducer(app, { type: "TAKE_ACTION", actionId: "resume", rolls: [0.9, 0] });
    app = reducer(app, { type: "SELECT_ROUTE", route: "STARTUP_VISA" });
    app = reducer(app, { type: "RESTART" });
    expect(app.runs.STARTUP_VISA?.currentSceneId).toBe("SUV_PITCH_START");
    expect(app.runs.TOURIST_GAMBLE?.routeStats.resumeScore).toBe(15);
  });
});

describe("Lagos Life (merged from the Cursor build)", () => {
  const HONEST = ["about the visa story", "Leave the call", "Book the appointment", "Answer every question",
    "call, then wait", "Open the email"];

  it("starts in Yaba with the original meters (hope 64 = interference 36)", () => {
    const s = newRun(DB, "NIGERIA_LIFE");
    expect(s.currentSceneId).toBe("LAGOS_YABA_DAWN");
    expect(s).toMatchObject({ walletNgn: 280000, energy: 72, desperation: 36 });
    expect(s.routeStats.papers).toBe(18);
  });

  it("the remote-job path runs out of energy (original balance, kept on purpose)", () => {
    const s = play("NIGERIA_LIFE", ["hunt remote jobs", "Rewrite the CV", "Take the interview",
      "Use the offer as the spine", "Answer every question", "call, then wait", "Open the email"]);
    expect(s.outcome?.result).toBe("fail");
    expect(s.energy).toBeLessThanOrEqual(12);
  });

  it("a borrowed bank statement is an instant fail", () => {
    const s = play("NIGERIA_LIFE", ["about the visa story", "Ask her to lend", "friend's statement"]);
    expect(s.outcome).toMatchObject({ result: "fail", reason: "MISREPRESENTATION" });
    expect(rankFor(DB, s)?.id).toBe("flagged");
  });

  it("the honest annex path wins and ranks Vanier Scholar", () => {
    const s = play("NIGERIA_LIFE", HONEST);
    expect(s.outcome).toMatchObject({ result: "win", reason: "JAPA_APPROVED", decidedBy: "LAGOS_RESOLVE" });
    expect(rankFor(DB, s)?.id).toBe("vanier");
  });

  it("over-explaining at the embassy still loses on papers", () => {
    const s = play("NIGERIA_LIFE", ["hunt remote jobs", "visa consultant blasting", "Pay 'facilitation'",
      "Over-explain", "call, then wait", "Open the email"]);
    expect(s.outcome?.result).toBe("fail");
    expect(s.currentSceneId).toBe("LAGOS_ENDING_STAY");
    expect(["pearson", "village", "hustle"]).toContain(rankFor(DB, s)?.id);
  });

  it("paying the consultant floats -$1,500 CAD", () => {
    const s = play("NIGERIA_LIFE", ["hunt remote jobs", "visa consultant blasting"]);
    expect(s.cadFloat).toEqual({ amount: 1500, tick: 1 });
  });

  it("trap chance rises with interference, as in the original formula", () => {
    const s = newRun(DB, "NIGERIA_LIFE");
    expect(trapChance(DB, s)).toBeCloseTo(0.05 + Math.pow(0.36, 1.65) * 0.72, 6);
    expect(trapChance(DB, { ...s, desperation: 100 })).toBeCloseTo(0.77, 6);
    expect(trapChance(DB, newRun(DB, "STARTUP_VISA"))).toBe(0);
  });

  it("a trap applies its hit, shows a pop-up and blocks moves until dismissed", () => {
    const start = newRun(DB, "NIGERIA_LIFE");
    const s = choose(DB, start, 0, [0, 0]);
    expect(s.popup).toMatchObject({ kind: "trap", id: "ielts" });
    expect(s.desperation).toBe(36 - 6 + 16);
    expect(s.routeStats.papers).toBe(18 - 14);
    expect(choose(DB, s, 0)).toBe(s);
    expect(dismissPopup(s).popup).toBeNull();
  });

  it("traps never fire on the move into the ending", () => {
    let s = play("NIGERIA_LIFE", HONEST.slice(0, -1));
    s = choose(DB, s, 0, [0, 0]);
    expect(s.popup).toBeNull();
    expect(s.outcome).not.toBeNull();
  });

  it("any meter running out collapses the run", () => {
    const broke = { ...newRun(DB, "NIGERIA_LIFE"), walletNgn: 1000 };
    const s = choose(DB, broke, 1); // calling the relative in Canada costs N2,000
    expect(s.currentSceneId).toBe("LAGOS_ENDING_STAY");
    expect(s.outcome?.result).toBe("fail");
  });

  it("the parallel-market shock cuts cash and papers by 25%", () => {
    const s = applyMarketShock(DB, newRun(DB, "NIGERIA_LIFE"));
    expect(s.walletNgn).toBe(210000);
    expect(s.routeStats.papers).toBe(13);
    expect(s.popup?.kind).toBe("market");
    expect(applyMarketShock(DB, s)).toBe(s);
    expect(applyMarketShock(DB, newRun(DB, "STARTUP_VISA")).popup).toBeNull();
  });

  it("papers stay within 0-100", () => {
    const s = applyEffects(newRun(DB, "NIGERIA_LIFE"), { papers: 500 });
    expect(s.routeStats.papers).toBe(100);
  });
});

describe("2D stages", () => {
  const LAGOS = ["yaba-dawn", "yaba-street", "cafe", "call-sister", "room-night", "agent", "annex", "whatsapp", "gig",
    "video-job", "embassy", "outside", "phone-text", "airport", "stay"];
  it("every scene and dashboard action points at a stage that exists", () => {
    const missing: string[] = [];
    const known = (k?: string) => !k || LAGOS.includes(k) || k in STAGES;
    for (const s of Object.values(DB.scenes)) {
      if (!known(s.stage)) missing.push(`${s.id}: ${s.stage}`);
      for (const a of s.dashboard?.actions ?? []) if (!known(a.stage)) missing.push(`${a.id}: ${a.stage}`);
    }
    expect(missing).toEqual([]);
  });
  it("every story scene has a stage", () => {
    const bare = Object.values(DB.scenes).filter((s) => s.layoutType === "STORY_STAGE" && !s.stage).map((s) => s.id);
    expect(bare).toEqual([]);
  });
  it("dashboard actions move the 2D stage", () => {
    const { state } = takeAction(DB, landed(), "mentor_coffee", [0.99, 0]);
    expect(state.currentStage).toBe("tim-hortons");
  });
});

describe("CRS calculator (hand-checked against the IRCC grid)", () => {
  const t = DB.crs!;
  it("29, bachelor's with ECA, CLB 9, 3 years foreign work = 429", () => {
    const b = computeCrs(t, { ageYears: 29, educationLevel: 4, ecaComplete: 1, clbFirst: 9, foreignWorkYears: 3 });
    expect(b).toMatchObject({ age: 110, education: 120, language: 124, transferability: 75, total: 429 });
  });
  it("foreign education counts for nothing without an ECA", () => {
    expect(computeCrs(t, { ageYears: 29, educationLevel: 4, ecaComplete: 0 }).education).toBe(0);
  });
  it("French NCLC 7 adds second-language points and the 50-point French bonus", () => {
    const b = computeCrs(t, { ageYears: 30, educationLevel: 4, ecaComplete: 1, clbFirst: 9, nclcFrench: 7, foreignWorkYears: 3 });
    expect(b).toMatchObject({ age: 105, secondLanguage: 12, additional: 50, total: 486 });
  });
  it("transferability caps at 50 per group and 100 overall", () => {
    const b = computeCrs(t, { ageYears: 31, educationLevel: 6, clbFirst: 9, foreignWorkYears: 3, canadianWorkYears: 2, canadianEducation: 1 });
    expect(b.transferability).toBe(100);
    expect(b.additional).toBe(15);
  });
  it("a provincial nomination adds 600", () => {
    expect(computeCrs(t, { ageYears: 29, pnpNomination: 1 }).additional).toBe(600);
  });
  it("age points fall after 29", () => {
    expect([29, 30, 35, 40, 45].map((a) => computeCrs(t, { ageYears: a }).age)).toEqual([110, 105, 77, 50, 0]);
  });
});

describe("Express Entry route", () => {
  it("starts at CRS 110 with no test or ECA", () => {
    expect(newRun(DB, "EXPRESS_ENTRY").routeStats.crsScore).toBe(110);
  });

  it("prepared IELTS + ECA reaches 429 but misses the CEC draw without Canadian experience", () => {
    const s = play("EXPRESS_ENTRY", ["three months first", "official express transcript", "Refresh the rounds"]);
    expect(s.routeStats.crsScore).toBe(429);
    expect(s.currentSceneId).toBe("EE_BELOW");
  });

  it("the French pivot wins an ITA, then proof of funds and documents lead to PR", () => {
    const s = play("EXPRESS_ENTRY", ["three months first", "official express transcript", "Refresh the rounds",
      "Enrol at the French institute", "Update your profile", "Refresh the rounds", "Start the application",
      "Work overtime", "Work overtime", "Submit six months", "real duties", "Queue for the certificate"]);
    expect(s.outcome).toMatchObject({ result: "win", reason: "PERMANENT_RESIDENCE" });
    expect(rankFor(DB, s)?.id).toBe("pr");
    expect(s.energy).toBeGreaterThan(0);
  });

  it("a rushed CLB 7 plus French still falls short of the French cutoff", () => {
    const s = play("EXPRESS_ENTRY", ["Book the test for Saturday", "official express transcript", "Refresh the rounds",
      "Enrol at the French institute", "Update your profile", "Refresh the rounds"]);
    expect(s.routeStats.crsScore).toBe(393);
    expect(s.currentSceneId).toBe("EE_BELOW");
  });

  it("proof of funds stays locked until savings reach CAD 15,263; borrowing is fraud", () => {
    const s = play("EXPRESS_ENTRY", ["three months first", "official express transcript", "Refresh the rounds",
      "Enrol at the French institute", "Update your profile", "Refresh the rounds", "Start the application"]);
    expect(presentChoices(DB, s).find((c) => c.text.startsWith("Submit six months"))?.enabled).toBe(false);
    const f = choose(DB, s, presentChoices(DB, s).findIndex((c) => c.text.startsWith("Borrow")));
    expect(f.outcome?.reason).toBe("MISREPRESENTATION");
  });

  it("fake IELTS papers, documents and job offers are all instant fails", () => {
    expect(play("EXPRESS_ENTRY", ["leaked paper"]).outcome?.reason).toBe("MISREPRESENTATION");
    expect(play("EXPRESS_ENTRY", ["three months first", "connect"]).outcome?.reason).toBe("MISREPRESENTATION");
    expect(play("EXPRESS_ENTRY", ["three months first", "official express", "Refresh", "'job offer'"]).outcome?.reason)
      .toBe("MISREPRESENTATION");
  });
});

describe("Student pathway", () => {
  const FUND_ALL = ["entrance scholarship", "Family sponsorship", "Sell the plot", "Crowdfund"];
  it("master's: fund it, write a specific plan, graduate with a PGWP", () => {
    const s = play("STUDY_PERMIT", ["Master's in Engineering", "Work out the money", ...FUND_ALL,
      "funds are ready", "specific plan", "Wait for the decision", "Board the flight", "proper boots",
      "host family", "Campus cafe", "Library every night", "Book IELTS"]);
    expect(s.outcome).toMatchObject({ result: "win", reason: "PGWP_ISSUED" });
    expect(rankFor(DB, s)?.id).toBe("pgwp");
  });

  it("funds below tuition + CAD 23,448 + travel send you back to the funding plan", () => {
    const s = play("STUDY_PERMIT", ["Master's in Engineering", "Work out the money", "Family sponsorship", "funds are ready"]);
    expect(s.currentSceneId).toBe("ST_FUNDS_SHORT");
  });

  it("each funding source can only be used once", () => {
    const s = play("STUDY_PERMIT", ["Master's in Engineering", "Work out the money", "Family sponsorship"]);
    expect(presentChoices(DB, s).find((c) => c.text.startsWith("Family sponsorship"))?.enabled).toBe(false);
  });

  it("a template study plan gets refused", () => {
    const s = play("STUDY_PERMIT", ["Two-year Supply Chain", "Work out the money", "entrance scholarship",
      "Family sponsorship", "funds are ready", "template", "Wait for the decision"]);
    expect(s.currentSceneId).toBe("ST_REFUSED");
    expect(s.outcome).toBeFalsy();
    expect(play("STUDY_PERMIT", ["Two-year Supply Chain", "Work out the money", "entrance scholarship",
      "Family sponsorship", "funds are ready", "template", "Wait for the decision", "same file"]).outcome?.reason).toBe("STUDY_PERMIT_REFUSED");
  });

  it("private career college graduates get no PGWP", () => {
    const s = play("STUDY_PERMIT", ["private career college", "Work out the money", "Family sponsorship",
      "funds are ready", "specific plan", "Wait for the decision", "Board the flight", "proper boots",
      "host family", "Campus cafe", "Library every night", "Book IELTS"]);
    expect(s.outcome?.reason).toBe("NOT_PGWP_ELIGIBLE");
  });

  it("working 40 cash hours a week breaches study permit conditions", () => {
    const s = play("STUDY_PERMIT", ["Two-year Supply Chain", "Work out the money", "entrance scholarship",
      "Family sponsorship", "funds are ready", "specific plan", "Wait for the decision", "Board the flight",
      "proper boots", "host family", "Cash shifts"]);
    expect(s.outcome?.reason).toBe("STATUS_BREACH");
  });

  it("fake admission letters and parked money are misrepresentation", () => {
    expect(play("STUDY_PERMIT", ["guaranteed admission letter"]).outcome?.reason).toBe("MISREPRESENTATION");
    expect(play("STUDY_PERMIT", ["Master's in Engineering", "Work out the money", "park"]).outcome?.reason)
      .toBe("MISREPRESENTATION");
  });

  it("a PGWP carries the graduate into Express Entry with Canadian education", () => {
    let app = reducer(initialState(), { type: "SELECT_ROUTE", route: "STUDY_PERMIT" });
    const picks = ["Master's in Engineering", "Work out the money", ...FUND_ALL, "funds are ready", "specific plan",
      "Wait for the decision", "Board the flight", "proper boots", "host family", "Campus cafe", "Library every night", "Book IELTS"];
    for (const p of picks) {
      const idx = presentChoices(DB, app.runs.STUDY_PERMIT!).findIndex((c) => c.text.includes(p));
      app = reducer(app, { type: "CHOOSE", index: idx, rolls: [1, 0] });
    }
    app = reducer(app, { type: "FOLLOW_UNLOCK" });
    const ee = app.runs.EXPRESS_ENTRY!;
    expect(app.activeRoute).toBe("EXPRESS_ENTRY");
    expect(ee.currentSceneId).toBe("EE_CANADA_START");
    expect(ee.routeStats).toMatchObject({ canadianEducation: 1, educationLevel: 6, clbFirst: 9 });
    // One year of Canadian work: 513, just under the 518 CEC cutoff. A second year clears it.
    let s = choose(DB, ee, 0);
    expect(s.routeStats.crsScore).toBe(513);
    s = choose(DB, s, 0); // refresh the rounds page
    expect(s.currentSceneId).toBe("EE_BELOW");
    s = choose(DB, s, presentChoices(DB, s).findIndex((c) => c.text.startsWith("Work a second year")));
    expect(s.routeStats.crsScore).toBe(521);
    s = choose(DB, s, 0);
    expect(s.currentSceneId).toBe("EE_ITA_CEC");
  });
});

describe("choice cutscenes", () => {
  const pickAndDescribe = (route: RouteId, picks: string[], last: string) => {
    const before = play(route, picks);
    const idx = presentChoices(DB, before).findIndex((c) => c.text.includes(last));
    const choice = DB.scenes[before.currentSceneId].choices![idx];
    const after = choose(DB, before, idx);
    return describeChoice(DB, before, after, choice.text, choice.label, choice.feedback ?? "");
  };

  it("a strong pitch answer is a good moment with green chips", () => {
    const c = pickAndDescribe("STARTUP_VISA", [], "interoperable bridge");
    expect(c.tone).toBe("good");
    expect(c.label).toBe("HIGH VALUE MATCH");
    expect(c.deltas.map((d) => [d.label, d.value, d.good])).toEqual([
      ["Investor Interest", 25, true], ["Scalability Score", 20, true],
    ]);
  });

  it("an arrogant answer is a bad moment", () => {
    expect(pickAndDescribe("STARTUP_VISA", [], "simply superior").tone).toBe("bad");
  });

  it("fraud is a danger moment (sirens), even before the ending text", () => {
    const c = pickAndDescribe("STUDY_PERMIT", [], "guaranteed admission letter");
    expect(c.tone).toBe("danger");
  });

  it("the final winning move is a triumph", () => {
    const c = pickAndDescribe("NIGERIA_LIFE", ["about the visa story", "Leave the call", "Book the appointment",
      "Answer every question", "call, then wait"], "Open the email");
    expect(c.tone).toBe("triumph");
  });

  it("money moves are flagged so coins fly the right way", () => {
    const loss = pickAndDescribe("NIGERIA_LIFE", ["hunt remote jobs"], "visa consultant");
    expect(loss.money).toBe("loss");
    expect(loss.deltas[0]).toMatchObject({ key: "walletNgn", value: -35000, format: "ngn" });
    const gain = pickAndDescribe("STUDY_PERMIT", ["Master's in Engineering", "Work out the money"], "Family sponsorship");
    expect(gain.money).toBe("gain");
  });

  it("a fall in Village People Interference counts as good news", () => {
    const before = newRun(DB, "NIGERIA_LIFE");
    const d = diffStats(DB, before, applyEffects(before, { desperation: -10 }));
    expect(d).toEqual([expect.objectContaining({ key: "desperation", value: -10, good: true })]);
  });

  it("bookkeeping counters never show as chips; the CRS change does", () => {
    const c = pickAndDescribe("EXPRESS_ENTRY", ["three months first"], "official express transcript");
    const keys = c.deltas.map((d) => d.key);
    expect(keys).not.toContain("ecaComplete");
    expect(c.deltas.find((d) => d.key === "crsScore")?.value).toBe(120 + 25); // education + its transferability
  });

  it("dashboard actions describe their result too", () => {
    const before = landed();
    const after = takeAction(DB, before, "job_fair", [0.99, 0]).state;
    const c = describeChoice(DB, before, after, "Attend In-Person Tech/Job Fair");
    expect(c.deltas.map((d) => d.key)).toEqual(expect.arrayContaining(["walletCad", "energy", "timeRemainingDays"]));
  });
});

describe("player profiles", () => {
  const nurse: PlayerProfile = {
    version: 1, username: "Chioma", avatar: DEFAULT_AVATAR, role: "worker", age: 28, stateCode: "EN",
    family: { heritage: "igbo", relation: "aunty", name: "Nkiru", provinceCode: "AB", city: "Calgary" },
    worker: { occupation: "nurse", years: 5, qualification: "bachelors", salary: "150k-400k" },
  };
  const fresher: PlayerProfile = {
    version: 1, username: "Musa", avatar: DEFAULT_AVATAR, role: "student", age: 19, stateCode: "KN",
    family: { heritage: "hausa", relation: "aunty", name: "Lami", provinceCode: "MB", city: "Winnipeg" },
    student: { institution: "university", course: "Computer Science", level: "200", cgpa: "2-1" },
  };

  it("a worker's profile becomes CRS inputs", () => {
    const g = deriveGameProfile(nurse);
    expect(g).toMatchObject({ educationLevel: 4, hasDegree: true, foreignWorkYears: 5 });
    expect(g.experiencePhrase).toBe("5 years as a registered nurse");
    expect(g.savingsNgn).toBe(275000 * 10);
  });

  it("an undergraduate has no degree yet and no work experience", () => {
    const g = deriveGameProfile(fresher);
    expect(g).toMatchObject({ educationLevel: 1, hasDegree: false, foreignWorkYears: 0, academicStanding: 72 });
  });

  it("an HND or NCE graduate is treated as a diploma, not a degree", () => {
    const hnd = { ...fresher, student: { ...fresher.student!, institution: "polytechnic" as const, level: "graduated" as const } };
    expect(deriveGameProfile(hnd)).toMatchObject({ educationLevel: 3, hasDegree: false });
  });

  it("the profile sets each route's starting state", () => {
    const app = initialState(DB, nurse);
    const ee = app.runs.EXPRESS_ENTRY!;
    expect(ee.routeStats).toMatchObject({ ageYears: 28, educationLevel: 4, foreignWorkYears: 5 });
    expect(ee.routeStats.crsScore).toBe(110);
    expect(play("EXPRESS_ENTRY", []).routeStats.ageYears).toBe(29); // without a profile: the default character
    expect(app.runs.NIGERIA_LIFE!.walletNgn).toBe(2000000);
    expect(app.runs.STUDY_PERMIT!.routeStats.hasDegree).toBe(1);
  });

  it("an undergraduate can't pick the master's but can pick the bachelor's", () => {
    const app = initialState(DB, fresher);
    const st = app.runs.STUDY_PERMIT!;
    const choices = presentChoices(DB, st);
    expect(choices.find((c) => c.text.startsWith("Master's"))?.enabled).toBe(false);
    expect(choices.find((c) => c.text.startsWith("Four-year bachelor's"))?.enabled).toBe(true);
  });

  it("a bachelor's in Canada carries 3+ years of Canadian education and the real age into Express Entry", () => {
    let app = reducer(initialState(DB, fresher), { type: "SELECT_ROUTE", route: "STUDY_PERMIT" });
    const picks = ["Four-year bachelor's", "Work out the money", "entrance scholarship", "Family sponsorship",
      "Sell the plot", "Crowdfund", "Education loan", "funds are ready", "specific plan", "Wait for the decision",
      "Board the flight", "proper boots", "host family", "Campus cafe", "Library every night", "Book IELTS"];
    for (const p of picks) {
      const idx = presentChoices(DB, app.runs.STUDY_PERMIT!).findIndex((c) => c.text.includes(p));
      expect(idx, p).toBeGreaterThanOrEqual(0);
      app = reducer(app, { type: "CHOOSE", index: idx, rolls: [1, 0] });
    }
    expect(app.runs.STUDY_PERMIT!.outcome?.reason).toBe("PGWP_ISSUED");
    app = reducer(app, { type: "FOLLOW_UNLOCK" });
    expect(app.runs.EXPRESS_ENTRY!.routeStats).toMatchObject({ ageYears: 24, canadianEducation: 2, educationLevel: 4, foreignWorkYears: 0 });
  });

  it("sign out (no profile) goes back to the default character", () => {
    const app = reducer(initialState(DB, nurse), { type: "SET_PROFILE", profile: null });
    expect(app.profile).toBeNull();
    expect(app.runs.EXPRESS_ENTRY!.routeStats.ageYears).toBe(29);
  });

  it("validates usernames and profiles", () => {
    expect(usernameProblem("A")).toBeTruthy();
    expect(usernameProblem("9lives")).toBeTruthy();
    expect(usernameProblem("Tolu_99")).toBeNull();
    expect(profileProblem(nurse)).toBeNull();
    expect(profileProblem({ ...nurse, age: 12 })).toBeTruthy();
  });
});

describe("Nigeria localisation", () => {
  it("covers all 36 states and the FCT", () => {
    expect(STATES).toHaveLength(37);
    expect(new Set(STATES.map((s) => s.code)).size).toBe(37);
  });

  it("every scene, choice and rank fills completely for every state", () => {
    const problems: string[] = [];
    for (const st of STATES) {
      const vars = { ...profileVars({ ...{ version: 1, username: "Ada", avatar: DEFAULT_AVATAR, role: "worker", age: 30, stateCode: st.code,
        worker: { occupation: "nurse", years: 2, qualification: "bachelors", salary: "400k-1m" } } } as PlayerProfile), crs: "110" };
      const texts: string[] = [];
      for (const s of Object.values(DB.scenes)) {
        texts.push(s.title ?? "", s.location ?? "", s.dialogue ?? "", s.speaker ?? "");
        for (const c of s.choices ?? []) texts.push(c.text, c.feedback ?? "");
      }
      for (const r of Object.values(DB.routes)) {
        texts.push(r.tagline ?? "", r.title);
        for (const k of r.ranks ?? []) texts.push(k.title, k.blurb);
      }
      for (const t of texts) {
        const out = fillText(t, vars);
        if (/\{\w+\}/.test(out)) problems.push(`${st.code}: ${out.slice(0, 60)}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("no Lagos-only place names are left in the story text", () => {
    const blob = JSON.stringify(Object.values(DB.scenes).map((s) => [s.title, s.location, s.dialogue, (s.choices ?? []).map((c) => c.text)]));
    for (const w of ["Yaba", "Ikeja", "Surulere", "Computer Village", "Victoria Island"]) expect(blob).not.toContain(w);
  });

  it("places use local transport and the nearest visa centre", () => {
    expect(placeVars(placeFor("LA"))).toMatchObject({ city: "Lagos", area: "Yaba", bus: "danfo", vacCity: "Lagos", vacTrip: "across Lagos" });
    expect(placeVars(placeFor("KN"))).toMatchObject({ city: "Kano", bus: "keke", vacCity: "Abuja", vacTrip: "the overnight bus to Abuja" });
    expect(placeVars(placeFor("FC"))).toMatchObject({ city: "Abuja", bus: "bus", vacCity: "Abuja" });
    expect(vacCityFor(placeFor("RI"))).toBe("Lagos");
    expect(fillText("{Bus} to {techHub}", placeVars(placeFor("EN")))).toBe("Keke to the phone and laptop market in Enugu");
  });
});

describe("Kawosoke (asylum claims inside the Tourist Gamble)", () => {
  const borno = { version: 1, username: "Hauwa", avatar: DEFAULT_AVATAR, role: "worker", age: 27, stateCode: "BO",
    worker: { occupation: "teacher", years: 3, qualification: "bachelors", salary: "150k-400k" } } as PlayerProfile;
  const tourist = (profile: PlayerProfile | null = null) => initialState(DB, profile).runs.TOURIST_GAMBLE!;
  function walk(s: GameState, picks: string[]): GameState {
    for (const pick of picks) {
      const idx = presentChoices(DB, s).findIndex((c) => fillText(c.text, profileVars(null)).includes(pick) || c.text.includes(pick));
      expect(idx, `choice containing "${pick}" at ${s.currentSceneId}`).toBeGreaterThanOrEqual(0);
      s = dismissPopup(choose(DB, s, idx, [1, 0]));
    }
    return s;
  }
  const STRONG = ["Legal Aid", "Gather evidence", "line by line", "say 'I don't remember'", "Explain, with your evidence"];

  it("lands at Pearson: the truth leads to the dashboard, a fake conference is misrepresentation", () => {
    expect(tourist().currentSceneId).toBe("TOURIST_ARRIVAL");
    expect(walk(tourist(), ["Tell the truth"]).currentSceneId).toBe("TOURIST_HUB");
    expect(walk(tourist(), ["conference you never registered"]).outcome?.reason).toBe("MISREPRESENTATION");
  });

  it("the mentor is Wey Sabi, and the dashboard can open an inland claim", () => {
    const actions = DB.scenes.TOURIST_HUB.dashboard!.actions;
    expect(actions.find((a) => a.id === "mentor_coffee")?.label).toBe("Coffee Chat with a Naija-Canadian Mentor Wey Sabi");
    const { state } = takeAction(DB, landed(), "kawosoke", [0.99, 0]);
    expect(state.currentSceneId).toBe("KW_INLAND");
    expect(state.timeRemainingDays).toBe(179);
  });

  it("a real story, told straight with evidence, ends in protection", () => {
    const s = walk(tourist(), ["Kawosoke at the counter", "you were outed", ...STRONG]);
    expect(s.routeStats.kwAtAirport).toBe(1);
    expect(s.outcome).toMatchObject({ result: "win", reason: "PROTECTED_PERSON" });
  });

  it("a real gender-based claim without enough evidence loses on internal flight alternative", () => {
    const thin = walk(tourist(), ["Kawosoke at the counter", "beatings from your husband", "Legal Aid", "Work legally",
      "line by line", "say 'I don't remember'", "Explain, with your evidence"]);
    expect(thin.outcome?.reason).toBe("IFA_FOUND");
    const strong = walk(tourist(), ["Kawosoke at the counter", "beatings from your husband", ...STRONG]);
    expect(strong.outcome?.reason).toBe("PROTECTED_PERSON");
  });

  it("embellishing and posting on TikTok sink a real claim on credibility", () => {
    const s = walk(tourist(), ["Kawosoke at the counter", "you were outed", "Legal Aid", "TikTok", "Memorize",
      "Add a new detail"]);
    expect(s.outcome?.reason).toBe("CLAIM_REFUSED");
  });

  it("a bought story is exposed even with perfect answers, and walking away keeps the run alive", () => {
    const bought = walk(landed(), []);
    const inland = takeAction(DB, bought, "kawosoke", [0.99, 0]).state;
    const s = walk(inland, ["ready-made story", "File it anyway", ...STRONG.slice(0, 4)]);
    expect(s.outcome).toMatchObject({ result: "fail", reason: "MISREPRESENTATION" });
    const out = walk(takeAction(DB, landed(), "kawosoke", [0.99, 0]).state, ["ready-made story", "Walk out", "Back to the job hunt"]);
    expect(out.currentSceneId).toBe("TOURIST_HUB");
    expect(out.outcome).toBeFalsy();
    expect(out.walletCad).toBe(landed().walletCad - 20 - 1500);
  });

  it("village people are not a Convention ground; flying home ends the claim", () => {
    expect(walk(tourist(), ["Kawosoke at the counter", "Village people", ...STRONG.slice(0, 4)]).outcome?.reason).toBe("NO_NEXUS");
    expect(walk(tourist(), ["Kawosoke at the counter", "you were outed", "Legal Aid", "Fly home"]).outcome?.reason).toBe("CLAIM_ABANDONED");
  });

  it("the conflict claim is only open to players from affected states", () => {
    const pick = (s: GameState) => presentChoices(DB, walk(s, ["Kawosoke at the counter"])).find((c) => c.label === "CONFLICT_CLAIM")!;
    expect(pick(tourist()).enabled).toBe(false);
    expect(pick(tourist(borno)).enabled).toBe(true);
    expect(walk(tourist(borno), ["Kawosoke at the counter", "gunmen attacked", ...STRONG]).outcome?.reason).toBe("PROTECTED_PERSON");
  });

  it("claim-only events never strike before a claim is filed", () => {
    const s = choose(DB, tourist(), 0, [0, 0]);
    expect(s.popup).toBeNull();
    const filed = choose(DB, walk(tourist(), ["Kawosoke at the counter", "you were outed"]), 0, [0, 0]);
    expect(filed.popup?.kind).toBe("trap");
  });

  it("every ending has a rank", () => {
    const reasons = Object.values(DB.scenes).filter((s) => s.route === "TOURIST_GAMBLE" && s.outcome).map((s) => s.outcome!.reason);
    for (const r of reasons) expect(DB.routes.TOURIST_GAMBLE.ranks!.some((k) => k.reason === r), r).toBe(true);
  });
});

describe("2026 rules in Express Entry and the Student pathway", () => {
  it("healthcare and trades workers can be invited in category draws below the general cutoff", () => {
    // Master's, CLB 9, ECA, 3 years abroad, age 29: 469, or 484 with a sibling in Canada.
    const base = newRun(DB, "EXPRESS_ENTRY");
    const at = (eeCategory: number, siblingInCanada: number) => enterScene(DB, { ...base, routeStats: {
      ...base.routeStats, ageYears: 29, educationLevel: 6, ecaComplete: 1, clbFirst: 9, foreignWorkYears: 3, siblingInCanada, eeCategory,
    } }, "EE_DRAW");
    expect(at(1, 1).routeStats.crsScore).toBe(484);
    expect(at(1, 1).currentSceneId).toBe("EE_ITA_HEALTH");
    expect(at(3, 1).currentSceneId).toBe("EE_ITA_TRADES");
    expect(at(2, 1).currentSceneId).toBe("EE_BELOW");
    expect(at(1, 0).currentSceneId).toBe("EE_BELOW"); // 469: one point short of the healthcare cutoff
  });

  it("the profile sets the category from the job", () => {
    const nurse = { version: 1, username: "Chioma", avatar: DEFAULT_AVATAR, role: "worker", age: 28, stateCode: "EN",
      worker: { occupation: "nurse", years: 5, qualification: "bachelors", salary: "150k-400k" } } as PlayerProfile;
    expect(initialState(DB, nurse).runs.EXPRESS_ENTRY!.routeStats.eeCategory).toBe(1);
    expect(initialState(DB, { ...nurse, worker: { ...nurse.worker!, occupation: "electrician" } }).runs.EXPRESS_ENTRY!.routeStats.eeCategory).toBe(3);
  });

  it("no language test, no PGWP", () => {
    const s = play("STUDY_PERMIT", ["Master's in Engineering", "Work out the money", "entrance scholarship", "Family sponsorship",
      "Sell the plot", "Crowdfund", "Education loan", "funds are ready", "specific plan", "Wait for the decision",
      "Board the flight", "proper boots", "host family", "Campus cafe", "Library every night", "Skip it"]);
    expect(s.outcome).toMatchObject({ result: "fail", reason: "NOT_PGWP_ELIGIBLE" });
  });
});

describe("family in Canada", () => {
  const sister: Relative = { heritage: "yoruba", relation: "sister", name: "Folake", provinceCode: "NS", city: "Halifax" };

  it("guesses heritage from the username, then from the state", () => {
    for (const n of ["Chidike", "Chidike_01", "Chioma", "Oluchi", "Nnamdi", "Obiora", "Ugochi", "Chukwuemeka"]) expect(detectHeritage(n), n).toBe("igbo");
    for (const n of ["Tolu", "Adebayo", "Olawale", "Funmilayo", "Oluwaseun", "Ayomide", "Ifeoluwa"]) expect(detectHeritage(n), n).toBe("yoruba");
    for (const n of ["Musa", "Abdullahi", "Aisha", "Muhammadu", "Adamu"]) expect(detectHeritage(n), n).toBe("hausa");
    expect(detectHeritage("Daniel", "SE")).toBe("igbo");
    expect(detectHeritage("Daniel", "SW")).toBe("yoruba");
    expect(detectHeritage("Daniel", "NW")).toBe("hausa");
    expect(detectHeritage("Daniel", "SS")).toBe("other");
  });

  it("an Igbo player calls an Igbo relative, a Yoruba player a Yoruba one, wherever they live", () => {
    for (const st of STATES) {
      const igbo = familyFor({ username: "Chidike", stateCode: st.code });
      expect(igbo.heritage).toBe("igbo");
      expect(RELATIVE_NAMES.igbo[igbo.relation]).toContain(igbo.name);
      const yoruba = familyFor({ username: "Adebayo", stateCode: st.code });
      expect(yoruba.heritage).toBe("yoruba");
      expect(RELATIVE_NAMES.yoruba[yoruba.relation]).toContain(yoruba.name);
    }
  });

  it("relatives come from the right name pool, live in a real province and never share the player's name", () => {
    for (const h of Object.keys(RELATIVE_NAMES) as Heritage[]) {
      for (const rel of ["sister", "brother", "aunty"] as Relation[]) {
        for (let i = 0; i < 40; i++) {
          const r = makeRelative(h, seededRandom(`${h}${rel}${i}`), rel, "Ngozi");
          expect(RELATIVE_NAMES[h][rel]).toContain(r.name);
          expect(r.name).not.toBe("Ngozi");
          expect(provinceFor(r.provinceCode).cities).toContain(r.city);
        }
      }
    }
  });

  it("provinces are picked at random across Canada, and the same profile keeps the same relative", () => {
    const seen = new Set(Array.from({ length: 300 }, (_, i) => familyFor({ username: `Player${i}`, stateCode: "LA" }).provinceCode));
    expect(seen.size).toBeGreaterThanOrEqual(8);
    expect(familyFor({ username: "Chidike", stateCode: "AN" })).toEqual(familyFor({ username: "Chidike", stateCode: "AN" }));
    expect(PROVINCES.flatMap((p) => p.cities)).not.toContain("London");
  });

  it("fills names, places and pronouns", () => {
    const v = relativeVars(sister);
    expect(v).toMatchObject({ relName: "Folake", relTitle: "Sister Folake", RelWho: "Your sister Folake", relPlace: "Halifax, Nova Scotia", relSubj: "she", relGap: "five hours behind" });
    expect(relativeVars({ ...sister, relation: "brother", name: "Tunde" })).toMatchObject({ relTitle: "Brother Tunde", relObj: "him", RelPoss: "His" });
    expect(relativeVars({ ...sister, relation: "aunty", name: "Bisi" })).toMatchObject({ relName: "Aunty Bisi", RelWho: "Your Aunty Bisi" });
    expect(relativeVars({ ...sister, provinceCode: "NL", city: "St. John's" }).relGap).toBe("four and a half hours behind");
  });

  it("the story calls Canada, flies to Pearson and has no London left", () => {
    const blob = JSON.stringify(DB);
    for (const w of ["Ada", "Peckham", "Heathrow", "London", "Berlin", "Tolu"]) expect(blob, w).not.toMatch(new RegExp(`\\b${w}\\b`));
    expect(blob).toContain("Pearson");
    const dawn = DB.scenes.LAGOS_YABA_DAWN;
    const chidike = { version: 1, username: "Chidike", avatar: DEFAULT_AVATAR, role: "worker", age: 30, stateCode: "AN", family: { ...sister, heritage: "igbo", name: "Adaeze", provinceCode: "AB", city: "Calgary" },
      worker: { occupation: "engineer", years: 4, qualification: "bachelors", salary: "400k-1m" } } as PlayerProfile;
    expect(fillText(dawn.dialogue ?? "", profileVars(chidike))).toContain("Your sister Adaeze in Calgary sent three missed calls");
    expect(fillText(DB.scenes.LAGOS_AUNTY_CALL.dialogue ?? "", profileVars(chidike))).toContain("Bring your own proof, Chidike, or don't come and disgrace me at Pearson.");
  });

  it("a sister or brother in Canada adds 15 CRS points; an aunty does not", () => {
    const base = { version: 1, username: "Kemi", avatar: DEFAULT_AVATAR, role: "worker", age: 28, stateCode: "OY",
      worker: { occupation: "nurse", years: 5, qualification: "bachelors", salary: "150k-400k" } } as PlayerProfile;
    const withSister = initialState(DB, { ...base, family: sister }).runs.EXPRESS_ENTRY!.routeStats;
    const withAunty = initialState(DB, { ...base, family: { ...sister, relation: "aunty", name: "Bisi" } }).runs.EXPRESS_ENTRY!.routeStats;
    expect(withSister.siblingInCanada).toBe(1);
    expect(withAunty.siblingInCanada).toBe(0);
    expect(withSister.crsScore! - withAunty.crsScore!).toBe(15);
  });
});

describe("Year One in Canada and community-story scenes", () => {
  const year = (picks: string[]) => play("FIRST_YEAR", picks);

  it("networking, bridging and help in winter get you back in your field", () => {
    const s = year(["SIN at the airport", "guarantor from church", "Volunteer two days", "bridging program", "fixed share",
      "Nigerian association", "Employment Insurance", "Stay. Save"]);
    expect(s.routeStats.careerScore).toBeGreaterThanOrEqual(50);
    expect(s.outcome).toMatchObject({ result: "win", reason: "BACK_IN_FIELD" });
  });

  it("a parked career with savings is 'surviving'; going home is 'reverse japa'", () => {
    const parked = year(["SIN at the airport", "guarantor from church", "warehouse survival job", "Drive Uber", "fixed share",
      "Nigerian association", "any shift", "Stay. Save"]);
    expect(parked.outcome?.reason).toBe("SURVIVING");
    const home = year(["SIN at the airport", "guarantor from church", "warehouse survival job", "Drive Uber", "fixed share",
      "Nigerian association", "any shift", "Go home for good"]);
    expect(home.outcome).toMatchObject({ result: "neutral", reason: "REVERSE_JAPA" });
  });

  it("a rental scam and an empty account end the year early", () => {
    const s = year(["best phone plan", "Facebook 'landlord'", "Only apply for jobs at your old level", "bridging program",
      "Send all of it", "Stay inside", "cheaper province", "Go home for December as an IJGB"]);
    expect(s.outcome?.reason).toBe("BURNOUT");
  });

  it("permanent residence and refugee protection both lead into Year One", () => {
    let app = reducer(initialState(), { type: "SELECT_ROUTE", route: "TOURIST_GAMBLE" });
    for (const pick of ["Kawosoke at the counter", "you were outed", "Legal Aid", "Gather evidence", "line by line",
      "say 'I don't remember'", "Explain, with your evidence"]) {
      const idx = presentChoices(DB, app.runs.TOURIST_GAMBLE!).findIndex((c) => c.text.includes(pick));
      app = reducer(app, { type: "CHOOSE", index: idx, rolls: [1, 0] });
    }
    app = reducer(app, { type: "FOLLOW_UNLOCK" });
    expect(app.activeRoute).toBe("FIRST_YEAR");
    expect(app.runs.FIRST_YEAR!.currentSceneId).toBe("FY_HOUSING");
    expect(DB.scenes.EE_COPR.unlocksRoute).toBe("FIRST_YEAR");
  });

  it("a refused student who reads the GCMS notes can fix the plan and get approved", () => {
    const s = play("STUDY_PERMIT", ["Two-year Supply Chain", "Work out the money", "entrance scholarship",
      "Family sponsorship", "funds are ready", "template", "Wait for the decision", "GCMS notes", "specific plan", "Wait for the decision"]);
    expect(s.currentSceneId).toBe("ST_APPROVED");
    const scam = play("STUDY_PERMIT", ["Two-year Supply Chain", "Work out the money", "entrance scholarship",
      "Family sponsorship", "funds are ready", "template", "Wait for the decision", "guaranteed visa"]);
    expect(scam.outcome?.reason).toBe("MISREPRESENTATION");
  });

  it("a copied reference letter brings a PFL: answer it and land, ignore it and lose the ITA", () => {
    const start = ["three months first", "official express transcript", "Refresh the rounds",
      "Enrol at the French institute", "Update your profile", "Refresh the rounds", "Start the application",
      "Family gift", "Submit six months", "Copy the NOC duties"];
    const answered = play("EXPRESS_ENTRY", [...start, "Queue for the certificate", "Hire a licensed consultant"]);
    expect(answered.outcome?.reason).toBe("PERMANENT_RESIDENCE");
    expect(play("EXPRESS_ENTRY", [...start, "police portal is down", "Ignore it"]).outcome?.reason).toBe("PFL_IGNORED");
  });

  it("paying for an LMIA is a scam; checking it costs nothing", () => {
    const seller = takeAction(DB, landed(), "lmia_whatsapp", [0.99, 0]).state;
    expect(seller.currentSceneId).toBe("TR_LMIA_SELLER");
    expect(play2(seller, ["Pay the first"]).outcome?.reason).toBe("LMIA_SCAM");
    expect(play2(seller, ["Ask for the employer's legal name"]).currentSceneId).toBe("TOURIST_HUB");
  });

  it("a claimant who works cash before the permit is caught", () => {
    const s = play2(newRun(DB, "TOURIST_GAMBLE"), ["Kawosoke at the counter", "you were outed", "Legal Aid", "cash warehouse job"]);
    expect(s.outcome?.reason).toBe("UNAUTHORIZED_WORK");
  });
});

describe("levels", () => {
  it("every playable route has levels, and every level scene exists in its route, once", () => {
    for (const r of Object.keys(DB.routes) as RouteId[]) {
      if (DB.routes[r].status !== "playable") continue;
      const levels = levelsFor(DB, r);
      expect(levels.length, r).toBeGreaterThanOrEqual(2);
      const seen = new Set<string>();
      for (const l of levels) {
        expect(l.scenes.length, `${r}/${l.id}`).toBeGreaterThan(0);
        for (const id of l.scenes) {
          expect(DB.scenes[id]?.route, `${r}/${l.id}: ${id}`).toBe(r);
          expect(seen.has(id), `${id} in two levels`).toBe(false);
          seen.add(id);
        }
        expect((l.stars ?? []).length).toBeLessThanOrEqual(2);
      }
      expect(levelIndexOf(DB, r, DB.routes[r].startSceneId!), `${r} starts in level 1`).toBe(0);
    }
  });

  it("moving into the next level completes the last one, with stars", () => {
    const before = play("NIGERIA_LIFE", ["about the visa story"]);
    const after = play("NIGERIA_LIFE", ["about the visa story", "Leave the call"]);
    expect(levelIndexOf(DB, "NIGERIA_LIFE", before.currentSceneId)).toBe(0);
    const p = levelProgress(DB, before, after);
    expect(p).toMatchObject({ from: 0, to: 1, entered: 1 });
    expect(p.completed?.index).toBe(0);
    expect(p.completed?.stars).toBeGreaterThanOrEqual(1);
    expect(p.completed?.stars).toBeLessThanOrEqual(3);
  });

  it("stepping back to an earlier scene doesn't lose the level", () => {
    const deep = play("NIGERIA_LIFE", ["hunt remote jobs", "Rewrite the CV"]);
    const back = levelProgress(DB, undefined, deep);
    expect(back.to).toBe(1);
  });

  it("a win completes the level it ended in; stars count the targets met", () => {
    const run = play("STARTUP_VISA", []);
    const lvl = levelsFor(DB, "STARTUP_VISA")[0];
    expect(starsFor(lvl, { ...run, routeStats: { ...run.routeStats, investorInterest: 90, scalabilityScore: 90 } })).toBe(3);
    expect(starsFor(lvl, { ...run, routeStats: { ...run.routeStats, investorInterest: 0, scalabilityScore: 0 } })).toBe(1);
  });

  it("replaying a level restores the saved run", () => {
    const snap = play("EXPRESS_ENTRY", ["three months first"]);
    let app = reducer(initialState(), { type: "SELECT_ROUTE", route: "STUDY_PERMIT" });
    app = reducer(app, { type: "LOAD_RUN", run: snap });
    expect(app.activeRoute).toBe("EXPRESS_ENTRY");
    expect(app.runs.EXPRESS_ENTRY).toBe(snap);
    expect(reducer(app, { type: "LOAD_RUN", run: { ...snap, currentSceneId: "NOPE" } })).toBe(app);
  });
});

describe("music", () => {
  it("every groove is a full 16-step bar with chords", () => {
    for (const [mood, g] of Object.entries(GROOVES)) {
      for (const k of ["kick", "clap", "shaker", "talk", "bass", "arp"] as const) expect(g[k].length, `${mood}.${k}`).toBe(16);
      if (g.log) expect(g.log.length).toBe(16);
      if (g.keys) expect(g.keys.length).toBe(16);
      if (g.horns) expect(g.horns.length).toBe(16);
      expect(g.chords.length).toBeGreaterThan(0);
      expect(g.bpm).toBeGreaterThan(60);
    }
  });

  it("the music follows the story: Lagos groove, amapiano hustle, tension at the hearing, a fanfare or a lament at the end", () => {
    expect(moodFor(DB, newRun(DB, "NIGERIA_LIFE"))).toBe("lagos");
    expect(moodFor(DB, landed())).toBe("hustle");
    expect(moodFor(DB, play2(newRun(DB, "TOURIST_GAMBLE"), ["Kawosoke at the counter"]))).toBe("tension");
    expect(moodFor(DB, newRun(DB, "STARTUP_VISA"))).toBe("pitch");
    expect(moodFor(DB, play("EXPRESS_ENTRY", ["leaked"]))).toBe("somber");
    expect(moodFor(DB, newRun(DB, "FIRST_YEAR"))).toBe("hustle");
  });
});

describe("endings cabinet and reality checks", () => {
  it("lists every playable ending once, including the dashboard's own", () => {
    const e = allEndings(DB);
    expect(new Set(e.map((x) => x.key)).size).toBe(e.length);
    expect(e.some((x) => x.key === "TOURIST_GAMBLE:STAY_EXPIRED")).toBe(true);
    expect(e.some((x) => x.key === "EXPRESS_ENTRY:EE_COPR" && x.result === "win")).toBe(true);
  });

  it("keys a finished run by its ending scene, or by reason on the dashboard", () => {
    const fraud = play("EXPRESS_ENTRY", ["leaked"]);
    expect(endingKey(DB, fraud)).toBe("EXPRESS_ENTRY:EE_FRAUD_IELTS");
    const expired = takeAction(DB, { ...landed(), timeRemainingDays: 1 }, "rest", [0.99, 0]).state;
    expect(endingKey(DB, expired)).toBe("TOURIST_GAMBLE:STAY_EXPIRED");
    expect(endingKey(DB, newRun(DB, "EXPRESS_ENTRY"))).toBeNull();
  });

  it("every ending teaches something", () => {
    const missing = allEndings(DB).filter((e) => !e.lesson).map((e) => e.key);
    expect(missing).toEqual([]);
    const expired = takeAction(DB, { ...landed(), timeRemainingDays: 1 }, "rest", [0.99, 0]).state;
    expect(lessonFor(DB, expired)).toBeTruthy();
  });
});

describe("helpers", () => {
  it("clamps energy and desperation, never lets wallets go negative", () => {
    const s = applyEffects(newRun(DB, "TOURIST_GAMBLE"), { energy: 500, desperation: -500, walletCad: -1e9 });
    expect([s.energy, s.desperation, s.walletCad]).toEqual([100, 0, 0]);
  });
  it("a missing scene is reported, not thrown", () => {
    const s = enterScene(DB, newRun(DB, "STARTUP_VISA"), "NOPE");
    expect(s.outcome?.reason).toBe("MISSING_SCENE:NOPE");
  });
  it("formats labels with acronyms", () => {
    expect(formatLabel("HIGH ROI MATCH")).toBe("High ROI match");
    expect(formatLabel("ARROGANCE_TRAP")).toBe("Arrogance trap");
  });
  it("stat keys type-check", () => {
    const k: StatKey = "employerLeads";
    expect(k).toBe("employerLeads");
  });
});
