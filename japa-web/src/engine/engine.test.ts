import { CONTENT, choose, formatTag, presentChoices, startScenario, type DialogueState } from "./dialogue";
import { PITCH_SCENARIO, activeSpeaker, resolveLetterOfSupport } from "./pitch";
import { ACTIONS, LEADS_TO_WIN, START_DAYS, newTourist, takeAction, type TouristState } from "./tourist";
import { LMIA_SCENARIO, initialState, reducer } from "./machine";

function play(scenario: string, picks: string[]): DialogueState {
  let s = startScenario(CONTENT, scenario);
  for (const pick of picks) {
    const idx = presentChoices(CONTENT, s).findIndex((c) => c.text.includes(pick));
    expect(idx, `choice containing "${pick}"`).toBeGreaterThanOrEqual(0);
    s = choose(CONTENT, s, idx);
  }
  return s;
}

describe("dialogue engine (port of narrative.gd)", () => {
  it("starts the pitch with the scenario setup", () => {
    const s = startScenario(CONTENT, PITCH_SCENARIO);
    expect(s.nodeId).toBe("suv_q1");
    expect(s.stats).toMatchObject({ investor_interest: 40, technical_credibility: 40, scalability: 40 });
    expect(s.outcome).toBeNull();
  });

  it("ignores invalid choices", () => {
    const s = startScenario(CONTENT, PITCH_SCENARIO);
    expect(choose(CONTENT, s, 99)).toBe(s);
    expect(choose(CONTENT, s, -1)).toBe(s);
  });

  it("formats tags, keeping acronyms upper case", () => {
    expect(formatTag("HIGH_VALUE_MATCH")).toBe("High value match");
    expect(formatTag("STRONG_ROI_CASE")).toBe("Strong ROI case");
  });

  it("reports an unknown scenario as an error, not a crash", () => {
    expect(startScenario(CONTENT, "nope").outcome?.result).toBe("error");
  });
});

describe("Startup Visa pitch (same paths as the Godot tests)", () => {
  it("best pitch earns the Letter of Support", () => {
    const s = play(PITCH_SCENARIO, ["interoperable bridge", "event-driven", "key-person clause"]);
    expect(s.outcome).toMatchObject({ result: "win", reason: "SUV_LOS_ISSUED", decidedBy: "suv_resolve" });
    expect(resolveLetterOfSupport(s).issued).toBe(true);
  });

  it("one weak answer is survivable", () => {
    const s = play(PITCH_SCENARIO, ["interoperable bridge", "event-driven", "best friends"]);
    expect(s.outcome?.result).toBe("win");
  });

  it("a vague technical answer sinks the pitch, and the resolution says why", () => {
    const s = play(PITCH_SCENARIO, ["interoperable bridge", "advanced cloud", "key-person clause"]);
    expect(s.outcome).toMatchObject({ result: "fail", reason: "SUV_REJECTED" });
    const r = resolveLetterOfSupport(s);
    expect(r.issued).toBe(false);
    const cred = r.criteria.find((c) => c.key === "technical_credibility")!;
    expect(cred).toMatchObject({ threshold: 65, passed: false, value: 5 });
    expect(r.summary).toContain("Technical Credibility");
  });

  it("reads thresholds from the content, and lists scalability as informational", () => {
    const r = resolveLetterOfSupport(startScenario(CONTENT, PITCH_SCENARIO));
    expect(r.criteria.map((c) => [c.key, c.op, c.threshold])).toEqual([
      ["investor_interest", ">=", 70],
      ["technical_credibility", ">=", 65],
    ]);
    expect(r.informational.map((i) => i.key)).toEqual(["scalability"]);
  });

  it("maps speakers to Zoom tiles", () => {
    expect(activeSpeaker("Ms. Vance (Committee Chair)")).toBe("vance");
    expect(activeSpeaker("Mr. Chen (Chief Technology Officer)")).toBe("chen");
    expect(activeSpeaker("Mr. Ross (Managing Partner)")).toBe("ross");
    expect(activeSpeaker("Maple Venture Incubator")).toBeNull();
  });
});

