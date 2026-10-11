import { describe, expect, it } from "vitest";
import {
  DB, applyEffects, applyMarketShock, choose, dismissPopup, enterScene, explainResolution, formatLabel, newRun,
  presentChoices, rankFor, takeAction, thresholdsFor, trapChance,
} from "./engine";
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
      "papers",
    ]);
    const bad: string[] = [];
    for (const s of Object.values(DB.scenes)) {
      const maps = [s.onEnter, ...(s.choices ?? []).map((c) => c.effects), ...(s.dashboard?.actions ?? []).map((a) => a.effects)];
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
    expect(Object.keys(app.runs).sort()).toEqual(["CAREGIVER_LMIA", "LAGOS_LIFE", "STARTUP_VISA", "TOURIST_GAMBLE"]);
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
