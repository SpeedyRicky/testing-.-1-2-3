"use client";

import { useEffect } from "react";
import { ArrowRight, Clock, MapPin, RotateCcw, Target, Wallet, X } from "lucide-react";
import { DB, canTake, currentScene, dashboardOf, leadChance } from "@/game/engine";
import type { DashboardAction } from "@/game/types";
import type { LayoutProps } from "../LayoutContainer";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

function Counter({ icon: Icon, label, children, sub }: {
  icon: typeof Clock; label: string; children: React.ReactNode; sub?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 p-4 sm:p-5">
      <div className="eyebrow flex items-center gap-1.5"><Icon className="h-3 w-3" /> {label}</div>
      <div className="mt-1.5 font-mono text-2xl font-medium tabular-nums text-zinc-50">{children}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

function costLine(a: DashboardAction) {
  const e = a.effects;
  const parts = [`${-(e.timeRemainingDays ?? 0)}d`];
  if (e.energy) parts.push(`${e.energy > 0 ? "+" : ""}${e.energy} energy`);
  if (e.walletCad) parts.push(`${e.walletCad > 0 ? "+" : "-"}CAD ${Math.abs(e.walletCad)}`);
  if (e.desperation) parts.push(`${e.desperation > 0 ? "+" : ""}${e.desperation} desperation`);
  return parts.join(" · ");
}

export function DashboardLayout({ run, dispatch, bars, toast }: LayoutProps) {
  // The dashboard config lives on the hub scene; after a win the run sits on the win scene.
  const hub = dashboardOf(DB, run) ?? DB.scenes[DB.routes.TOURIST_GAMBLE.startSceneId!].dashboard!;
  const scene = currentScene(DB, run);
  const leads = run.routeStats.employerLeads ?? 0;
  const status = run.outcome ? (run.outcome.result === "win" ? "won" : "lost") : "playing";
  const day = 1 + (DB.routes.TOURIST_GAMBLE.initialState?.timeRemainingDays ?? 180) - run.timeRemainingDays;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => dispatch({ type: "DISMISS_TOAST" }), 4500);
    return () => clearTimeout(t);
  }, [toast, dispatch]);

  return (
    <div className="space-y-5">
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-5 py-3">
          <div className="font-mono text-xs tracking-wider text-zinc-400">
            THE 180-DAY TOURIST GAMBLE <span className="text-zinc-600">//</span> DAY {day}
          </div>
          <div className="text-xs text-zinc-500">
            Status:{" "}
            <span className={status === "playing" ? "text-amber-300" : status === "won" ? "text-emerald-400" : "text-rose-400"}>
              {status === "playing" ? "Visitor · job hunting" : status === "won" ? "Interview secured" : "Run over"}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-white/10 border-b border-white/10 md:grid-cols-4 md:divide-y-0">
          <Counter icon={Clock} label="Tourist time remaining" sub="of 180 days">
            <span className={run.timeRemainingDays <= 45 ? "text-rose-400" : undefined}>{run.timeRemainingDays}</span>
            <span className="text-base text-zinc-500"> days</span>
          </Counter>
          <Counter icon={Wallet} label="Wallet" sub={`≈ ₦${fmt(run.walletCad * hub.ngnPerCad)} at ₦${fmt(hub.ngnPerCad)}/CAD`}>
            ${fmt(run.walletCad)} <span className="text-base text-zinc-500">CAD</span>
          </Counter>
          <Counter icon={Target} label="Employer leads" sub={`${hub.leadsToWin} unlock the LMIA interview`}>
            {leads}<span className="text-base text-zinc-500">/{hub.leadsToWin}</span>
          </Counter>
          <Counter icon={MapPin} label="Location" sub="Greater Toronto Area">
            <span className="block truncate font-sans text-base font-medium leading-8" title={run.currentLocation}>{run.currentLocation}</span>
          </Counter>
        </div>
        <div className="p-5 [&>div]:grid [&>div]:gap-4 [&>div]:space-y-0 sm:[&>div]:grid-cols-3">{bars}</div>
      </div>

      {run.outcome ? (
        <div className={`card animate-fade-in p-5 ${status === "won" ? "border-emerald-400/30" : "border-rose-500/30"}`}>
          <div className={`text-lg font-semibold ${status === "won" ? "text-emerald-300" : "text-rose-300"}`}>{run.outcome.title}</div>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">{run.outcome.subtitle ?? scene?.dialogue}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {scene?.unlocksRoute && status === "won" && (
              <button onClick={() => dispatch({ type: "FOLLOW_UNLOCK" })}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400">
                Walk into the boardroom <ArrowRight className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => dispatch({ type: "RESTART" })}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-white/25">
              <RotateCcw className="h-4 w-4" /> Start a new 180 days
            </button>
          </div>
        </div>
      ) : (
        <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">{scene?.dialogue}</p>
      )}

      <div>
        <div className="eyebrow mb-3">Daily strategic actions</div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {hub.actions.map((a) => {
            const ok = canTake(run, a);
            const chance = leadChance(run, a);
            return (
              <button
                key={a.id}
                disabled={!ok}
                onClick={() => dispatch({ type: "TAKE_ACTION", actionId: a.id, rolls: [Math.random(), Math.random()] })}
                className={`rounded-2xl border p-4 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 disabled:cursor-not-allowed disabled:opacity-40 ${
                  a.fatal ? "border-rose-500/20 bg-rose-500/[0.04] hover:border-rose-500/40"
                    : "border-white/10 bg-white/[0.03] hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.06]"}`}
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

      {toast && (
        <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:justify-end">
          <div key={toast.id} role="status"
            className={`pointer-events-auto w-full max-w-sm animate-toast-in rounded-2xl border bg-zinc-900/95 p-4 shadow-2xl shadow-black/50 backdrop-blur ${
              toast.tone === "good" ? "border-emerald-400/40" : toast.tone === "bad" ? "border-rose-500/40" : "border-white/15"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className={`text-sm font-semibold ${toast.tone === "good" ? "text-emerald-300" : toast.tone === "bad" ? "text-rose-300" : "text-zinc-100"}`}>
                {toast.title}
              </div>
              <button onClick={() => dispatch({ type: "DISMISS_TOAST" })} className="text-zinc-500 hover:text-zinc-300" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-zinc-300">{toast.text}</p>
          </div>
        </div>
      )}
    </div>
  );
}
