"use client";

import { Building2, RotateCcw } from "lucide-react";
import { DB, currentScene, formatLabel, presentChoices } from "@/game/engine";
import type { LayoutProps } from "../LayoutContainer";
import { FeedbackChip } from "../FeedbackChip";

export function CorporateOfficeLayout({ run, dispatch, bars }: LayoutProps) {
  const scene = currentScene(DB, run);
  const choices = presentChoices(DB, run);
  const won = run.outcome?.result === "win";
  // Past exchanges: every visited dialogue scene that got an answer.
  const transcript = run.history.filter((h) => h.answer).map((h) => ({ ...h, scene: DB.scenes[h.sceneId] }));

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900 via-[#0f1622] to-[#0b0f16]">
      <div className="relative border-b border-white/10 px-5 py-5 sm:px-6">
        {/* Glass-wall mullions */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent_calc(25%-1px),rgba(255,255,255,.04)_25%,transparent_calc(25%+1px),transparent_calc(50%-1px),rgba(255,255,255,.04)_50%,transparent_calc(50%+1px),transparent_calc(75%-1px),rgba(255,255,255,.04)_75%,transparent_calc(75%+1px))]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-amber-200/20 bg-gradient-to-br from-slate-700 to-slate-900 font-serif text-lg text-amber-100">
              MK
            </div>
            <div className="min-w-0">
              <div className="eyebrow flex items-center gap-1.5 text-amber-200/60">
                <Building2 className="h-3 w-3" /> Northline Logistics · Boardroom 4B · Mississauga
              </div>
              <div className="mt-0.5 font-serif text-2xl text-zinc-50">Mr. Kovacs</div>
              <div className="text-xs text-zinc-400">Operations Director</div>
            </div>
          </div>
          {run.flags.from_tourist_gamble && (
            <div className="rounded-full border border-amber-300/20 bg-amber-300/5 px-3 py-1 text-[11px] text-amber-200/80">
              Via the Tourist Gamble · {run.timeRemainingDays} days left on your visit
            </div>
          )}
        </div>
      </div>
      <div className="h-1.5 bg-gradient-to-r from-[#3b2414] via-[#6b4226] to-[#3b2414]" aria-hidden />

      <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-4 p-5 sm:p-6 lg:border-r lg:border-white/10">
          {transcript.map((t, i) => (
            <div key={i} className="space-y-2">
              <div className="rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-zinc-300">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-200/60">{t.scene?.speaker}</div>
                {t.scene?.dialogue}
              </div>
              <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm border border-sky-400/20 bg-sky-400/[0.06] px-4 py-3 text-sm leading-relaxed text-zinc-200">
                {t.answer}
                {t.label && <div className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-sky-300/70">{formatLabel(t.label)}</div>}
              </div>
            </div>
          ))}

          {!run.outcome && scene && (
            <div key={run.currentSceneId} className="animate-fade-in space-y-3">
              <div className="rounded-2xl rounded-tl-sm border border-amber-200/15 bg-amber-100/[0.03] px-4 py-3 text-[15px] leading-relaxed text-zinc-100">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-200/70">{scene.speaker}</div>
                {scene.dialogue}
              </div>
              <div className="eyebrow pt-2">Your response</div>
              {choices.map((c) => (
                <button key={c.index} className="choice-btn" disabled={!c.enabled} onClick={() => dispatch({ type: "CHOOSE", index: c.index })}>
                  {c.text}
                </button>
              ))}
            </div>
          )}

          {run.outcome && (
            <div className={`animate-fade-in rounded-2xl border p-5 ${won ? "border-emerald-400/30 bg-emerald-400/[0.05]" : "border-rose-500/30 bg-rose-500/[0.05]"}`}>
              <div className={`font-serif text-xl ${won ? "text-emerald-300" : "text-rose-300"}`}>{run.outcome.title}</div>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">{run.outcome.subtitle ?? scene?.dialogue}</p>
              <button onClick={() => dispatch({ type: "RESTART" })} className="choice-btn mt-4 flex items-center justify-center gap-2 font-medium">
                <RotateCcw className="h-4 w-4" /> Request another meeting
              </button>
            </div>
          )}
        </section>

        <aside className="min-w-0 space-y-5 border-t border-white/10 p-5 sm:p-6 lg:border-t-0">
          <div className="eyebrow">Meeting read-out</div>
          {bars}
          <FeedbackChip choice={run.lastChoice} />
          <p className="text-[11px] leading-relaxed text-zinc-500">
            An LMIA is applied for by the employer, not bought. Suggesting a fake posting is misrepresentation and ends the meeting.
          </p>
        </aside>
      </div>
    </div>
  );
}
