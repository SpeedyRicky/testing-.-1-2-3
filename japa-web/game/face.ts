import type { GameState } from "./types";

/** A character's expression. "talk" animates the mouth. */
export type Face = "neutral" | "smile" | "grin" | "worried" | "tired" | "sad" | "shock" | "talk";

/** How the player's character looks right now: the run's stats, written on their face. */
export function faceFor(run: GameState | null | undefined): Face {
  if (!run) return "smile";
  if (run.outcome) return run.outcome.result === "win" ? "grin" : "sad";
  if (run.energy < 25) return "tired";
  if (run.desperation >= 70) return "worried";
  if (run.desperation <= 35 && run.energy >= 55) return "smile";
  return "neutral";
}
