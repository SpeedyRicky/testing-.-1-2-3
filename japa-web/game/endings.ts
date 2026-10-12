// Every ending in the game, so players can collect them, plus the "Reality check" lesson for each.
// Pure: the browser store that remembers which endings a player found lives in app/components/Endings.tsx.
import type { GameState, RouteId, ScenarioDatabase } from "./types";

export interface Ending {
  key: string;
  route: RouteId;
  title: string;
  result: "win" | "fail" | "neutral";
  lesson?: string;
}

/** Endings the Tourist Gamble dashboard decides itself (engine.takeAction), not a scene. */
export const DASHBOARD_ENDINGS: { reason: string; title: string; result: "fail" }[] = [
  { reason: "OUT_OF_MONEY", title: "Out of money", result: "fail" },
  { reason: "STAY_EXPIRED", title: "Time's up", result: "fail" },
  { reason: "BURNOUT", title: "Burnout", result: "fail" },
  { reason: "UNAUTHORIZED_WORK", title: "Caught working", result: "fail" },
];

/** One key per ending scene; dashboard endings are keyed by reason. */
export function endingKey(db: ScenarioDatabase, state: GameState): string | null {
  if (!state.outcome) return null;
  const scene = db.scenes[state.currentSceneId];
  return scene?.outcome ? `${state.activeRoute}:${scene.id}` : `${state.activeRoute}:${state.outcome.reason}`;
}

export function lessonFor(db: ScenarioDatabase, state: GameState): string | undefined {
  if (!state.outcome) return undefined;
  return db.scenes[state.currentSceneId]?.outcome?.lesson ?? state.outcome.lesson
    ?? db.routes[state.activeRoute].lessons?.[state.outcome.reason];
}

export function allEndings(db: ScenarioDatabase): Ending[] {
  const out: Ending[] = [];
  for (const s of Object.values(db.scenes)) {
    if (!s.outcome || db.routes[s.route]?.status !== "playable") continue;
    out.push({
      key: `${s.route}:${s.id}`, route: s.route, title: s.outcome.title, result: s.outcome.result,
      lesson: s.outcome.lesson ?? db.routes[s.route].lessons?.[s.outcome.reason],
    });
  }
  for (const s of Object.values(db.scenes)) {
    if (!s.dashboard) continue;
    for (const d of DASHBOARD_ENDINGS) {
      out.push({ key: `${s.route}:${d.reason}`, route: s.route, title: d.title, result: d.result, lesson: db.routes[s.route].lessons?.[d.reason] });
    }
  }
  return out;
}
