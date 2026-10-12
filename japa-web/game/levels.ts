// Levels: each route is split into named levels with a goal and up to three stars.
// Pure functions; the browser keeps best stars and replay snapshots (app/components/Levels.tsx).
import { evaluate } from "./engine";
import type { GameState, LevelSpec, RouteId, ScenarioDatabase } from "./types";

export const levelsFor = (db: ScenarioDatabase, route: RouteId): LevelSpec[] => db.routes[route]?.levels ?? [];

/** The level a scene belongs to, or -1 for scenes outside every level (endings, resolutions). */
export function levelIndexOf(db: ScenarioDatabase, route: RouteId, sceneId: string): number {
  return levelsFor(db, route).findIndex((l) => l.scenes.includes(sceneId));
}

/** Default bonus stars when a level doesn't name its own. */
const DEFAULT_STARS: LevelSpec["stars"] = [
  { label: "Village People Interference at 50% or less", when: { desperation: ["<=", 50] } },
  { label: "Energy at 40 or more", when: { energy: [">=", 40] } },
];

export function starRules(level: LevelSpec) {
  return level.stars ?? DEFAULT_STARS ?? [];
}

/** Stars for a completed level: one for finishing, one for each bonus condition met. */
export function starsFor(level: LevelSpec, state: GameState): number {
  return 1 + starRules(level).filter((s) => evaluate(state, s.when)).length;
}

/**
 * What changed between two states, level-wise: the level the player just finished (with stars), and the
 * level they just entered. A won run completes the level it ended in; a lost run completes nothing.
 */
export function levelProgress(db: ScenarioDatabase, before: GameState | undefined, after: GameState) {
  const route = after.activeRoute;
  const levels = levelsFor(db, route);
  // The furthest level reached: walking back to an earlier scene never "un-levels" the player.
  const at = (s: GameState) => Math.max(levelIndexOf(db, route, s.currentSceneId),
    ...s.history.map((h) => levelIndexOf(db, route, h.sceneId)));
  const from = before && before.activeRoute === route ? at(before) : -1;
  const to = at(after);
  let completed: { index: number; stars: number } | null = null;
  if (to > from && from >= 0) completed = { index: from, stars: starsFor(levels[from], after) };
  if (after.outcome?.result === "win" && to >= 0 && !(before?.outcome)) completed = { index: to, stars: starsFor(levels[to], after) };
  return { from, to, entered: to > from ? to : null, completed };
}
