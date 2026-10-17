import { describe, expect, it } from "vitest";
import pcm from "./i18n/pcm.json";
import { DECISION_SHOT, FILM, FILM_MS, allFilmLines, circleOf, filmScript, insertFor, moodOf, shotStart, whoInChoice } from "./film";

describe("the after-choice film", () => {
  it("runs at least 30 seconds, as ten shots, with the result landing after the other person's side", () => {
    expect(FILM_MS).toBeGreaterThanOrEqual(30_000);
    expect(FILM).toHaveLength(10);
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
