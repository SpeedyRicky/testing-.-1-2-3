import { useReducer } from "react";
import { MODES, initialState, reducer } from "./engine/machine";
import { PitchView } from "./views/PitchView";
import { TouristView } from "./views/TouristView";
import { LmiaView } from "./views/LmiaView";

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const active = MODES.find((m) => m.id === state.mode)!;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.08),transparent_55%)]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-bold text-zinc-950">J</div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Japa: The Great Escape</div>
              <div className="text-[11px] text-zinc-500">Lagos → Canada simulator</div>
            </div>
          </div>
          <nav role="tablist" aria-label="Game mode" className="flex w-full gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 sm:w-auto">
            {MODES.map((m) => (
              <button
                key={m.id}
                role="tab"
                aria-selected={state.mode === m.id}
                onClick={() => dispatch({ type: "SWITCH_MODE", mode: m.id })}
                className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 sm:flex-none ${
                  state.mode === m.id ? "bg-white/10 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {m.short}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="mb-5 text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">{active.label}</h1>
        <div key={state.mode} className="animate-fade-in">
          {state.mode === "pitch" && <PitchView state={state.pitch} dispatch={dispatch} />}
          {state.mode === "tourist" && <TouristView state={state.tourist} dispatch={dispatch} />}
          {state.mode === "lmia" && <LmiaView state={state.lmia} dispatch={dispatch} />}
        </div>
      </main>

      <footer className="mx-auto max-w-6xl border-t border-white/10 px-4 py-6 text-[11px] leading-relaxed text-zinc-500 sm:px-6">
        A simulation for entertainment. It is not legal or immigration advice. Numbers are illustrative; rules, fees and
        cutoffs change often, so check IRCC (canada.ca) before you act.
      </footer>
    </div>
  );
}
