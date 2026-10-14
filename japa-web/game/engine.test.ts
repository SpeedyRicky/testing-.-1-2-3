import { describe, expect, it } from "vitest";
import {
  DB, applyEffects, applyMarketShock, choose, computeCrs, dismissPopup, enterScene, explainResolution, formatLabel, newRun,
  presentChoices, rankFor, takeAction, thresholdsFor, trapChance,
} from "./engine";
import { STAGES } from "../app/components/stages";
import { describeChoice, diffStats } from "./cinematic";
import {
  deriveGameProfile, familyFor, homeFor, kwTruthOf, fillText, profileProblem, profileVars, usernameProblem, DEFAULT_AVATAR,
  type PlayerProfile,
} from "./profile";
import { STATES, placeFor, placeVars, vacCityFor } from "./nigeria";
import {
  PROVINCES, RELATIVE_NAMES, faithFor, kwTruthFor, detectHeritage, makeRelative, provinceFor, relativeVars, seededRandom,
  type Heritage, type Relation, type Relative,
} from "./family";
import { initialState, makeReducer } from "./machine";
import { allEndings, endingKey, lessonFor } from "./endings";
import { levelIndexOf, levelProgress, levelsFor, starsFor } from "./levels";
import { blessingChance, dangerStats, gambleOdds, resolvePopup } from "./engine";
import { faceFor } from "./face";
import { careerVars, trackFor } from "./careers";
import { GROOVES, STYLES, STYLE_IDS, grooveFor, moodFor, type Mood } from "./music";
import { makeSave, readSave } from "./save";
import { PLAYABLE_ROUTES, simulate } from "./simulate";
import {
  ACHIEVEMENTS, DAILY_MODIFIERS, NEW_META, applyBundle, newAchievements, bundleFor, buy, dailyFor, grant, runAward, titleFor, toggleEquip, touchStreak,
} from "./meta";
import type { GameState, RouteId, StatKey } from "./types";

const reducer = makeReducer();

const NULL_VARS = profileVars(null);
/** True if a choice's text (raw, or filled for the default player) contains `pick`. */
const matches = (text: string, pick: string) => text.includes(pick) || fillText(text, NULL_VARS).includes(pick);

/** The engine index of the first choice on screen that matches (hidden choices are skipped, so positions can differ). */
function choiceIndex(s: GameState, pred: (c: ReturnType<typeof presentChoices>[number]) => boolean): number {
  return presentChoices(DB, s).find(pred)?.index ?? -1;
}

/** Plays by choice text; a [text, roll] pair sets that step's dice (0 = the risky choice works, 0.99 = it doesn't). */
function playR(route: RouteId, steps: (string | [string, number])[]): GameState {
  let s = newRun(DB, route);
  for (const step of steps) {
    const [pick, roll] = typeof step === "string" ? [step, 0] : step;
    const idx = choiceIndex(s, (c) => matches(c.text, pick));
    expect(idx, `choice containing "${pick}" at ${s.currentSceneId}`).toBeGreaterThanOrEqual(0);
    s = dismissPopup(choose(DB, s, idx, [1, 0, roll]));
  }
  return s;
}

/** Plays by choice text from a given state. */
function play2(start: GameState, picks: string[]): GameState {
  let s = start;
  for (const pick of picks) {
    const idx = choiceIndex(s, (c) => matches(c.text, pick));
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
    const idx = choiceIndex(s, (c) => matches(c.text, pick));
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
      s.choices?.forEach((c) => [c.gamble?.success.nextSceneId, c.gamble?.fail.nextSceneId].forEach((n) =>
        n && !ids.has(n) && missing.push(`${s.id} (gamble) -> ${n}`)));
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
      "loanTaken", "hasDegree", "careerScore", "community", "pflRisk", "conflictRegion", "kwBasis", "kwAtAirport", "kwCredibility", "kwEvidence", "eeCategory", "kwTruth", "officeJob", "saidNoHome", "nursePath", "postedPass", "warnedFamily", "dayoLeft", "healthTrack", "regulated", "familyPledge", "donorTrust", "loanApp", "employed", "arrived", "tradeYears", "clbTrade", "tradeCert", "tradeKind", "provinceTies", "pnpProvince", "familyStrain", "kidsWithYou",
    ]);
    const bad: string[] = [];
    for (const s of Object.values(DB.scenes)) {
      const maps: (object | undefined)[] = [s.onEnter, ...(s.choices ?? []).map((c) => c.effects), ...(s.dashboard?.actions ?? []).map((a) => a.effects)];
      for (const c of s.choices ?? []) {
        maps.push(c.set, c.requires);
        if (c.gamble) {
          maps.push(c.gamble.success.effects, c.gamble.success.set, c.gamble.fail.effects, c.gamble.fail.set);
          for (const b of c.gamble.bonus ?? []) if (!known.has(b.key)) bad.push(`${s.id}: bonus ${b.key}`);
        }
      }
      for (const m of maps) for (const k of Object.keys(m ?? {})) if (!known.has(k)) bad.push(`${s.id}: ${k}`);
      for (const b of s.branch ?? []) for (const k of Object.keys(b.when ?? {})) if (!known.has(k)) bad.push(`${s.id}: ${k}`);
    }
    for (const [id, route] of Object.entries(DB.routes)) {
      for (const t of [...(route.traps?.items ?? []), ...(route.blessings?.items ?? [])]) {
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
    const s = play("STARTUP_VISA", ["We don't compete with banks", "Four paying pilots", "event-driven", "pre-recorded walkthrough", "5% more equity",
      "Key-person clause", "Twelve months of runway", "FINTRAC"]);
    expect(s.outcome).toMatchObject({ result: "win", reason: "SUV_LOS_ISSUED", decidedBy: "SUV_PITCH_RESOLVE" });
    expect(s.energy).toBe(90);
  });

  it("one weak answer is survivable if the rest is strong", () => {
    expect(play("STARTUP_VISA", ["We don't compete with banks", "Four paying pilots", "event-driven", "pre-recorded walkthrough", "5% more equity",
      "best friends", "Twelve months of runway", "FINTRAC"]).outcome?.result).toBe("win");
  });

  it("a vague technical answer and a fake demo sink it, and the resolution explains why", () => {
    const s = play("STARTUP_VISA", ["We don't compete with banks", "Four paying pilots", "advanced cloud", "Figma prototype", "5% more equity",
      "Key-person clause", "Twelve months of runway", "FINTRAC"]);
    expect(s.outcome).toMatchObject({ result: "fail", reason: "SUV_REJECTED" });
    expect(s.walletNgn).toBe(29500000);
    const crit = explainResolution(DB, "SUV_PITCH_RESOLVE", s);
    expect(crit.find((c) => c.key === "technicalCredibility")?.passed).toBe(false);
  });

  it("the arrogance trap plus inflated numbers fail the pitch", () => {
    const s = play("STARTUP_VISA", ["simply superior", "Ten thousand", "event-driven", "pre-recorded walkthrough", "5% more equity",
      "Key-person clause", "Twelve months of runway", "FINTRAC"]);
    expect(s.outcome?.result).toBe("fail");
    expect(s.desperation).toBe(30 + 15 + 10 + 6 + 20);
  });

  it("a live demo is a gamble; offering to buy the letter is the end", () => {
    const at = play("STARTUP_VISA", ["We don't compete with banks", "Four paying pilots", "event-driven"]);
    const live = presentChoices(DB, at).find((c) => c.label === "LIVE_DEMO")!;
    expect(live.odds).toBeGreaterThan(0.5);
    expect(play("STARTUP_VISA", ["We don't compete with banks", "Four paying pilots", "event-driven", "pre-recorded walkthrough", "5% more equity",
      "Key-person clause", "₦25 million 'fee'"]).outcome?.reason).toBe("PAY_TO_PLAY");
  });

  it("bars get their pass marks from the content", () => {
    expect(thresholdsFor(DB, "STARTUP_VISA")).toEqual({ investorInterest: 70, technicalCredibility: 65, scalabilityScore: 50 });
    expect(thresholdsFor(DB, "CAREGIVER_LMIA")).toEqual({ lmiaProbability: 70, employerTrust: 40 });
  });

  it("invalid choices change nothing", () => {
    const s = newRun(DB, "STARTUP_VISA");
    expect(choose(DB, s, 99)).toBe(s);
    expect(choose(DB, s, -1)).toBe(s);
  });
});

