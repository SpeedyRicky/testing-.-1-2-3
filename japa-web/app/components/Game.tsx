"use client";

import { useReducer } from "react";
import { RotateCcw } from "lucide-react";
import { DB } from "@/game/engine";
import { activeRun, initialState, reducer } from "@/game/machine";
import type { RouteId } from "@/game/types";
import { LayoutContainer } from "./LayoutContainer";
import { LagosBackdrop } from "./layouts/LagosStageLayout";
import { CinematicProvider, SpeedToggle } from "./Cinematic";

const ROUTES = Object.keys(DB.routes) as RouteId[];

export function Game() {
  return (
    <CinematicProvider>
      <GameScreen />
    </CinematicProvider>
  );
}

function GameScreen() {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState());
  const run = activeRun(state);
  const cfg = DB.routes[state.activeRoute];

  return (
    <div className="relative min-h-screen w-full">
      {/* Route backdrop sits behind everything, outside main's stacking context. */}
      {run && DB.scenes[run.currentSceneId]?.layoutType === "STORY_STAGE" && <LagosBackdrop route={state.activeRoute} />}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-bold text-zinc-950">J</div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Japa: The Great Escape</div>
              <div className="text-[11px] text-zinc-500">Lagos → Canada simulator</div>
            </div>
          </div>
          <nav role="tablist" aria-label="Route" className="flex w-full gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1 sm:w-auto">
            {ROUTES.map((r) => {
              const route = DB.routes[r];
              const soon = route.status !== "playable";
              const active = state.activeRoute === r;
              return (
                <button
                  key={r}
                  role="tab"
                  aria-selected={active}
                  disabled={soon}
                  title={soon ? `${route.title}: coming soon` : route.title}
                  onClick={() => dispatch({ type: "SELECT_ROUTE", route: r })}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                    active ? "bg-white/10 text-white shadow-sm" : soon ? "cursor-not-allowed text-zinc-600" : "text-zinc-400 hover:text-zinc-200"}`}
                >
                  {route.short}
                  {soon && <span className="rounded bg-white/5 px-1 py-px text-[9px] uppercase tracking-wider text-zinc-500">Soon</span>}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">{cfg.title}</h1>
          <div className="flex shrink-0 items-center gap-2">
          <SpeedToggle />
          <button
            type="button"
            onClick={() => dispatch({ type: "RESTART" })}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:-translate-y-0.5 hover:border-amber-300/60 hover:text-white active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset run
          </button>
          </div>
        </div>
        {run && (
          <div key={state.activeRoute} className="animate-fade-in">
            <LayoutContainer run={run} dispatch={dispatch} toast={state.toast} />
          </div>
        )}
      </main>

      <footer className="relative z-10 mx-auto max-w-6xl border-t border-white/10 px-4 py-6 text-[11px] leading-relaxed text-zinc-500 sm:px-6">
        A simulation for entertainment. It is not legal or immigration advice. Numbers are illustrative; rules, fees and
        cutoffs change often, so check IRCC (canada.ca) before you act.
      </footer>
    </div>
  );
}
