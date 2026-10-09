"use client";

import { CheckCircle2, Mic, MicOff, MonitorUp, PhoneOff, RotateCcw, Users, Video, XCircle } from "lucide-react";
import { DB, currentScene, explainResolution, presentChoices } from "@/game/engine";
import type { GameState, StatKey } from "@/game/types";
import type { LayoutProps } from "../LayoutContainer";
import { FeedbackChip } from "../FeedbackChip";

const PANEL = [
  { id: "vance", name: "Ms. Vance", role: "Committee Chair", initials: "EV", hue: "from-indigo-500/30 to-violet-500/10" },
  { id: "chen", name: "Mr. Chen", role: "Chief Technology Officer", initials: "DC", hue: "from-sky-500/30 to-cyan-500/10" },
  { id: "ross", name: "Mr. Ross", role: "Managing Partner", initials: "JR", hue: "from-amber-500/30 to-orange-500/10" },
];

function Tile({ name, role, initials, hue, speaking, you }: {
  name: string; role: string; initials: string; hue: string; speaking: boolean; you?: boolean;
}) {
  const live = speaking || you;
  return (
    <div className={`relative aspect-video max-w-full overflow-hidden rounded-xl border bg-zinc-900 transition-all duration-300 ${
      speaking ? "animate-speak border-emerald-400/70" : "border-white/10"}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${hue}`} />
      <div className="absolute inset-0 flex items-center justify-center pb-7 sm:pb-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-zinc-950/60 text-xs font-semibold tracking-wide sm:h-16 sm:w-16 sm:text-lg ${
          speaking ? "text-emerald-300" : "text-zinc-300"}`}>
          {initials}
        </div>
      </div>
      <div className="absolute bottom-2 left-2 flex max-w-[90%] items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[11px] text-zinc-200">
        {live ? <Mic className="h-3 w-3 shrink-0 text-emerald-400" /> : <MicOff className="h-3 w-3 shrink-0 text-zinc-500" />}
        <span className="truncate font-medium">{name}</span>
        <span className="hidden truncate text-zinc-400 sm:inline">· {role}</span>
      </div>
      {speaking && (
        <div className="absolute right-2 top-2 hidden rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 sm:block">
          Speaking
        </div>
      )}
    </div>
  );
}

const LABELS: Partial<Record<StatKey, string>> = Object.fromEntries(DB.routes.STARTUP_VISA.bars.map((b) => [b.key, b.label]));

function Resolution({ run, onRestart }: { run: GameState; onRestart: () => void }) {
  const won = run.outcome?.result === "win";
  const criteria = run.outcome?.decidedBy ? explainResolution(DB, run.outcome.decidedBy, run) : [];
  const scored = new Set(criteria.map((c) => c.key));
  const tracked = DB.routes.STARTUP_VISA.bars.filter((b) => !scored.has(b.key));
  const short = criteria.filter((c) => !c.passed);
  return (
    <div className="card animate-fade-in overflow-hidden">
      <div className={`border-b border-white/10 px-5 py-4 ${won ? "bg-amber-400/10" : "bg-rose-500/10"}`}>
        <div className="eyebrow">Letter of Support resolution</div>
        <div className={`mt-1 text-xl font-semibold ${won ? "text-amber-300" : "text-rose-300"}`}>
          {won ? "Letter of Support issued" : "Pitch declined"}
        </div>
      </div>
      <div className="divide-y divide-white/10">
        {criteria.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <span className="text-zinc-300">{LABELS[c.key] ?? c.key}</span>
            <span className="flex items-center gap-3 font-mono tabular-nums">
              <span className="text-zinc-500">{c.op} {c.threshold}</span>
              <span className={c.passed ? "text-emerald-400" : "text-rose-400"}>{Math.round(c.value)}</span>
              {c.passed ? <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-label="passed" /> : <XCircle className="h-4 w-4 text-rose-400" aria-label="failed" />}
            </span>
          </div>
        ))}
        {tracked.map((b) => (
          <div key={b.key} className="flex items-center justify-between px-5 py-3 text-sm">
            <span className="text-zinc-500">{b.label} (tracked, not scored)</span>
            <span className="font-mono tabular-nums text-zinc-400">{Math.round(run.routeStats[b.key as "scalabilityScore"] ?? 0)}</span>
          </div>
        ))}
      </div>
      <p className="border-t border-white/10 px-5 py-4 text-sm leading-relaxed text-zinc-400">
        {won
          ? currentScene(DB, run)?.dialogue
          : `${currentScene(DB, run)?.dialogue ?? ""} Short on: ${short.map((c) => `${LABELS[c.key]} (${Math.round(c.value)} of ${c.threshold})`).join(", ")}.`}
      </p>
      <div className="border-t border-white/10 px-5 py-4">
        <button onClick={onRestart} className="choice-btn flex items-center justify-center gap-2 font-medium">
          <RotateCcw className="h-4 w-4" /> Pitch again
        </button>
      </div>
    </div>
  );
}

export function ZoomGridLayout({ run, dispatch, bars }: LayoutProps) {
  const scene = currentScene(DB, run);
  const speaking = run.outcome ? null : PANEL.find((p) => scene?.speaker?.startsWith(p.name))?.id ?? null;
  const choices = presentChoices(DB, run);
  const answered = run.history.filter((h) => h.answer).length;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
      <section className="min-w-0 lg:col-start-1 lg:row-start-1">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-zinc-400">
              <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
              <span className="truncate">REC · Maple Venture Incubator · Committee review</span>
            </span>
            <span className="font-mono text-zinc-500">Q{Math.min(answered + 1, 3)}/3</span>
          </div>
          <div className="grid grid-cols-2 gap-2 p-2 sm:gap-3 sm:p-3">
            {PANEL.map((p) => <Tile key={p.id} {...p} speaking={speaking === p.id} />)}
            <Tile name="You" role="Founder, Lagos" initials="YOU" hue="from-emerald-500/25 to-teal-500/5" speaking={false} you />
          </div>
          <div className="flex items-center justify-center gap-2 border-t border-white/10 px-4 py-3 text-[11px] text-zinc-400">
            {[[Mic, "Mute"], [Video, "Stop video"], [MonitorUp, "Share"], [Users, "Participants (4)"]].map(([Icon, label]) => {
              const I = Icon as typeof Mic;
              return (
                <span key={label as string} className="hidden items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 sm:flex">
                  <I className="h-3.5 w-3.5" /> {label as string}
                </span>
              );
            })}
            <span className="flex items-center gap-1.5 rounded-lg bg-rose-600/90 px-3 py-1.5 font-semibold text-white">
              <PhoneOff className="h-3.5 w-3.5" /> Leave
            </span>
          </div>
        </div>
      </section>

      <section className="min-w-0 space-y-3 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        {run.outcome ? (
          <Resolution run={run} onRestart={() => dispatch({ type: "RESTART" })} />
        ) : (
          <div className="card animate-fade-in p-5" key={run.currentSceneId}>
            <div className="eyebrow">{scene?.speaker}</div>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-100">{scene?.dialogue}</p>
            <div className="mt-5 space-y-2.5">
              {choices.map((c) => (
                <button key={c.index} className="choice-btn" disabled={!c.enabled} onClick={() => dispatch({ type: "CHOOSE", index: c.index })}>
                  {c.text}
                  {!c.enabled && c.lockedHint && <span className="mt-1 block text-xs text-zinc-500">Locked: {c.lockedHint}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        <FeedbackChip choice={run.lastChoice} />
      </section>

      <section className="min-w-0 lg:col-start-1 lg:row-start-2 lg:self-start">
        <div className="card space-y-4 p-5">
          <div className="eyebrow">Committee sentiment</div>
          {bars}
          <p className="text-[11px] leading-relaxed text-zinc-500">White tick marks the Letter of Support threshold.</p>
        </div>
      </section>
    </div>
  );
}
