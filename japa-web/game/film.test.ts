import { describe, expect, it } from "vitest";
import pcm from "./i18n/pcm.json";
import { DECISION_SHOT, FILM, FILM_MS, allFilmLines, circleOf, filmScript, insertFor, moodOf, planMs, shotStart, whoInChoice } from "./film";
import { momentFor, momentKind } from "./moments";

describe("the after-choice film", () => {
  it("runs at least a minute, as fourteen shots, with the result landing after the other person's side", () => {
    expect(FILM_MS).toBeGreaterThanOrEqual(60_000);
    expect(FILM).toHaveLength(14);
    expect(FILM.findIndex((s) => s.kind === "pov")).toBeLessThan(DECISION_SHOT);
    expect(shotStart(FILM.length)).toBe(FILM_MS);
  });

  it("shows the other person's perspective by who they are, and the right mood", () => {
    expect(circleOf("relative")).toBe("family");
    expect(circleOf("officer")).toBe("official");
    expect(circleOf("kovacs")).toBe("boss");
    expect(circleOf("someone-new")).toBe("stranger");
    expect(moodOf("triumph")).toBe("up");
    expect(moodOf("danger")).toBe("down");
    const s = filmScript("bad", "officer", 3);
    expect(s.circle).toBe("official");
    expect(s.mood).toBe("down");
    expect(s.ripple.kind).toBe("chat");
    expect(s.verdict).toBe("stamp");
    // When the family is already in the scene, "meanwhile" goes to your roommate instead.
    expect(filmScript("good", "relative", 3).ripple.kind).toBe("roommate");
    // The set's caption decides the role: the warehouse "Supervisor" is a boss, not an agent.
    expect(circleOf("agent", "Supervisor")).toBe("boss");
    expect(circleOf("clerk", "Teller")).toBe("official");
  });

  it("goes to the person the choice involves", () => {
    expect(whoInChoice("Call Aunty Bisi in Charlottetown about the visa story")).toBe("relative");
    expect(whoInChoice("Ask Ngozi to send the invitation letter", "Ngozi")).toBe("relative");
    expect(whoInChoice("Pay the agent the deposit")).toBe("agent");
    expect(whoInChoice("Call the agent back")).toBe("agent");
    expect(whoInChoice("Tell your oga you need Friday off")).toBe("kovacs");
    expect(whoInChoice("Answer the officer's question honestly")).toBe("officer");
    expect(whoInChoice("Sleep. Waka the street when dusk is cheaper.")).toBeNull();
  });

  it("big moments get their own scenes: getting your SIN shows the handover, the letter and you reading it", () => {
    const sin = filmScript("good", "officer", 1, [], undefined, "Get your SIN at the airport Service Canada desk, then open a newcomer bank account", "FY_LANDING");
    expect(sin.moment?.kind).toBe("sin");
    const kinds = sin.plan.map((s) => s.kind);
    expect(kinds).toEqual(expect.arrayContaining(["handover", "item", "look", "showoff"]));
    expect(kinds.indexOf("handover")).toBeLessThan(kinds.indexOf("item"));
    expect(kinds.indexOf("item")).toBeLessThan(kinds.indexOf("look"));
    expect(planMs(sin.plan)).toBeGreaterThan(FILM_MS);
    expect(sin.verdict).toBe("face"); // the letter was already on screen
    // The portal shows the answer on a screen; a refusal has no showing off.
    const refused = filmScript("bad", "relative", 1, [], undefined, "Open the portal. Call {relName} either way.", "LAGOS_OUTCOME");
    expect(refused.moment?.kind).toBe("portal");
    expect(refused.moment?.title).toMatch(/Refused/);
    expect(refused.plan.map((s) => s.kind)).not.toContain("showoff");
  });

  it("knows the big moments from the choice's words", () => {
    expect(momentKind("Pay his 'facilitation' fee so your file 'moves faster'")).toBe("agent-cash");
    expect(momentKind("Book the appointment: CAD 185 in visa and biometrics fees.")).toBe("payment");
    expect(momentKind("Start the application", "EE_ITA_CEC")).toBe("ita");
    expect(momentKind("Start packing")).toBe("passport");
    expect(momentKind("Spend your first paycheque on proper winter work gear")).toBe("paycheque");
    expect(momentKind("Buy the best phone plan in the mall so you can call home properly")).toBe("shopping");
    expect(momentKind("Call {relTitle} in {relCity} about the visa story")).toBe("call");
    expect(momentKind("Leave the call. Go to the annex and start a real paper trail")).toBeNull();
    expect(momentFor("Get your SIN", "", "up")?.lines.join(" ")).not.toMatch(/\d{3} \d{3} \d{3}/); // never a full number
  });

  it("shows the thing at stake: money, papers or time", () => {
    expect(insertFor([{ key: "walletNgn" }, { key: "energy" }])).toBe("wallet");
    expect(insertFor([{ key: "papers" }])).toBe("documents");
    expect(insertFor([{ key: "energy" }])).toBe("clock");
    expect(insertFor([])).toBe("phone");
  });

  it("is stable for the same seed and varies between choices", () => {
    expect(filmScript("good", "clerk", 7)).toEqual(filmScript("good", "clerk", 7));
    const povs = new Set([0, 1, 2, 3].map((n) => filmScript("good", "clerk", n).pov));
    expect(povs.size).toBeGreaterThan(1);
  });

  it("every line in the film has a Pidgin translation", () => {
    const dict = pcm as Record<string, string>;
    for (const line of allFilmLines()) expect(dict[line], line).toBeTruthy();
  });
});