describe("LMIA interview", () => {
  it("prevailing wage, compliant advertising and knowing who pays win sponsorship", () => {
    expect(play("CAREGIVER_LMIA", ["Give me two weeks on your backlog", "Job Bank median", "follow the advertising rules", "employers can't recover"]).outcome)
      .toMatchObject({ result: "win", reason: "LMIA_SPONSORSHIP_STARTED" });
  });
  it("suggesting a fake posting ends the interview", () => {
    expect(play("CAREGIVER_LMIA", ["Give me two weeks on your backlog", "Job Bank median", "fake job listing"]).outcome?.reason)
      .toBe("BLATANT_MISREPRESENTATION");
  });
  it("desperation and a lowball wage are declined", () => {
    const s = play("CAREGIVER_LMIA", ["cousin's company got an LMIA", "a dollar below the median", "West African corridors", "employers can't recover"]);
    expect(s.outcome?.reason).toBe("NO_SPONSORSHIP");
    expect(s.history.find((h) => h.sceneId === "LMIA_INTERVIEW_KOVACS")?.label).toBe("CRITICAL LEAK");
  });
  it("paying for your own LMIA or asking for cash both end it", () => {
    const base = ["Give me two weeks on your backlog", "Job Bank median", "follow the advertising rules"];
    expect(play("CAREGIVER_LMIA", [...base, "Pay it"]).outcome?.reason).toBe("WORKER_PAID_LMIA");
    expect(play("CAREGIVER_LMIA", [...base, "pay you cash"]).outcome?.reason).toBe("UNAUTHORIZED_WORK");
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

  it("the cash shift is tempting, and taking it is an instant fail", () => {
    const { state } = act(landed(), "cash_job");
    expect(state.currentSceneId).toBe("TR_CASH_SHIFT");
    const shift = choiceIndex(state, (c) => c.label === "CASH_SHIFT");
    const caught = choose(DB, state, shift, [1, 0, 0, 1]);
    expect(caught.outcome).toMatchObject({ result: "fail", reason: "CASH_WORK_CAUGHT" });
    expect(act(caught, "rest").toast).toBeNull();
  });

  it("going home with a clean record only opens in the last weeks", () => {
    expect(act(landed(), "go_home").toast).toBeNull();
    const late = act({ ...landed(), timeRemainingDays: 40 }, "go_home").state;
    expect(late.outcome).toMatchObject({ result: "win", reason: "HONEST_RETURN" });
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
      ["CAREGIVER_LMIA", "EXPRESS_ENTRY", "FIRST_YEAR", "NIGERIA_LIFE", "PNP_RURAL", "SPLIT_FAMILY", "STARTUP_VISA", "STUDY_PERMIT",
        "TARGETED_TRADE", "TOURIST_GAMBLE"]);
    expect(app.activeRoute).toBe("NIGERIA_LIFE");
  });

  it("keeps each route's progress when switching", () => {
    let app = reducer(initialState(), { type: "SELECT_ROUTE", route: "STARTUP_VISA" });
    app = reducer(app, { type: "CHOOSE", index: 1 });
    app = reducer(app, { type: "SELECT_ROUTE", route: "TOURIST_GAMBLE" });
    app = reducer(app, { type: "CHOOSE", index: 0, rolls: [1, 0] }); // tell CBSA the truth
    app = reducer(app, { type: "TAKE_ACTION", actionId: "resume", rolls: [0.9, 0] });
    expect(app.toast?.id).toBe(1);
    app = reducer(app, { type: "SELECT_ROUTE", route: "STARTUP_VISA" });
    expect(app.runs.STARTUP_VISA?.currentSceneId).toBe("SUV_VANCE_TRACTION");
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
  const HONEST = ["about the visa story", "Leave the call", "Book the appointment", "Ask HR", "Check every upload",
    "call, then wait", "Open the portal"];

  it("starts in the player's area with interference 36 and energy 85 (rebalanced from 72 after simulation)", () => {
    const s = newRun(DB, "NIGERIA_LIFE");
    expect(s.currentSceneId).toBe("LAGOS_YABA_DAWN");
    expect(s).toMatchObject({ walletNgn: 280000, energy: 85, desperation: 36 });
    expect(s.routeStats.papers).toBe(18);
  });

  it("the remote-job path wins when the interview goes well, and loops back when NEPA strikes", () => {
    const s = play("NIGERIA_LIFE", ["hunt remote jobs", "Rewrite the CV", "Take the interview",
      "Take the offer", "Check every upload", "call, then wait", "Open the portal"]);
    expect(s.outcome?.result).toBe("win");
    const nepa = playR("NIGERIA_LIFE", ["hunt remote jobs", "Rewrite the CV", ["Take the interview", 0.99]]);
    expect(nepa.currentSceneId).toBe("LAGOS_YABA_DUSK");
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
    const s = play("NIGERIA_LIFE", ["hunt remote jobs", "'visa consultant' whose status", "licensed consultant",
      "Upload everything", "call, then wait", "Open the portal"]);
    expect(s.outcome?.result).toBe("fail");
    expect(s.currentSceneId).toBe("LAGOS_ENDING_STAY");
    expect(["pearson", "village", "hustle"]).toContain(rankFor(DB, s)?.id);
  });

  it("paying the consultant floats -$1,500 CAD", () => {
    const s = play("NIGERIA_LIFE", ["hunt remote jobs", "'visa consultant' whose status"]);
    expect(s.cadFloat).toEqual({ amount: 1500, tick: 1 });
  });

  it("trap chance rises with interference, as in the original formula", () => {
    const s = newRun(DB, "NIGERIA_LIFE");
    expect(trapChance(DB, s)).toBeCloseTo(0.05 + Math.pow(0.36, 1.65) * 0.48, 6);
    expect(trapChance(DB, { ...s, desperation: 100 })).toBeCloseTo(0.53, 6);
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

  it("a rushed CLB 6 plus a weak French result still falls short of the French cutoff", () => {
    const s = playR("EXPRESS_ENTRY", [["Book the test for Saturday", 0.99], "official express transcript", "Refresh the rounds",
      ["Enrol at the French institute", 0.99], "Update your profile", "Refresh the rounds"]);
    expect(s.routeStats).toMatchObject({ clbFirst: 6, nclcFrench: 5 });
    expect(s.routeStats.crsScore).toBeLessThan(400);
    expect(s.currentSceneId).toBe("EE_BELOW");
  });

  it("proof of funds stays locked until savings reach CAD 15,263; borrowing is fraud", () => {
    const s = play("EXPRESS_ENTRY", ["three months first", "official express transcript", "Refresh the rounds",
      "Enrol at the French institute", "Update your profile", "Refresh the rounds", "Start the application"]);
    expect(presentChoices(DB, s).find((c) => c.text.startsWith("Submit six months"))?.enabled).toBe(false);
    const f = choose(DB, s, choiceIndex(s, (c) => c.text.startsWith("Borrow")));
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
  const FUND_ALL = ["entrance scholarship", "Family sponsorship", "budget sheet", "Sell the plot", "Crowdfund", "Honest video"];
  it("master's: fund it, write a specific plan, graduate with a PGWP", () => {
    const s = play("STUDY_PERMIT", ["Master's in Engineering", "Work out the money", ...FUND_ALL,
      "funds are ready", "Convert now", "specific plan", "adds a specialization", "A gift deed", "My whole family", "Wait for the decision", "Start packing", "close family only", "New parka and boots",
      "host family", "Agree to wait", "Campus cafe", "Library every night", "Book IELTS"]);
    expect(s.outcome).toMatchObject({ result: "win", reason: "PGWP_ISSUED" });
    expect(rankFor(DB, s)?.id).toBe("pgwp");
  });

  it("submitting stays locked (with the amount shown) until funds cover tuition + CAD 23,448; only your program's button shows", () => {
    const s = play("STUDY_PERMIT", ["Master's in Engineering", "Work out the money", "Family sponsorship", "budget sheet"]);
    const ready = presentChoices(DB, s).filter((c) => c.text.startsWith("The funds are ready"));
    expect(ready).toHaveLength(1);
    expect(ready[0].enabled).toBe(false);
    expect(ready[0].lockedHint).toContain("57,448");
    const deferred = play("STUDY_PERMIT", ["Master's in Engineering", "Work out the money", "Family sponsorship", "budget sheet", "Defer a year"]);
    expect(deferred.walletCad).toBe(s.walletCad + 9000);
  });

  it("each funding source can only be used once", () => {
    const s = play("STUDY_PERMIT", ["Master's in Engineering", "Work out the money", "Family sponsorship", "budget sheet"]);
    expect(presentChoices(DB, s).find((c) => c.text.startsWith("Family sponsorship"))?.enabled).toBe(false);
  });

  it("a template study plan gets refused", () => {
    const steps: (string | [string, number])[] = ["Two-year Supply Chain", "Work out the money", "entrance scholarship",
      "Family sponsorship", "budget sheet", "funds are ready", "Convert now", "template", "economy in Nigeria is bad", "uncle pooled", "My whole family", ["Wait for the decision", 0.5]];
    const s = playR("STUDY_PERMIT", steps);
    expect(s.currentSceneId).toBe("ST_REFUSED");
    expect(s.outcome).toBeFalsy();
    expect(playR("STUDY_PERMIT", [...steps, "same file"]).outcome?.reason).toBe("STUDY_PERMIT_REFUSED");
  });

  it("private career college graduates get no PGWP", () => {
    const s = play("STUDY_PERMIT", ["private career college", "Work out the money", "Family sponsorship", "budget sheet",
      "funds are ready", "Convert now", "specific plan", "adds a specialization", "A gift deed", "My whole family", "Wait for the decision", "Start packing", "close family only", "New parka and boots",
      "host family", "Agree to wait", "Campus cafe", "Library every night", "Book IELTS"]);
    expect(s.outcome?.reason).toBe("NOT_PGWP_ELIGIBLE");
  });

  it("working 40 cash hours a week breaches study permit conditions", () => {
    const s = play("STUDY_PERMIT", ["Two-year Supply Chain", "Work out the money", "entrance scholarship",
      "Family sponsorship", "budget sheet", "funds are ready", "Convert now", "specific plan", "adds a specialization", "A gift deed", "My whole family", "Wait for the decision", "Start packing", "close family only",
      "New parka and boots", "host family", "Agree to wait", "Cash shifts"]);
    expect(s.outcome?.reason).toBe("STATUS_BREACH");
  });

  it("fake admission letters and parked money are misrepresentation", () => {
    expect(play("STUDY_PERMIT", ["guaranteed admission letter"]).outcome?.reason).toBe("MISREPRESENTATION");
    expect(play("STUDY_PERMIT", ["Master's in Engineering", "Work out the money", "park"]).outcome?.reason)
      .toBe("MISREPRESENTATION");
  });

  it("a PGWP carries the graduate into Express Entry with Canadian education", () => {
    let app = reducer(initialState(), { type: "SELECT_ROUTE", route: "STUDY_PERMIT" });
    const picks = ["Master's in Engineering", "Work out the money", ...FUND_ALL, "funds are ready", "Convert now", "specific plan", "adds a specialization", "A gift deed", "My whole family",
      "Wait for the decision", "Start packing", "close family only", "New parka and boots", "host family", "Agree to wait", "Campus cafe", "Library every night", "Book IELTS"];
    for (const p of picks) {
      const idx = choiceIndex(app.runs.STUDY_PERMIT!, (c) => matches(c.text, p));
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
    s = choose(DB, s, choiceIndex(s, (c) => c.text.startsWith("Work a second year")));
    expect(s.routeStats.crsScore).toBe(521);
    s = choose(DB, s, 0);
    expect(s.currentSceneId).toBe("EE_ITA_CEC");
  });
});

describe("choice cutscenes", () => {
  const pickAndDescribe = (route: RouteId, picks: string[], last: string) => {
    const before = play(route, picks);
    const idx = choiceIndex(before, (c) => c.text.includes(last));
    const choice = DB.scenes[before.currentSceneId].choices![idx];
    const after = choose(DB, before, idx);
    return describeChoice(DB, before, after, choice.text, choice.label, choice.feedback ?? "");
  };

  it("a strong pitch answer is a good moment with green chips", () => {
    const c = pickAndDescribe("STARTUP_VISA", [], "We don't compete with banks");
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
      "Ask HR", "Check every upload", "call, then wait"], "Open the portal");
    expect(c.tone).toBe("triumph");
  });

  it("money moves are flagged so coins fly the right way", () => {
    const loss = pickAndDescribe("NIGERIA_LIFE", ["hunt remote jobs"], "visa consultant");
    expect(loss.money).toBe("loss");
    expect(loss.deltas[0]).toMatchObject({ key: "walletNgn", value: -35000, format: "ngn" });
    const gain = pickAndDescribe("STUDY_PERMIT", ["Master's in Engineering", "Work out the money"], "Education loan");
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
    expect(choices.find((c) => c.set?.programType === 2)?.enabled).toBe(false);
    expect(choices.find((c) => c.text.startsWith("Four-year bachelor's"))?.enabled).toBe(true);
  });

  it("a bachelor's in Canada carries 3+ years of Canadian education and the real age into Express Entry", () => {
    let app = reducer(initialState(DB, fresher), { type: "SELECT_ROUTE", route: "STUDY_PERMIT" });
    const picks = ["Four-year bachelor's", "Work out the money", "entrance scholarship", "Family sponsorship", "budget sheet",
      "Sell the plot", "Crowdfund", "Honest video", "Education loan", "funds are ready", "Convert now", "specific plan", "adds a specialization", "A gift deed", "My whole family", "Wait for the decision",
      "Start packing", "close family only", "New parka and boots", "host family", "Agree to wait", "Campus cafe", "Library every night", "Book IELTS"];
    for (const p of picks) {
      const idx = choiceIndex(app.runs.STUDY_PERMIT!, (c) => matches(c.text, p));
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
  /** A tourist whose true story at home is `t` (1 outed, 2 partner violence, 3 armed groups). */
  const truth = (t: number) => { const s = tourist(); return { ...s, routeStats: { ...s.routeStats, kwTruth: t } }; };
  function walk(s: GameState, picks: string[]): GameState {
    for (const pick of picks) {
      const idx = choiceIndex(s, (c) => fillText(c.text, profileVars(null)).includes(pick) || c.text.includes(pick));
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
    const s = walk(truth(1), ["Kawosoke at the counter", "you were outed", ...STRONG]);
    expect(s.routeStats.kwAtAirport).toBe(1);
    expect(s.outcome).toMatchObject({ result: "win", reason: "PROTECTED_PERSON" });
  });

  it("a real gender-based claim without enough evidence loses on internal flight alternative", () => {
    const thin = walk(truth(2), ["Kawosoke at the counter", "violence from your ex-partner", "Legal Aid", "Wait for the open work permit",
      "line by line", "say 'I don't remember'", "Explain, with your evidence"]);
    expect(thin.outcome?.reason).toBe("IFA_FOUND");
    const strong = walk(truth(2), ["Kawosoke at the counter", "violence from your ex-partner", ...STRONG]);
    expect(strong.outcome?.reason).toBe("PROTECTED_PERSON");
  });

  it("embellishing and posting on TikTok sink a real claim on credibility", () => {
    const s = walk(truth(1), ["Kawosoke at the counter", "you were outed", "Legal Aid", "TikTok", "Memorize",
      "Add a new detail"]);
    expect(s.outcome?.reason).toBe("CLAIM_REFUSED");
  });

  it("filing a bought story is an instant fail, and walking away keeps the run alive", () => {
    const inland = takeAction(DB, landed(), "kawosoke", [0.99, 0]).state;
    const s = walk(inland, ["ready-made story", "File it anyway"]);
    expect(s.outcome).toMatchObject({ result: "fail", reason: "MISREPRESENTATION" });
    const out = walk(takeAction(DB, landed(), "kawosoke", [0.99, 0]).state, ["ready-made story", "Walk out", "Back to the job hunt"]);
    expect(out.currentSceneId).toBe("TOURIST_HUB");
    expect(out.outcome).toBeFalsy();
    expect(out.walletCad).toBe(landed().walletCad - 20 - 1500);
  });

  it("village people are not a Convention ground; flying home ends the claim", () => {
    expect(walk(tourist(), ["Kawosoke at the counter", "what you truly believe", ...STRONG.slice(0, 4)]).outcome?.reason).toBe("NO_NEXUS");
    expect(walk(truth(1), ["Kawosoke at the counter", "you were outed", "Legal Aid", "fly home for Mummy"]).outcome?.reason).toBe("CLAIM_ABANDONED");
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
    const filed = choose(DB, walk(truth(1), ["Kawosoke at the counter", "you were outed"]), 0, [0, 0]);
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
    const s = play("STUDY_PERMIT", ["Master's in Engineering", "Work out the money", "entrance scholarship", "Family sponsorship", "budget sheet",
      "Sell the plot", "Crowdfund", "Honest video", "Education loan", "funds are ready", "Convert now", "specific plan", "adds a specialization", "A gift deed", "My whole family", "Wait for the decision",
      "Start packing", "close family only", "New parka and boots", "host family", "Agree to wait", "Campus cafe", "Library every night", "Skip it"]);
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

/** A profile whose true story at home is `t` (found by trying usernames: the backstory is seeded per profile). */
function profileWithTruth(t: number): PlayerProfile {
  for (let i = 0; i < 500; i++) {
    const p = { version: 1, username: `Tobi${i}`, avatar: DEFAULT_AVATAR, role: "worker", age: 30, stateCode: "LA",
      worker: { occupation: "logistics", years: 4, qualification: "bachelors", salary: "150k-400k" } } as PlayerProfile;
    if (kwTruthOf(p) === t) return p;
  }
  throw new Error("no profile with that backstory");
}

describe("Year One in Canada and community-story scenes", () => {
  const year = (picks: string[]) => play("FIRST_YEAR", picks);

  it("networking, bridging and help in winter get you back in your field", () => {
    const s = year(["SIN at the airport", "Declare everything", "guarantor from", "co-sign", "full-time and study", "Volunteer two days", "bridging program", "Swap shifts", "fixed share",
      "Nigerian association", "crisp written summary", "Employment Insurance", "volunteer tax clinic", "Stay. Save"]);
    expect(s.routeStats.careerScore).toBeGreaterThanOrEqual(50);
    expect(s.outcome).toMatchObject({ result: "win", reason: "BACK_IN_FIELD" });
  });

  it("a parked career with savings is 'surviving'; going home is 'reverse japa'", () => {
    const parked = year(["SIN at the airport", "Declare everything", "guarantor from", "co-sign", "full-time and study", "warehouse survival job", "Drive Uber", "Swap shifts", "fixed share",
      "Nigerian association", "Keep driving", "any shift", "volunteer tax clinic", "Stay. Save"]);
    expect(parked.outcome?.reason).toBe("SURVIVING");
    const home = year(["SIN at the airport", "Declare everything", "guarantor from", "co-sign", "full-time and study", "warehouse survival job", "Drive Uber", "Swap shifts", "fixed share",
      "Nigerian association", "Keep driving", "any shift", "volunteer tax clinic", "Go home for good"]);
    expect(home.outcome).toMatchObject({ result: "neutral", reason: "REVERSE_JAPA" });
  });

  it("a rental scam and an empty account end the year early", () => {
    const s = playR("FIRST_YEAR", ["best phone plan", "Declare everything", "Facebook 'landlord'", ["Only apply for jobs at your old level", 0.99],
      "bridging program", "Swap shifts", "Send all of it", "Stay inside", "crisp written summary", "Move to Calgary", "volunteer tax clinic", "Go home for December as an IJGB"]);
    expect(s.outcome?.reason).toBe("BURNOUT");
  });

  it("permanent residence and refugee protection both lead into Year One", () => {
    let app = reducer(initialState(), { type: "SET_PROFILE", profile: profileWithTruth(1) });
    app = reducer(app, { type: "SELECT_ROUTE", route: "TOURIST_GAMBLE" });
    for (const pick of ["Kawosoke at the counter", "you were outed", "Legal Aid", "Gather evidence", "line by line",
      "say 'I don't remember'", "Explain, with your evidence"]) {
      const idx = choiceIndex(app.runs.TOURIST_GAMBLE!, (c) => matches(c.text, pick));
      app = reducer(app, { type: "CHOOSE", index: idx, rolls: [1, 0] });
    }
    app = reducer(app, { type: "FOLLOW_UNLOCK" });
    expect(app.activeRoute).toBe("FIRST_YEAR");
    expect(app.runs.FIRST_YEAR!.currentSceneId).toBe("FY_HOUSING");
    expect(DB.scenes.EE_COPR.unlocksRoute).toBe("FIRST_YEAR");
  });

  it("a refused student who reads the GCMS notes can fix the plan and get approved", () => {
    const s = playR("STUDY_PERMIT", ["Two-year Supply Chain", "Work out the money", "entrance scholarship",
      "Family sponsorship", "budget sheet", "funds are ready", "Convert now", "template", "economy in Nigeria is bad", "uncle pooled", "My whole family", ["Wait for the decision", 0.5], "GCMS notes", "specific plan", "adds a specialization", "A gift deed", "My whole family", ["Wait for the decision", 0.5]]);
    expect(s.currentSceneId).toBe("ST_APPROVED");
    const scam = playR("STUDY_PERMIT", ["Two-year Supply Chain", "Work out the money", "entrance scholarship",
      "Family sponsorship", "budget sheet", "funds are ready", "Convert now", "template", "economy in Nigeria is bad", "uncle pooled", "My whole family", ["Wait for the decision", 0.5], "guaranteed visa"]);
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
    expect(play2(seller, ["processing deposit"]).outcome?.reason).toBe("LMIA_SCAM");
    expect(play2(seller, ["Ask for the employer's legal name"]).currentSceneId).toBe("TOURIST_HUB");
  });

  it("a claimant who works cash before the permit is caught", () => {
    const run = newRun(DB, "TOURIST_GAMBLE");
    const s = play2({ ...run, routeStats: { ...run.routeStats, kwTruth: 1 } }, ["Kawosoke at the counter", "you were outed", "Legal Aid", "cash warehouse"]);
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

describe("blessings", () => {
  it("good surprises use their own roll, come more often when things are bad, and never in tests by default", () => {
    const s = newRun(DB, "NIGERIA_LIFE");
    const idx = choiceIndex(s, (c) => c.text.includes("about the visa story"));
    expect(choose(DB, s, idx).popup).toBeNull();
    const blessed = choose(DB, s, idx, [1, 0, 0, 0]);
    expect(blessed.popup?.kind).toBe("blessing");
    expect(blessingChance(DB, { ...s, desperation: 90 })).toBeGreaterThan(blessingChance(DB, { ...s, desperation: 10 }));
    expect(blessingChance(DB, newRun(DB, "STARTUP_VISA"))).toBe(0);
  });
});

describe("risky choices", () => {
  it("odds come from preparation and stay within limits", () => {
    const g = { odds: 0.2, bonus: [{ key: "clbFirst" as StatKey, per: 0.05 }], max: 0.7, success: { feedback: "" }, fail: { feedback: "" } };
    const s = newRun(DB, "EXPRESS_ENTRY");
    expect(gambleOdds({ ...s, routeStats: { ...s.routeStats, clbFirst: 0 } }, g)).toBeCloseTo(0.2);
    expect(gambleOdds({ ...s, routeStats: { ...s.routeStats, clbFirst: 9 } }, g)).toBeCloseTo(0.65);
    expect(gambleOdds({ ...s, routeStats: { ...s.routeStats, clbFirst: 12 } }, g)).toBeCloseTo(0.7);
    expect(gambleOdds(s, { ...g, odds: -1, bonus: [] })).toBeCloseTo(0.05);
  });

  it("buttons show the odds, and the dice pick the branch", () => {
    const start = newRun(DB, "EXPRESS_ENTRY");
    const prep = presentChoices(DB, start).find((c) => c.text.startsWith("Book IELTS General Training"))!;
    expect(prep.odds).toBeGreaterThan(0.5);
    const rushed = presentChoices(DB, start).find((c) => c.text.startsWith("Book the test for Saturday"))!;
    expect(rushed.odds).toBeLessThan(prep.odds!);
    expect(playR("EXPRESS_ENTRY", [["Book IELTS General Training", 0]]).routeStats.clbFirst).toBe(9);
    const short = playR("EXPRESS_ENTRY", [["Book IELTS General Training", 0.99]]);
    expect(short.routeStats.clbFirst).toBe(8);
    expect(short.lastChoice?.label).toBe("ONE_BAND_SHORT");
  });

  it("a strong study plan raises the visa odds; the dice can still say no", () => {
    const base = ["Master's in Engineering", "Work out the money", "entrance scholarship", "Family sponsorship", "budget sheet", "Sell the plot",
      "Crowdfund", "Honest video", "funds are ready", "Convert now"];
    const strong = playR("STUDY_PERMIT", [...base, "specific plan", "adds a specialization", "A gift deed", "My whole family"]);
    const weak = playR("STUDY_PERMIT", [...base, "template", "economy in Nigeria is bad", "uncle pooled", "My whole family"]);
    const oddsAt = (s: GameState) => presentChoices(DB, s).find((c) => c.text.startsWith("Wait for the decision"))!.odds!;
    expect(oddsAt(strong)).toBeGreaterThan(oddsAt(weak) + 0.3);
    expect(playR("STUDY_PERMIT", [...base, "specific plan", "adds a specialization", "A gift deed", "My whole family", ["Wait for the decision", 0.95]]).currentSceneId).toBe("ST_REFUSED");
  });

  it("a failed gamble can loop back: the ASUU strike", () => {
    const s = playR("EXPRESS_ENTRY", ["three months first", ["Go back every week", 0.99]]);
    expect(s.currentSceneId).toBe("EE_ECA");
    expect(s.routeStats.ecaComplete ?? 0).toBe(0);
  });
});

describe("meta-progression", () => {
  it("titles grow with lifetime JP", () => {
    expect(titleFor(0)).toBe("JJC");
    expect(titleFor(320)).toBe("Visa hustler");
    expect(titleFor(5000)).toBe("Japa legend");
  });

  it("the daily challenge is the same all day and changes between days", () => {
    const routes = ["NIGERIA_LIFE", "STUDY_PERMIT", "EXPRESS_ENTRY", "TOURIST_GAMBLE"] as RouteId[];
    expect(dailyFor("2026-10-12", routes)).toEqual(dailyFor("2026-10-12", routes));
    const week = new Set(Array.from({ length: 14 }, (_, i) => {
      const d = dailyFor(`2026-10-${String(i + 1).padStart(2, "0")}`, routes);
      return `${d.route}/${d.modifier.id}`;
    }));
    expect(week.size).toBeGreaterThan(5);
  });

  it("perks and daily modifiers change the run: money, energy, traps and odds", () => {
    const run = newRun(DB, "NIGERIA_LIFE");
    const b = bundleFor(["malt-bread", "prayer-warrior", "night-reader"], { day: "2026-10-12", modifier: DAILY_MODIFIERS[0] });
    const s = applyBundle(run, b);
    expect(s.energy).toBe(Math.min(100, run.energy + 15));
    expect(s.walletNgn).toBe(Math.round(run.walletNgn * 0.75));
    expect(trapChance(DB, s)).toBeCloseTo(trapChance(DB, run) * 0.7);
    expect(s.mods).toMatchObject({ daily: "2026-10-12", label: "Naira crash day", oddsBonus: 0.06 });
    const ee = applyBundle(newRun(DB, "EXPRESS_ENTRY"), bundleFor(["night-reader"]));
    const odds = (st: GameState) => presentChoices(DB, st).find((c) => c.text.startsWith("Book the test for Saturday"))!.odds!;
    expect(odds(ee)).toBeCloseTo(odds(newRun(DB, "EXPRESS_ENTRY")) + 0.06);
  });

  it("the reducer starts new runs with the equipped perks, and the daily with its modifier", () => {
    let app = reducer(initialState(), { type: "SET_BUNDLE", bundle: bundleFor(["steady-head"]) });
    const before = app.runs.NIGERIA_LIFE!.desperation;
    app = reducer(app, { type: "RESTART" });
    expect(app.runs.NIGERIA_LIFE!.desperation).toBe(before - 10);
    app = reducer(app, { type: "START_DAILY", route: "EXPRESS_ENTRY", bundle: bundleFor([], { day: "2026-10-12", modifier: DAILY_MODIFIERS[1] }) });
    expect(app.activeRoute).toBe("EXPRESS_ENTRY");
    expect(app.runs.EXPRESS_ENTRY!.mods?.daily).toBe("2026-10-12");
  });

  it("runs pay JP once; daily wins pay more with a streak", () => {
    const win = { ...newRun(DB, "EXPRESS_ENTRY"), outcome: { result: "win" as const, reason: "X", title: "X" } };
    const a = runAward(win, { key: "k1", newEnding: true, today: "2026-10-12", streak: 0 });
    expect(a.total).toBe(10 + 30 + 25);
    const m = grant(NEW_META, a);
    expect(m.jp).toBe(65);
    expect(grant(m, a)).toBe(m);
    const daily = runAward({ ...win, mods: { daily: "2026-10-12" } }, { key: "k2", newEnding: false, today: "2026-10-12", streak: 5 });
    expect(daily.lines.at(-1)!.jp).toBe(90);
  });

  it("the streak grows on consecutive days and resets after a gap", () => {
    let m = touchStreak(NEW_META, "2026-10-10");
    m = touchStreak(m, "2026-10-11");
    m = touchStreak(m, "2026-10-11");
    expect(m.streak.count).toBe(2);
    expect(touchStreak(m, "2026-10-14").streak.count).toBe(1);
  });

  it("buying needs enough JP, and only two perks can be equipped", () => {
    let m = { ...NEW_META, jp: 500 };
    m = buy(m, "malt-bread");
    expect(m.jp).toBe(440);
    expect(buy({ ...NEW_META, jp: 10 }, "night-reader").owned).not.toContain("night-reader");
    m = buy(buy(m, "steady-head"), "prayer-warrior");
    m = toggleEquip(toggleEquip(toggleEquip(m, "malt-bread"), "steady-head"), "prayer-warrior");
    expect(m.equipped).toEqual(["malt-bread", "steady-head"]);
  });
});

describe("balance (seeded simulated playthroughs)", () => {
  // npm run simulate prints the full report; these are the guard rails.
  for (const route of PLAYABLE_ROUTES) {
    it(`${route}: a thoughtful player wins sometimes, never always; a random one rarely; nobody gets stuck`, () => {
      const smart = simulate(DB, route, "smart", 300, 11);
      const random = simulate(DB, route, "random", 300, 11);
      const winish = (r: typeof smart) => (r.win + r.neutral) / r.runs;
      expect(smart.win / smart.runs, "smart wins").toBeGreaterThanOrEqual(0.2);
      expect(smart.win / smart.runs, "smart doesn't always win").toBeLessThanOrEqual(0.9);
      expect(winish(random), "random does worse than smart").toBeLessThan(winish(smart) + 0.05);
      expect(smart.stuck / smart.runs, "stuck runs").toBeLessThanOrEqual(0.05);
    });
  }
});

describe("achievements", () => {
  const ctx = (run: GameState, extra: Partial<Parameters<typeof newAchievements>[0]> = {}) =>
    ({ run, meta: NEW_META, endingsFound: 1, threeStarLevels: 0, today: "2026-10-12", ...extra });

  it("a clean win earns Clean hands; a shady move anywhere in the run doesn't", () => {
    const clean = play("CAREGIVER_LMIA", ["Give me two weeks on your backlog", "Job Bank median", "follow the advertising rules", "employers can't recover"]);
    const ids = newAchievements(ctx(clean)).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["first-run", "clean-hands", "kovacs"]));
    const shady = play("EXPRESS_ENTRY", ["leaked"]);
    expect(newAchievements(ctx(shady)).map((a) => a.id)).not.toContain("clean-hands");
  });

  it("honest exits and scam reports count; achievements are only earned once", () => {
    const honest = play2(newRun(DB, "TOURIST_GAMBLE"), ["Kawosoke at the counter", "nothing will happen to me"]);
    expect(newAchievements(ctx(honest)).map((a) => a.id)).toContain("honest-exit");
    const owned = { ...NEW_META, achievements: ACHIEVEMENTS.map((a) => a.id) };
    expect(newAchievements(ctx(honest, { meta: owned }))).toEqual([]);
    expect(newAchievements(ctx(honest, { endingsFound: 12 })).map((a) => a.id)).toContain("collector");
  });
});

describe("saves", () => {
  const ada = { version: 1, username: "Ada", avatar: DEFAULT_AVATAR, role: "worker", age: 30, stateCode: "AN",
    worker: { occupation: "nurse", years: 4, qualification: "bachelors", salary: "150k-400k" } } as PlayerProfile;

  it("a save round-trips through JSON and continues the same runs", () => {
    let app = reducer(initialState(DB, ada), { type: "SELECT_ROUTE", route: "EXPRESS_ENTRY" });
    app = reducer(app, { type: "CHOOSE", index: 0, rolls: [1, 0] });
    const file = JSON.parse(JSON.stringify(makeSave(DB, app)));
    const back = readSave(DB, file, "Ada");
    expect(back?.activeRoute).toBe("EXPRESS_ENTRY");
    const restored = reducer(initialState(DB, ada), { type: "RESTORE_RUNS", ...back! });
    expect(restored.runs.EXPRESS_ENTRY).toEqual(app.runs.EXPRESS_ENTRY);
    expect(restored.activeRoute).toBe("EXPRESS_ENTRY");
  });

  it("ignores another player's save, a broken run, and no profile", () => {
    const app = initialState(DB, ada);
    const file = makeSave(DB, app)!;
    expect(readSave(DB, file, "Tunde")).toBeNull();
    const broken = { ...file, runs: { ...file.runs, STUDY_PERMIT: { ...file.runs.STUDY_PERMIT!, currentSceneId: "GONE" } } };
    expect(readSave(DB, broken, "Ada")?.runs.STUDY_PERMIT).toBeUndefined();
    expect(readSave(DB, { ...file, version: 99 }, "Ada")).toBeNull();
    expect(makeSave(DB, initialState())).toBeNull();
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

describe("v0.15 scenes: spouse, caregiver scam, the accent conversation", () => {
  it("only a master's (16+ months) lets a spouse come on an open work permit", () => {
    const to = (program: string) => play("STUDY_PERMIT", [program, "Work out the money", "entrance scholarship", "Family sponsorship", "budget sheet",
      "Sell the plot", "Crowdfund", "Honest video", "Education loan", "funds are ready", "Convert now", "specific plan", "adds a specialization", "A gift deed", "My whole family", "Wait for the decision", "Start packing", "close family only",
      "New parka and boots", "host family"]);
    const owp = (s: GameState) => presentChoices(DB, s).find((c) => c.label === "SPOUSAL_OWP")!;
    expect(owp(to("Master's in Engineering")).enabled).toBe(true);
    expect(owp(to("Two-year Supply Chain")).enabled).toBe(false);
  });

  it("the caregiver training fee is a scam; checking IRCC first saves you", () => {
    const ad = takeAction(DB, landed(), "caregiver_ad", [0.99, 0]).state;
    expect(ad.currentSceneId).toBe("TR_CAREGIVER_AD");
    expect(play2(ad, ["Pay the training fee"]).outcome?.reason).toBe("CAREGIVER_SCAM");
    expect(play2(ad, ["Check IRCC's page"]).currentSceneId).toBe("TOURIST_HUB");
  });

  it("naming the accent comment is a gamble that community makes likelier", () => {
    const at = play("FIRST_YEAR", ["SIN at the airport", "Declare everything", "guarantor from", "co-sign", "full-time and study", "Volunteer two days", "bridging program",
      "Swap shifts", "fixed share", "Nigerian association"]);
    expect(at.currentSceneId).toBe("FY_ACCENT");
    const named = presentChoices(DB, at).find((c) => c.label === "NAMED_IT")!;
    expect(named.odds).toBeGreaterThan(0.5);
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

describe("v0.16: playtest fixes", () => {
  const prof = (username: string, stateCode: string, occupation = "logistics") => ({ version: 1, username, avatar: DEFAULT_AVATAR,
    role: "worker", age: 29, stateCode, worker: { occupation, years: 4, qualification: "bachelors", salary: "150k-400k" } }) as PlayerProfile;

  it("faith and the parent's name follow heritage: Hausa players pray at a masjid and call Umma", () => {
    expect(faithFor("hausa", () => 0.9)).toBe("masjid");
    expect(faithFor("igbo", () => 0.1)).toBe("church");
    const aisha = profileVars(prof("Aisha", "KD"));
    expect(homeFor(prof("Aisha", "KD")).heritage).toBe("hausa");
    expect(aisha.faithHub).toBe("masjid");
    expect(aisha.parent).toBe("Umma");
    expect(profileVars(prof("Chiamaka", "EN")).parent).toBe("Mama");
    expect(fillText(DB.scenes.FY_BLACK_TAX.title!, aisha)).toBe("Umma is calling.");
  });

  it("every Kawosoke character has one true story; claims that aren't it stay locked", () => {
    expect(kwTruthFor(true, () => 0.1)).toBe(3);
    expect(kwTruthFor(false, () => 0.9)).toBe(0);
    const story = profileVars(prof("Tolu", "LA")).kwStory;
    expect(story).not.toMatch(/\{/);
    const run = { ...landed(), routeStats: { ...landed().routeStats, kwTruth: 0 } };
    const inland = takeAction(DB, run, "kawosoke", [0.99, 0]).state;
    const shown = presentChoices(DB, inland);
    for (const label of ["SOGIESC_CLAIM", "GENDER_BASED_CLAIM", "CONFLICT_CLAIM"]) {
      expect(shown.find((c) => c.label === label)?.enabled, label).toBe(false);
    }
    expect(shown.find((c) => c.label === "HONEST_EXIT")?.enabled).toBe(true);
    const outed = presentChoices(DB, { ...inland, routeStats: { ...inland.routeStats, kwTruth: 1 } });
    expect(outed.find((c) => c.label === "SOGIESC_CLAIM")?.enabled).toBe(true);
    expect(outed.find((c) => c.label === "GENDER_BASED_CLAIM")?.enabled).toBe(false);
  });

  it("the visa centre takes fingerprints, not passports, and the 'we know people' agent is a scam", () => {
    expect(DB.scenes.ST_VFS.dialogue).toMatch(/passport back in your bag/);
    expect(DB.scenes.LAGOS_DECISION_GATE.title).toMatch(/keep your passport/);
    expect(play("NIGERIA_LIFE", ["hunt remote jobs", "'visa consultant' whose status", "facilitation"]).outcome?.reason).toBe("AGENT_SCAM");
  });

  it("nurses meet Matron and the UK-or-Canada question; the council tout is a scam", () => {
    const nurse = initialState(DB, prof("Chiamaka", "LA", "nurse")).runs.EXPRESS_ENTRY!;
    const at = play2(nurse, ["three months first", "official express transcript"]);
    expect(at.currentSceneId).toBe("NURSE_VERIFY");
    expect(play2(at, ["man at the council"]).outcome?.reason).toBe("NURSE_TOUT");
    expect(play2(at, ["Apply quietly"]).currentSceneId).toBe("NURSE_TWO_TESTS");
    expect(play2(at, ["Apply quietly", "Write both", "Go UK first"]).outcome).toMatchObject({ result: "win", reason: "UK_FIRST" });
    const tech = initialState(DB, prof("Tunde", "OY", "software")).runs.EXPRESS_ENTRY!;
    expect(play2(tech, ["three months first", "official express transcript"]).currentSceneId).toBe("EE_PROFILE");
  });

  it("Year One: drivers get the gig scene, not the office one; saying no to family comes back in December", () => {
    const start = ["SIN at the airport", "Declare everything", "guarantor from", "co-sign", "full-time and study", "warehouse survival job", "Drive Uber"];
    const gig = play("FIRST_YEAR", [...start, "Swap shifts", "Say no this time", "Nigerian association"]);
    expect(gig.currentSceneId).toBe("FY_GIG_LIFE");
    const dec = play2(gig, ["Keep driving", "any shift", "volunteer tax clinic"]);
    expect(dec.currentSceneId).toBe("FY_SILENCE");
    const fy = newRun(DB, "FIRST_YEAR");
    const office = play2({ ...fy, routeStats: { ...fy.routeStats, regulated: 0 } }, ["SIN at the airport", "Declare everything", "guarantor from", "co-sign", "full-time and study", "Volunteer two days",
      "Unregulated field", "Swap shifts", "fixed share", "Nigerian association"]);
    expect(office.currentSceneId).toBe("FY_ACCENT");
  });

  it("the group-chat tax guy is fraud; undeclared stockfish is a gamble with a fine", () => {
    const taxes = play("FIRST_YEAR", ["SIN at the airport", "Declare everything", "guarantor from", "co-sign", "full-time and study", "warehouse survival job",
      "Drive Uber", "Swap shifts", "fixed share", "Nigerian association", "Keep driving", "any shift"]);
    expect(taxes.currentSceneId).toBe("FY_TAXES");
    expect(play2(taxes, ["expenses you don't have"]).outcome?.reason).toBe("TAX_FRAUD");
    const customs = play("FIRST_YEAR", ["SIN at the airport"]);
    const tick = choiceIndex(customs, (c) => c.label === "UNDECLARED");
    expect(dismissPopup(choose(DB, customs, tick, [1, 0, 0.99, 1])).walletCad).toBe(customs.walletCad - 800);
  });

  it("the Startup pitch ends on regulation, and a Lagos angel's money doesn't count", () => {
    const at = play("STARTUP_VISA", ["We don't compete with banks", "Four paying pilots", "event-driven", "pre-recorded walkthrough", "5% more equity",
      "Key-person clause", "Twelve months of runway"]);
    expect(at.currentSceneId).toBe("SUV_COMPLIANCE");
    const angel = DB.scenes.SUV_ROSS_MONEY.choices!.find((c) => c.text.includes("Lagos angel"))!;
    expect(angel.feedback).toMatch(/designated Canadian angel group/);
    expect(DB.routes.STARTUP_VISA.initialState!.walletNgn).toBeGreaterThanOrEqual(20000000);
  });

  it("stats near a collapse line are flagged as danger", () => {
    const ee = newRun(DB, "EXPRESS_ENTRY");
    expect(dangerStats(DB, ee).size).toBe(0);
    expect([...dangerStats(DB, { ...ee, energy: 12, desperation: 90 })].sort()).toEqual(["desperation", "energy"]);
    expect(dangerStats(DB, { ...ee, energy: 0, outcome: { result: "fail", reason: "X", title: "" } }).size).toBe(0);
  });

  it("the player's face follows the run", () => {
    const s = newRun(DB, "NIGERIA_LIFE");
    expect(faceFor(null)).toBe("smile");
    expect(faceFor({ ...s, energy: 10 })).toBe("tired");
    expect(faceFor({ ...s, energy: 80, desperation: 85 })).toBe("worried");
    expect(faceFor({ ...s, outcome: { result: "win", reason: "X", title: "" } })).toBe("grin");
    expect(faceFor({ ...s, outcome: { result: "fail", reason: "X", title: "" } })).toBe("sad");
  });
});

describe("v0.17: right answers cost something", () => {
  it("the honest study plan costs nights; an editor is a real middle option", () => {
    const sop = DB.scenes.ST_SOP.choices!;
    expect(sop[0].effects!.energy).toBeLessThanOrEqual(-20);
    expect(sop.some((c) => c.label === "EDITOR")).toBe(true);
  });

  it("the honest reference letter is a gamble when the boss is in Dubai, and failing it is still honest", () => {
    const c = DB.scenes.EE_REFERENCE.choices![0];
    expect(c.gamble?.fail.nextSceneId).toBeUndefined();
    expect(c.nextSceneId).toBe("EE_DOCS");
  });

  it("Year One asks about faith at work in the player's own words", () => {
    const masjid = { version: 1, username: "Aisha", avatar: DEFAULT_AVATAR, role: "worker", age: 29, stateCode: "KD",
      worker: { occupation: "data", years: 4, qualification: "bachelors", salary: "150k-400k" } } as PlayerProfile;
    expect(fillText(DB.scenes.FY_FAITH.title!, profileVars(masjid))).toBe("Every Jumu'ah.");
    const at = play("FIRST_YEAR", ["SIN at the airport", "Declare everything", "guarantor from", "co-sign", "full-time and study", "Volunteer two days", "bridging program"]);
    expect(at.currentSceneId).toBe("FY_FAITH");
  });
});

describe("callbacks: earlier choices come back", () => {
  it("posting the boarding pass brings a gift-card 'IRCC' call in week one", () => {
    const silence = { ...newRun(DB, "STUDY_PERMIT"), currentSceneId: "ST_SILENCE" };
    const posted = play2(silence, ["post the boarding pass", "New parka"]);
    expect(posted.currentSceneId).toBe("ST_SCAM_CALL");
    expect(play2(posted, ["Hang up"]).currentSceneId).toBe("ST_HOUSING");
    expect(play2(silence, ["close family only", "New parka"]).currentSceneId).toBe("ST_HOUSING");
  });

  it("warning the family about the LMIA seller unlocks a blessing later", () => {
    const seller = takeAction(DB, landed(), "lmia_whatsapp", [0.99, 0]).state;
    const warned = play2(seller, ["Report the ad"]);
    expect(warned.routeStats.warnedFamily).toBe(1);
    expect(DB.routes.TOURIST_GAMBLE.blessings!.items.find((b) => b.id === "warned")?.when).toEqual({ warnedFamily: [">=", 1] });
  });

  it("Matron's signed reference makes the Dubai signature likelier", () => {
    const at = { ...newRun(DB, "EXPRESS_ENTRY"), currentSceneId: "EE_REFERENCE" };
    const odds = (s: GameState) => presentChoices(DB, s)[0].odds!;
    expect(odds({ ...at, routeStats: { ...at.routeStats, nursePath: 2 } })).toBeGreaterThan(odds(at));
  });
});

describe("v0.18: your job shapes the story", () => {
  const worker = (occupation: string) => ({ version: 1, username: "Chiamaka", avatar: DEFAULT_AVATAR, role: "worker", age: 29,
    stateCode: "LA", worker: { occupation, years: 5, qualification: "bachelors", salary: "150k-400k" } }) as PlayerProfile;

  it("each track gets its own job hunt, interview story and side hustle", () => {
    expect(trackFor("worker", "nurse")).toBe("health");
    expect(trackFor("student", undefined, "Civil Engineering")).toBe("eng");
    expect(trackFor(undefined)).toBe("default");
    const nurse = profileVars(worker("nurse"));
    expect(fillText(DB.scenes.LAGOS_JOB_BOARD.dialogue!, nurse)).toMatch(/RNs, Ontario registration required/);
    expect(fillText(DB.scenes.LAGOS_BERLIN_CALL.dialogue!, nurse)).toMatch(/nursing registration first/);
    expect(fillText(DB.scenes.LAGOS_WEEKEND_GIG.dialogue!, nurse)).toMatch(/home-care shift/);
    expect(fillText(DB.scenes.LAGOS_WEEKEND_GIG.dialogue!, profileVars(worker("electrician")))).toMatch(/wire a duplex/);
    for (const t of ["tech", "health", "teach", "eng", "trades", "business", "default"] as const) {
      for (const v of Object.values(careerVars(t))) expect(v.length).toBeGreaterThan(0);
    }
  });

  it("Student offers programs in your field, and the study plan names your background", () => {
    const st = initialState(DB, worker("nurse")).runs.STUDY_PERMIT!;
    const vars = profileVars(worker("nurse"));
    const texts = presentChoices(DB, st).map((c) => fillText(c.text, vars));
    expect(texts.some((t) => t.startsWith("Master of Public Health"))).toBe(true);
    expect(texts.some((t) => t.startsWith("Two-year Practical Nursing diploma"))).toBe(true);
    expect(fillText(DB.scenes.ST_SOP.choices![0].text, vars)).toMatch(/5 years as a registered nurse/);
  });

  it("the Nigeria route names the visitor visa, and nurse licensing goes through the provincial college", () => {
    expect(DB.scenes.LAGOS_ENDING_WIN.outcome!.title).toBe("Visa in hand");
    expect(DB.scenes.LAGOS_ENDING_WIN.outcome!.lesson).toMatch(/28 August 2024/);
    expect(DB.scenes.LAGOS_AUNTY_CALL.dialogue).toMatch(/visitor visa/);
    const nclex = DB.scenes.NURSE_UK_OR_CANADA.choices!.find((c) => c.label === "NCLEX")!;
    expect(nclex.feedback).toMatch(/provincial regulator decides/);
    expect(nclex.feedback).toMatch(/BC/);
    expect(DB.scenes.NURSE_TWO_TESTS.dialogue).toMatch(/IELTS Academic or CELBAN/);
  });
});

describe("v0.19: round-3 fixes", () => {
  it("a relative never shares the player's name or its long form", () => {
    for (let i = 0; i < 50; i++) {
      const r = makeRelative("yoruba", seededRandom(`tunde${i}`), "brother", "Tunde");
      expect(r.name.toLowerCase()).not.toContain("tunde");
    }
  });

  it("food, uncles and party cloth follow heritage", () => {
    const hausa = profileVars({ version: 1, username: "Aisha", avatar: DEFAULT_AVATAR, role: "worker", age: 31, stateCode: "KD",
      worker: { occupation: "data", years: 5, qualification: "bachelors", salary: "150k-400k" } } as PlayerProfile);
    expect(fillText(DB.scenes.FY_CUSTOMS.dialogue!, hausa)).toMatch(/dambun nama/);
    expect(hausa.uncle).toBe("Uncle Sani");
    expect(JSON.stringify(DB.scenes.FY_SILENCE)).not.toMatch(/Ọmọ/);
  });

  it("the regulated-field options only show for regulated jobs in Year One", () => {
    const fy = newRun(DB, "FIRST_YEAR");
    const at = (regulated: number) => play2({ ...fy, routeStats: { ...fy.routeStats, regulated } },
      ["SIN at the airport", "Declare everything", "guarantor from", "co-sign", "full-time and study", "Volunteer two days"]);
    expect(presentChoices(DB, at(0)).map((c) => c.label)).not.toContain("BRIDGING");
    expect(presentChoices(DB, at(0)).some((c) => c.label === "CERT_AND_CV")).toBe(true);
    expect(presentChoices(DB, at(1)).some((c) => c.label === "CERT_AND_CV")).toBe(false);
  });

  it("if the CTO leaves, the pitch can't claim a backup, but honesty about the gap scores", () => {
    const at = { ...newRun(DB, "STARTUP_VISA"), currentSceneId: "SUV_PITCH_ROSS" };
    const left = { ...at, routeStats: { ...at.routeStats, dayoLeft: 1 } };
    expect(presentChoices(DB, left).find((c) => c.label === "OPERATIONAL FAILSAFE")?.enabled).toBe(false);
    expect(presentChoices(DB, left).some((c) => c.label === "HONEST_GAP")).toBe(true);
    expect(presentChoices(DB, at).some((c) => c.label === "HONEST_GAP")).toBe(false);
    expect(DB.scenes.SUV_LOS_ISSUED.outcome!.lesson).toMatch(/paused new Start-up Visa applications/);
  });

  it("nurses in Nigeria Life register first instead of taking an LMIA offer", () => {
    const at = { ...newRun(DB, "NIGERIA_LIFE"), currentSceneId: "LAGOS_BERLIN_CALL" };
    const nurse = { ...at, routeStats: { ...at.routeStats, healthTrack: 1 } };
    expect(presentChoices(DB, nurse).map((c) => c.label)).toContain("REGISTER_FIRST");
    expect(presentChoices(DB, at).map((c) => c.label)).not.toContain("REGISTER_FIRST");
  });

  it("Kunle paid for an LMIA: helping him is the lesson, asking for his agent is the scam", () => {
    const k = takeAction(DB, landed(), "kunle", [0.99, 0]).state;
    expect(k.currentSceneId).toBe("TR_KUNLE");
    expect(play2(k, ["agent's number"]).outcome?.reason).toBe("LMIA_SCAM");
    expect(play2(k, ["open work permit for vulnerable workers"]).currentSceneId).toBe("TOURIST_HUB");
  });
});

describe("soundtrack styles", () => {
  const MOODS = Object.keys(GROOVES) as Mood[];
  it("offers five Naija styles, each restyling at least three moods", () => {
    expect(STYLE_IDS).toEqual(["afrobeat", "amapiano", "highlife", "fuji", "nollywood"]);
    for (const id of STYLE_IDS) expect(Object.keys(STYLES[id].grooves).length, id).toBeGreaterThanOrEqual(3);
  });

  it("every groove in every style is a playable 16-step pattern", () => {
    for (const id of STYLE_IDS) {
      for (const mood of MOODS) {
        const g = grooveFor(id, mood);
        const where = `${id}/${mood}`;
        expect(g.bpm, where).toBeGreaterThanOrEqual(60);
        expect(g.bpm, where).toBeLessThanOrEqual(140);
        expect(g.chords.length, where).toBeGreaterThan(0);
        for (const lane of [g.kick, g.clap, g.shaker, g.talk, g.bass, g.arp, g.log, g.keys, g.horns, g.boom]) {
          if (lane) expect(lane.length, where).toBe(16);
        }
      }
    }
  });

  it("moods a style doesn't restyle fall back to Afrobeats, and Nollywood brings the drama", () => {
    expect(grooveFor("highlife", "tension")).toBe(GROOVES.tension);
    expect(grooveFor("afrobeat", "lagos")).toBe(GROOVES.lagos);
    expect(grooveFor("nollywood", "tension").strings).toBe(true);
    expect(grooveFor("nollywood", "lagos").boom?.some(Boolean)).toBe(true);
    expect(grooveFor("fuji", "lagos").talk.filter((x) => x !== null).length).toBeGreaterThan(6);
  });
});

describe("v0.22: design-doc scenes and mechanics", () => {
  const at = (route: RouteId, scene: string, stats: Record<string, number> = {}) => {
    const r = newRun(DB, route);
    return { ...r, currentSceneId: scene, routeStats: { ...r.routeStats, ...stats } };
  };

  it("every timed scene's timeout answer exists, and every crisis offers at least two choices", () => {
    for (const s of Object.values(DB.scenes)) {
      if (s.timer) expect(s.choices?.[s.timer.timeoutIndex], s.id).toBeTruthy();
    }
    for (const r of Object.values(DB.routes)) {
      for (const t of r.traps?.items ?? []) if (t.options) expect(t.options.length, t.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("a Village People crisis waits for your choice, then shows what happened", () => {
    const fy = newRun(DB, "FIRST_YEAR");
    const trap = DB.routes.FIRST_YEAR.traps!.items.find((t) => t.id === "blacktax")!;
    const s = { ...fy, popup: { kind: "trap" as const, id: trap.id, kicker: trap.kicker, title: trap.title, body: trap.body, options: trap.options } };
    const sent = resolvePopup(DB, s, 0);
    expect(sent.walletCad).toBe(fy.walletCad - 45);
    expect(sent.popup?.options).toBeUndefined();
    expect(sent.popup?.body).toMatch(/prayers/);
    expect(dismissPopup(s).popup?.options).toBeUndefined();
  });

  it("the Agent Room: verifying keeps your money, paying is Section 40", () => {
    const room = at("NIGERIA_LIFE", "AR_PITCH");
    const safe = play2(room, ["LMIA number", "No upfront fee"]);
    expect(safe.currentSceneId).toBe("AR_SAFE");
    expect(play2(safe, ["Walk to the bus stop"]).streetCred).toBe(room.streetCred + 6 + 20);
    expect(play2(room, ["Where do I make the deposit", "Borrow from three loan apps"]).outcome?.reason).toBe("AGENT_ROOM_SCAM");
    expect(play2(room, ["minimum language level", "legally binding contract"]).currentSceneId).toBe("AR_RETALIATION");
  });

  it("a fake credit alert loses the car; checking the app is a fair gamble", () => {
    const lot = at("NIGERIA_LIFE", "LAGOS_JIJI");
    expect(play2(lot, ["Hand over the keys"]).outcome?.reason).toBe("FAKE_ALERT");
    expect(play2(lot, ["police-station car park"]).walletNgn).toBe(lot.walletNgn + 1500000);
  });

  it("the file review rewards a paper trail and punishes pooled funds and freezing", () => {
    const review = at("STUDY_PERMIT", "ST_REVIEW_1");
    const strong = play2(review, ["adds a specialization", "A gift deed", "My whole family"]);
    const weak = play2(review, ["economy in Nigeria is bad", "uncle pooled", "My whole family"]);
    expect(strong.routeStats.officerConfidence! - weak.routeStats.officerConfidence!).toBe(105);
    expect(DB.scenes.ST_REVIEW_1.timer).toEqual({ seconds: 15, timeoutIndex: 2 });
    const leave = presentChoices(DB, at("STUDY_PERMIT", "ST_REVIEW_3")).find((c) => c.label === "STUDY_LEAVE")!;
    expect(leave.enabled).toBe(false);
    expect(presentChoices(DB, at("STUDY_PERMIT", "ST_REVIEW_3", { employed: 1 })).find((c) => c.label === "STUDY_LEAVE")!.enabled).toBe(true);
  });

  it("the scholarship route: a tailored email and an analog professor lead to full funding; a self-written reference is fraud", () => {
    const start = at("STUDY_PERMIT", "ST_START");
    const funded = play2(start, ["fully funded research master's", "Tailored", "carton of malt", "Accept"]);
    expect(funded.currentSceneId).toBe("ST_FUNDS");
    expect(funded.routeStats.programType).toBe(2);
    expect(funded.walletCad).toBeGreaterThan(start.walletCad + 40000);
    expect(play2(start, ["fully funded research master's", "Tailored", "Write the letter yourself"]).outcome?.reason).toBe("FAKE_REFERENCE");
  });

  it("Mr. Henderson: a guarantor and a quiet lifestyle get the lease", () => {
    const s = play2(at("FIRST_YEAR", "FY_LANDLORD"), ["co-sign", "full-time and study"]);
    expect(s.currentSceneId).toBe("FY_JOBS");
  });
});

describe("v0.23: Trades, PNP Rural and Split Family routes", () => {
  it("Trades: documented years, the lower language bar and a certificate win; fake letters and bought Red Seals fail", () => {
    const win = playR("TARGETED_TRADE", ["Electrician", "register your own business", "Another year", ["Prepare for a month", 0], ["provincial trade assessment", 0],
      "Report to the site", "winter work gear"]);
    expect(win.outcome).toMatchObject({ result: "win", reason: "TRADES_PR" });
    expect(play("TARGETED_TRADE", ["Plumber", "cyber cafe"]).outcome?.reason).toBe("FAKE_EXPERIENCE");
    const noCert = playR("TARGETED_TRADE", ["Welder", "registered contractor", "Another year", ["Prepare for a month", 0], ["Cold-message", 0.99]]);
    expect(noCert.outcome?.reason).toBe("TRADES_NOT_YET");
  });

  it("PNP: ties earn +600; saying you'd settle while planning to leave is misrepresentation", () => {
    const nominated = playR("PNP_RURAL", ["Saskatchewan", "Read the stream rules", "exploratory visit", ["I'm here to stay", 0]]);
    expect(nominated.currentSceneId).toBe("PN_NOMINATED");
    const settled = play2(nominated, ["Accept the nomination"]);
    expect(settled.routeStats.crsScore).toBe(455 + 600);
    expect(play2(settled, ["Settle in the province"]).outcome?.reason).toBe("PNP_SETTLED");
    expect(play2(settled, ["Move to Toronto in month one"]).outcome?.reason).toBe("PNP_INTENT_LIE");
    expect(play("PNP_RURAL", ["Nova Scotia", "Ask {relName}", "Join the province", "eventually"]).outcome?.reason).toBe("PNP_NOT_SELECTED");
  });

  it("Split Family: two wallets; routine and remittances reunite the family, neglect breaks it", () => {
    const s = play("SPLIT_FAMILY", ["You go alone", "Pay for the overweight", "Send CAD 400", "Fix a call time", "Send CAD 260", "Help prepare it properly"]);
    expect(s.outcome).toMatchObject({ result: "win", reason: "SF_REUNITED" });
    const kids = play("SPLIT_FAMILY", ["You take the kids", "Repack", "Ask your spouse to cover", "too tired"]);
    expect(kids.currentSceneId).toBe("SF_KIDS");
    expect(DB.routes.SPLIT_FAMILY.bars.map((b) => b.key)).toEqual(["walletCad", "walletNgn", "familyStrain", "desperation"]);
  });
});

describe("Gist feed", () => {
  it("shows the route's own posts first, changes daily, and every myth or scam has a Community note", async () => {
    const { GIST, gistFor } = await import("./gist");
    for (const p of GIST) if (p.kind === "myth" || p.kind === "scam") expect(p.note, p.id).toBeTruthy();
    const today = gistFor("TOURIST_GAMBLE", 100);
    expect(today).toHaveLength(6);
    expect(today.filter((p) => p.routes?.includes("TOURIST_GAMBLE")).length).toBeGreaterThanOrEqual(3);
    expect(gistFor("TOURIST_GAMBLE", 101).map((p) => p.id)).not.toEqual(today.map((p) => p.id));
    expect(new Set(today.map((p) => p.id)).size).toBe(6);
  });
});
