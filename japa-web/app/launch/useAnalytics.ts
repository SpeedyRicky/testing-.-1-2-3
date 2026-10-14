"use client";

import { useEffect, useRef } from "react";
import { endingKey } from "@/game/endings";
import { DB } from "@/game/engine";
import type { GameState } from "@/game/types";
import { track } from "./analytics";

/** Funnel events after sign-up: run_start (first choice made) → run_end (any ending). app_open and
 *  signup_complete are tracked in Game.tsx, where the sign-up screen lives. */
export function useAnalytics(run: GameState | null) {
  const started = useRef<string | null>(null);
  const ended = useRef<string | null>(null);

  const route = run?.activeRoute ?? "";
  // History starts with the opening scene, so the first choice makes it 2.
  const moves = Math.max(0, (run?.history.length ?? 1) - 1);
  const daily = Boolean(run?.mods?.daily);
  const ending = run ? endingKey(DB, run) : null;
  const result = run?.outcome?.result ?? "";

  // A run "starts" at its first choice; a new run on the same route resets the guard.
  useEffect(() => {
    if (!route) return;
    if (moves === 0) { started.current = null; ended.current = null; return; }
    if (moves >= 1 && started.current !== route) {
      started.current = route;
      track("run_start", { route, daily });
    }
  }, [route, moves, daily]);

  useEffect(() => {
    if (!ending || ended.current === ending) return;
    ended.current = ending;
    track("run_end", { route, result, ending, moves, daily, node: run?.currentSceneId ?? "", stress: run?.desperation ?? 0,
      ...(run?.routeStats.familyStrain !== undefined ? { familyStrain: run.routeStats.familyStrain } : {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ending, route, result, moves, daily]);
}
