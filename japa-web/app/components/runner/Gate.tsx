"use client";

// The checkpoint gate before a story chapter: an optional run. Play it for JP and calm, or skip straight to the scene.
import { useState } from "react";
import { Footprints } from "lucide-react";
import type { AppEvent } from "@/game/machine";
import type { GameState } from "@/game/types";
import { GATES, LEVELS } from "@/game/runner/levels";
import { usePlayer } from "../Player";
import { awardRunner } from "../Meta";
import { track } from "../../launch/analytics";
import { Runner, type RunResult } from "./Runner";

export function RunnerGate({ run, dispatch }: { run: GameState; dispatch: React.Dispatch<AppEvent> }) {
  const { profile } = usePlayer();
  const [open, setOpen] = useState(false);
  const sector = GATES[run.currentSceneId];
  if (!sector || run.outcome || run.flags[`runner_${sector}`]) return null;
  const level = LEVELS[sector];

  const done = (r: RunResult) => {
    setOpen(false);
    awardRunner(profile?.username ?? "guest", sector, r.jp, level.title);
    dispatch({ type: "RUNNER_REWARD", sector, effects: r.effects });
    track("runner_end", { sector, done: r.done, coins: r.coins });
  };
  const skip = () => {
    setOpen(false);
    dispatch({ type: "RUNNER_REWARD", sector, effects: { desperation: -2 } });
    track("runner_skip", { sector });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-[1.6rem] border border-amber-300/30 bg-gradient-to-r from-amber-500/15 via-fuchsia-500/10 to-transparent px-4 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-300 text-zinc-950"><Footprints className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-200">Optional run · about a minute</p>
          <p className="text-sm font-semibold text-white">{level.title}: race to the {level.gateLabel}. Coins become Japa Points and calm.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={skip} className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-white/30">Skip</button>
          <button type="button" onClick={() => { setOpen(true); track("runner_open", { sector }); }}
            className="rounded-xl bg-amber-300 px-4 py-2 text-xs font-black text-zinc-950 hover:bg-amber-200">Play the run</button>
        </div>
      </div>
      {open ? <Runner level={level} avatar={profile?.avatar} onFinish={done} onClose={skip} /> : null}
    </>
  );
}