describe("LMIA interview", () => {
  it("compliant path wins sponsorship", () => {
    const s = play(LMIA_SCENARIO, ["I understand the hesitation", "follow the advertising rules"]);
    expect(s.outcome).toMatchObject({ result: "win", reason: "LMIA_SPONSORSHIP_STARTED" });
  });
  it("suggesting a fake posting ends the interview", () => {
    const s = play(LMIA_SCENARIO, ["I understand the hesitation", "fake job listing"]);
    expect(s.outcome).toMatchObject({ result: "fail", reason: "BLATANT_MISREPRESENTATION" });
  });
  it("desperation then a gamble is declined", () => {
    const s = play(LMIA_SCENARIO, ["Please sir", "West African corridors"]);
    expect(s.outcome?.reason).toBe("NO_SPONSORSHIP");
  });
});

describe("180-day tourist gamble", () => {
  const act = (s: TouristState, id: string, lead = 0.99, quip = 0) => takeAction(s, id, [lead, quip]);

  it("starts with 180 days and full energy", () => {
    const s = newTourist();
    expect(s).toMatchObject({ daysLeft: START_DAYS, energy: 100, status: "playing" });
  });

  it("job fair costs energy, money and a day, and shows a toast", () => {
    const s = act(newTourist(), "job_fair");
    expect(s).toMatchObject({ daysLeft: 179, energy: 70, cad: 2500 - 25 - 20, network: 8, leads: 0 });
    expect(s.toast?.text).toContain("tote bags");
    expect(s.location).toContain("Convention Centre");
  });

  it("a lucky roll lands a lead and lowers desperation", () => {
    const s = act(newTourist(), "cold_message", 0);
    expect(s.leads).toBe(1);
    expect(s.toast?.title).toBe("Employer lead!");
    expect(s.desperation).toBe(25 + 2 - 10);
  });

  it("actions you can't afford in energy do nothing", () => {
    let s = newTourist();
    s = { ...s, energy: 10 };
    expect(act(s, "job_fair")).toBe(s);
    expect(act(s, "rest").energy).toBe(50);
  });

  it("the cash job is an instant fail", () => {
    const s = act(newTourist(), "cash_job");
    expect(s.status).toBe("lost");
    expect(s.endReason).toContain("without authorization");
  });

  it(`${LEADS_TO_WIN} leads win and unlock the LMIA interview, carrying desperation over`, () => {
    let app = initialState();
    for (let i = 0; i < LEADS_TO_WIN; i++) app = reducer(app, { type: "TOURIST_ACTION", actionId: "cold_message", rolls: [0, 0] });
    expect(app.tourist.status).toBe("won");
    app = reducer(app, { type: "LMIA_FROM_TOURIST" });
    expect(app.mode).toBe("lmia");
    expect(app.lmia.stats.desperation).toBe(app.tourist.desperation);
    expect(app.lmia.flags.from_tourist_gamble).toBe(true);
  });

  it("running out the clock loses", () => {
    let s = newTourist();
    s = { ...s, daysLeft: 1, cad: 10000 };
    expect(act(s, "rest").status).toBe("lost");
  });

  it("every action has a label and at least one toast", () => {
    for (const a of ACTIONS) {
      expect(a.label.length).toBeGreaterThan(0);
      expect(a.quips.length).toBeGreaterThan(0);
    }
  });
});

describe("state machine", () => {
  it("keeps each mode's progress when switching", () => {
    let app = initialState();
    app = reducer(app, { type: "PITCH_CHOOSE", index: 1 });
    app = reducer(app, { type: "SWITCH_MODE", mode: "tourist" });
    app = reducer(app, { type: "TOURIST_ACTION", actionId: "resume", rolls: [0.9, 0] });
    app = reducer(app, { type: "SWITCH_MODE", mode: "pitch" });
    expect(app.mode).toBe("pitch");
    expect(app.pitch.nodeId).toBe("suv_q2");
    expect(app.tourist.resume).toBe(15);
  });

  it("LMIA_FROM_TOURIST does nothing before the gamble is won", () => {
    const app = initialState();
    expect(reducer(app, { type: "LMIA_FROM_TOURIST" })).toBe(app);
  });

  it("restart resets only its own mode", () => {
    let app = initialState();
    app = reducer(app, { type: "PITCH_CHOOSE", index: 1 });
    app = reducer(app, { type: "TOURIST_ACTION", actionId: "resume", rolls: [0.9, 0] });
    app = reducer(app, { type: "PITCH_RESTART" });
    expect(app.pitch.nodeId).toBe("suv_q1");
    expect(app.tourist.resume).toBe(15);
  });
});
