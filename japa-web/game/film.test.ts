import { describe, expect, it } from "vitest";
import pcm from "./i18n/pcm.json";
import { DECISION_SHOT, FILM, FILM_MS, allFilmLines, circleOf, filmScript, moodOf, shotStart } from "./film";

describe("the after-choice film", () => {
  it("runs at least 30 seconds, as eight shots, with the result landing after the other person's side", () => {
    expect(FILM_MS).toBeGreaterThanOrEqual(30_000);
    expect(FILM).toHaveLength(8);
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
    expect(s.rippleCircle).toBe("family");
    // When the family is already in the scene, "meanwhile" goes to your roommate instead.
    expect(filmScript("good", "relative", 3).rippleCircle).toBe("friend");
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
