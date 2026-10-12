import { describe, expect, it } from "vitest";
import {
  DB, applyEffects, applyMarketShock, choose, computeCrs, dismissPopup, enterScene, explainResolution, formatLabel, newRun,
  presentChoices, rankFor, takeAction, thresholdsFor, trapChance,
} from "./engine";
import { STAGES } from "../app/components/stages";
import { describeChoice, diffStats } from "./cinematic";
import { initialState, makeReducer } from "./machine";
import type { GameState, RouteId, StatKey } from "./types";

const reducer = makeReducer();

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
    ]);
    const bad: string[] = [];
    for (const s of Object.values(DB.scenes)) {
      const maps = [s.onEnter, ...(s.choices ?? []).map((c) => c.effects), ...(s.dashboard?.actions ?? []).map((a) => a.effects)];
      for (const c of s.choices ?? []) maps.push(c.set);
      for (const m of maps) for (const k of Object.keys(m ?? {})) if (!known.has(k)) bad.push(`${s.id}: ${k}`);
      for (const b of s.branch ?? []) for (const k of Object.keys(b.when ?? {})) if (!known.has(k)) bad.push(`${s.id}: ${k}`);
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
    const { state, toast } = act(newRun(DB, "TOURIST_GAMBLE"), "job_fair");
    expect(state).toMatchObject({ timeRemainingDays: 179, energy: 70, walletCad: 2500 - 25 - 20, desperation: 22 });
    expect(state.routeStats.networkScore).toBe(8);
    expect(state.currentLocation).toContain("Convention Centre");
    expect(toast?.text).toContain("tote bags");
  });

  it("a lucky roll lands a lead and lowers desperation", () => {
    const { state, toast } = act(newRun(DB, "TOURIST_GAMBLE"), "cold_message", 0);
    expect(state.routeStats.employerLeads).toBe(1);
    expect(state.desperation).toBe(25 + 2 - 10);
    expect(toast).toMatchObject({ title: "Employer lead!", tone: "good" });
  });

  it("actions you can't afford in energy do nothing", () => {
    const s = { ...newRun(DB, "TOURIST_GAMBLE"), energy: 10 };
    expect(act(s, "job_fair").toast).toBeNull();
    expect(act(s, "rest").state.energy).toBe(50);
  });

  it("the cash job is an instant fail", () => {
    const { state } = act(newRun(DB, "TOURIST_GAMBLE"), "cash_job");
    expect(state.outcome).toMatchObject({ result: "fail", reason: "UNAUTHORIZED_WORK" });
    expect(act(state, "rest").toast).toBeNull();
  });

  it("running out the clock loses", () => {
    const s = { ...newRun(DB, "TOURIST_GAMBLE"), timeRemainingDays: 1 };
    expect(act(s, "rest").state.outcome?.reason).toBe("STAY_EXPIRED");
  });
});

describe("state machine", () => {
  it("lists only playable routes and opens on Lagos Life", () => {
    const app = initialState();
    expect(Object.keys(app.runs).sort()).toEqual(
      ["CAREGIVER_LMIA", "EXPRESS_ENTRY", "LAGOS_LIFE", "STARTUP_VISA", "STUDY_PERMIT", "TOURIST_GAMBLE"]);
    expect(app.activeRoute).toBe("LAGOS_LIFE");
    expect(reducer(app, { type: "SELECT_ROUTE", route: "PNP_RURAL" })).toBe(app);
  });

  it("keeps each route's progress when switching", () => {
    let app = reducer(initialState(), { type: "SELECT_ROUTE", route: "STARTUP_VISA" });
    app = reducer(app, { type: "CHOOSE", index: 1 });
    app = reducer(app, { type: "SELECT_ROUTE", route: "TOURIST_GAMBLE" });
    app = reducer(app, { type: "TAKE_ACTION", actionId: "resume", rolls: [0.9, 0] });
    expect(app.toast?.id).toBe(1);
    app = reducer(app, { type: "SELECT_ROUTE", route: "STARTUP_VISA" });
    expect(app.runs.STARTUP_VISA?.currentSceneId).toBe("SUV_PITCH_CHEN");
    expect(app.runs.TOURIST_GAMBLE?.routeStats.resumeScore).toBe(15);
    expect(app.toast).toBeNull();
  });

  it("winning the tourist gamble unlocks Kovacs and carries desperation over", () => {
    let app = reducer(initialState(), { type: "SELECT_ROUTE", route: "TOURIST_GAMBLE" });
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
    app = reducer(app, { type: "TAKE_ACTION", actionId: "resume", rolls: [0.9, 0] });
    app = reducer(app, { type: "SELECT_ROUTE", route: "STARTUP_VISA" });
    app = reducer(app, { type: "RESTART" });
    expect(app.runs.STARTUP_VISA?.currentSceneId).toBe("SUV_PITCH_START");
    expect(app.runs.TOURIST_GAMBLE?.routeStats.resumeScore).toBe(15);
  });
});

