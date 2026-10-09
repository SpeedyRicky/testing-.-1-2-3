import { useEffect } from "react";
import { ACTIONS, LEADS_TO_WIN, NGN_PER_CAD, START_DAYS, canTake, leadChance, ngn, type TouristState } from "../engine/tourist";
import type { AppEvent } from "../engine/machine";
import { StatBar } from "../components/StatBar";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

function Counter({ label, children, sub }: { label: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="p-4 sm:p-5">
      <div className="eyebrow">{label}</div>
      <div className="mt-1.5 font-mono text-2xl font-medium tabular-nums text-zinc-50 transition-all duration-300">{children}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

function costLine(a: (typeof ACTIONS)[number]) {
  const parts = [`${a.days}d`];
  if (a.energy) parts.push(`${a.energy > 0 ? "+" : ""}${a.energy} energy`);
  if (a.cad) parts.push(`${a.cad > 0 ? "+" : "-"}CAD ${Math.abs(a.cad)}`);
  if (a.desperation) parts.push(`${a.desperation > 0 ? "+" : ""}${a.desperation} desperation`);
  return parts.join(" · ");
}

export function TouristView({ state, dispatch }: { state: TouristState; dispatch: (e: AppEvent) => void }) {
  const toast = state.toast;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => dispatch({ type: "TOURIST_DISMISS_TOAST" }), 4500);
    return () => clearTimeout(t);
  }, [toast, dispatch]);

  const timeTone = state.daysLeft > 90 ? "emerald" : state.daysLeft > 45 ? "amber" : "rose";

  return (
    <div className="space-y-5">
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-5 py-3">
          <div className="font-mono text-xs tracking-wider text-zinc-400">
            THE 180-DAY TOURIST GAMBLE <span className="text-zinc-600">//</span> DAY {state.day}
          </div>
          <div className="text-xs text-zinc-500">
            Status:{" "}
            <span className={state.status === "playing" ? "text-amber-300" : state.status === "won" ? "text-emerald-400" : "text-rose-400"}>
              {state.status === "playing" ? "Visitor · job hunting" : state.status === "won" ? "Interview secured" : "Run over"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-white/10 border-b border-white/10 md:grid-cols-4 md:divide-y-0">
          <Counter label="Tourist time remaining" sub={`of ${START_DAYS} days`}>
            <span className={state.daysLeft <= 45 ? "text-rose-400" : undefined}>{state.daysLeft}</span>
            <span className="text-base text-zinc-500"> days</span>
          </Counter>
          <Counter label="Wallet (CAD)" sub={`≈ ₦${fmt(ngn(state.cad))} at ₦${fmt(NGN_PER_CAD)}/CAD`}>
            ${fmt(state.cad)}
          </Counter>
          <Counter label="Employer leads" sub={`${LEADS_TO_WIN} unlock the LMIA interview`}>
            {state.leads}
            <span className="text-base text-zinc-500">/{LEADS_TO_WIN}</span>
          </Counter>
          <Counter label="Location" sub="Greater Toronto Area">
            <span className="block truncate font-sans text-base font-medium leading-8" title={state.location}>
              {state.location}
            </span>
          </Counter>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <StatBar label="Time remaining" value={state.daysLeft} max={START_DAYS} tone={timeTone} suffix="d" />
          <StatBar label="Energy" value={state.energy} tone="sky" />
          <StatBar label="Desperation" value={state.desperation} tone="rose" invert />
        </div>
      </div>

      {state.status !== "playing" ? (
        <div className={`card animate-fade-in p-5 ${state.status === "won" ? "border-emerald-400/30" : "border-rose-500/30"}`}>
          <div className={`text-lg font-semibold ${state.status === "won" ? "text-emerald-300" : "text-rose-300"}`}>
            {state.status === "won" ? "You got the meeting." : "The gamble didn't pay off."}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">{state.endReason}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {state.status === "won" && (
              <button
                onClick={() => dispatch({ type: "LMIA_FROM_TOURIST" })}
                className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
              >
                Walk into the boardroom →
              </button>
            )}
            <button onClick={() => dispatch({ type: "TOURIST_RESTART" })} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-white/25">
              Start a new 180 days
            </button>
          </div>
        </div>
      ) : null}

      <div>
        <div className="eyebrow mb-3">Daily strategic actions</div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ACTIONS.map((a) => {
            const ok = canTake(state, a);
            const chance = leadChance(state, a);
            return (
              <button
                key={a.id}
                disabled={!ok}
                onClick={() => dispatch({ type: "TOURIST_ACTION", actionId: a.id, rolls: [Math.random(), Math.random()] })}
                className={`group rounded-2xl border p-4 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 disabled:cursor-not-allowed disabled:opacity-40 ${
                  a.fatal
                    ? "border-rose-500/20 bg-rose-500/[0.04] hover:border-rose-500/40"
                    : "border-white/10 bg-white/[0.03] hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.06]"
                }`}
              >
                <div className="text-sm font-semibold text-zinc-100">{a.label}</div>
                <div className="mt-0.5 text-xs text-zinc-500">{a.blurb}</div>
                <div className="mt-3 font-mono text-[11px] text-zinc-400">{costLine(a)}</div>
                {chance > 0 && <div className="mt-1 font-mono text-[11px] text-emerald-400/80">Lead chance {Math.round(chance * 100)}%</div>}
                {a.fatal && <div className="mt-1 text-[11px] text-rose-400/80">Looks tempting.</div>}
              </button>
            );
          })}
        </div>
      </div>

      {state.log.length > 0 && (
        <div className="card">
          <div className="eyebrow border-b border-white/10 px-5 py-3">Journal</div>
          <ul className="max-h-64 divide-y divide-white/10 overflow-y-auto">
            {state.log.map((l, i) => (
              <li key={`${l.day}-${i}`} className="px-5 py-3 text-sm">
                <span className="mr-2 font-mono text-xs text-zinc-500">Day {l.day}</span>
                <span className="font-medium text-zinc-300">{l.action}.</span> <span className="text-zinc-400">{l.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:justify-end">
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto w-full max-w-sm animate-toast-in rounded-2xl border bg-zinc-900/95 p-4 shadow-2xl shadow-black/50 backdrop-blur ${
              toast.tone === "good" ? "border-emerald-400/40" : toast.tone === "bad" ? "border-rose-500/40" : "border-white/15"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className={`text-sm font-semibold ${toast.tone === "good" ? "text-emerald-300" : toast.tone === "bad" ? "text-rose-300" : "text-zinc-100"}`}>
                {toast.title}
              </div>
              <button onClick={() => dispatch({ type: "TOURIST_DISMISS_TOAST" })} className="text-zinc-500 hover:text-zinc-300" aria-label="Dismiss">
                ✕
              </button>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-zinc-300">{toast.text}</p>
          </div>
        </div>
      )}
    </div>
  );
}