describe("Lagos Life (merged from the Cursor build)", () => {
  const HONEST = ["Call Sister Ada", "Leave the call", "Book the appointment", "Answer every question",
    "Pick Ada's call", "Open the email"];

  it("starts in Yaba with the original meters (hope 64 = interference 36)", () => {
    const s = newRun(DB, "LAGOS_LIFE");
    expect(s.currentSceneId).toBe("LAGOS_YABA_DAWN");
    expect(s).toMatchObject({ walletNgn: 280000, energy: 72, desperation: 36 });
    expect(s.routeStats.papers).toBe(18);
  });

  it("the remote-job path runs out of energy (original balance, kept on purpose)", () => {
    const s = play("LAGOS_LIFE", ["Danfo to Computer Village", "Rewrite the CV", "Take the interview",
      "Use the offer as the spine", "Answer every question", "Pick Ada's call", "Open the email"]);
    expect(s.outcome?.result).toBe("fail");
    expect(s.energy).toBeLessThanOrEqual(12);
  });

  it("a borrowed bank statement is an instant fail", () => {
    const s = play("LAGOS_LIFE", ["Call Sister Ada", "Ask her to lend", "friend's statement"]);
    expect(s.outcome).toMatchObject({ result: "fail", reason: "MISREPRESENTATION" });
    expect(rankFor(DB, s)?.id).toBe("flagged");
  });

  it("the honest annex path wins and ranks Vanier Scholar", () => {
    const s = play("LAGOS_LIFE", HONEST);
    expect(s.outcome).toMatchObject({ result: "win", reason: "JAPA_APPROVED", decidedBy: "LAGOS_RESOLVE" });
    expect(rankFor(DB, s)?.id).toBe("vanier");
  });

  it("over-explaining at the embassy still loses on papers", () => {
    const s = play("LAGOS_LIFE", ["Danfo to Computer Village", "Danfo to the visa consultant", "Pay 'facilitation'",
      "Over-explain", "Pick Ada's call", "Open the email"]);
    expect(s.outcome?.result).toBe("fail");
    expect(s.currentSceneId).toBe("LAGOS_ENDING_STAY");
    expect(["pearson", "village", "hustle"]).toContain(rankFor(DB, s)?.id);
  });

  it("paying the consultant floats -$1,500 CAD", () => {
    const s = play("LAGOS_LIFE", ["Danfo to Computer Village", "Danfo to the visa consultant"]);
    expect(s.cadFloat).toEqual({ amount: 1500, tick: 1 });
  });

  it("trap chance rises with interference, as in the original formula", () => {
    const s = newRun(DB, "LAGOS_LIFE");
    expect(trapChance(DB, s)).toBeCloseTo(0.05 + Math.pow(0.36, 1.65) * 0.72, 6);
    expect(trapChance(DB, { ...s, desperation: 100 })).toBeCloseTo(0.77, 6);
    expect(trapChance(DB, newRun(DB, "STARTUP_VISA"))).toBe(0);
  });

  it("a trap applies its hit, shows a pop-up and blocks moves until dismissed", () => {
    const start = newRun(DB, "LAGOS_LIFE");
    const s = choose(DB, start, 0, [0, 0]);
    expect(s.popup).toMatchObject({ kind: "trap", id: "ielts" });
    expect(s.desperation).toBe(36 - 6 + 16);
    expect(s.routeStats.papers).toBe(18 - 14);
    expect(choose(DB, s, 0)).toBe(s);
    expect(dismissPopup(s).popup).toBeNull();
  });

  it("traps never fire on the move into the ending", () => {
    let s = play("LAGOS_LIFE", HONEST.slice(0, -1));
    s = choose(DB, s, 0, [0, 0]);
    expect(s.popup).toBeNull();
    expect(s.outcome).not.toBeNull();
  });

  it("any meter running out collapses the run", () => {
    const broke = { ...newRun(DB, "LAGOS_LIFE"), walletNgn: 1000 };
    const s = choose(DB, broke, 1); // call Ada costs N2,000
    expect(s.currentSceneId).toBe("LAGOS_ENDING_STAY");
    expect(s.outcome?.result).toBe("fail");
  });

  it("the parallel-market shock cuts cash and papers by 25%", () => {
    const s = applyMarketShock(DB, newRun(DB, "LAGOS_LIFE"));
    expect(s.walletNgn).toBe(210000);
    expect(s.routeStats.papers).toBe(13);
    expect(s.popup?.kind).toBe("market");
    expect(applyMarketShock(DB, s)).toBe(s);
    expect(applyMarketShock(DB, newRun(DB, "STARTUP_VISA")).popup).toBeNull();
  });

  it("papers stay within 0-100", () => {
    const s = applyEffects(newRun(DB, "LAGOS_LIFE"), { papers: 500 });
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
    const { state } = takeAction(DB, newRun(DB, "TOURIST_GAMBLE"), "mentor_coffee", [0.99, 0]);
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
      "Work overtime", "Work overtime", "Submit six months", "Queue for the certificate"]);
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
      "Campus cafe", "Library every night"]);
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
    expect(s.outcome?.reason).toBe("STUDY_PERMIT_REFUSED");
  });

  it("private career college graduates get no PGWP", () => {
    const s = play("STUDY_PERMIT", ["private career college", "Work out the money", "Family sponsorship",
      "funds are ready", "specific plan", "Wait for the decision", "Board the flight", "proper boots",
      "Campus cafe", "Library every night"]);
    expect(s.outcome?.reason).toBe("NOT_PGWP_ELIGIBLE");
  });

  it("working 40 cash hours a week breaches study permit conditions", () => {
    const s = play("STUDY_PERMIT", ["Two-year Supply Chain", "Work out the money", "entrance scholarship",
      "Family sponsorship", "funds are ready", "specific plan", "Wait for the decision", "Board the flight",
      "proper boots", "Cash shifts"]);
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
      "Wait for the decision", "Board the flight", "proper boots", "Campus cafe", "Library every night"];
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
    const c = pickAndDescribe("LAGOS_LIFE", ["Call Sister Ada", "Leave the call", "Book the appointment",
      "Answer every question", "Pick Ada's call"], "Open the email");
    expect(c.tone).toBe("triumph");
  });

  it("money moves are flagged so coins fly the right way", () => {
    const loss = pickAndDescribe("LAGOS_LIFE", ["Danfo to Computer Village"], "visa consultant");
    expect(loss.money).toBe("loss");
    expect(loss.deltas[0]).toMatchObject({ key: "walletNgn", value: -35000, format: "ngn" });
    const gain = pickAndDescribe("STUDY_PERMIT", ["Master's in Engineering", "Work out the money"], "Family sponsorship");
    expect(gain.money).toBe("gain");
  });

  it("a fall in Village People Interference counts as good news", () => {
    const before = newRun(DB, "LAGOS_LIFE");
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
    const before = newRun(DB, "TOURIST_GAMBLE");
    const after = takeAction(DB, before, "job_fair", [0.99, 0]).state;
    const c = describeChoice(DB, before, after, "Attend In-Person Tech/Job Fair");
    expect(c.deltas.map((d) => d.key)).toEqual(expect.arrayContaining(["walletCad", "energy", "timeRemainingDays"]));
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
