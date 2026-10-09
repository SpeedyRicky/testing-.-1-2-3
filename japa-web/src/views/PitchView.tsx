import { CONTENT, currentNode, presentChoices, type DialogueState } from "../engine/dialogue";
import { PANEL, PITCH_STATS, activeSpeaker, resolveLetterOfSupport } from "../engine/pitch";
import type { AppEvent } from "../engine/machine";
import { StatBar } from "../components/StatBar";
import { FeedbackChip } from "../components/FeedbackChip";

const THRESHOLDS: Record<string, number> = Object.fromEntries(
  resolveLetterOfSupport({ scenarioId: "", nodeId: "", stats: {}, flags: {}, feedback: null, outcome: null, transcript: [] })
    .criteria.map((c) => [c.key, c.threshold]),
);
const TONES = ["emerald", "sky", "violet"] as const;

function MicIcon({ muted }: { muted?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      {muted && <path d="M4 4l16 16" className="text-rose-400" stroke="currentColor" />}
    </svg>
  );
}

function Tile({ name, role, initials, hue, speaking, you }: {
  name: string; role: string; initials: string; hue: string; speaking: boolean; you?: boolean;
}) {
  return (
    <div
      className={`relative aspect-video overflow-hidden rounded-xl border bg-zinc-900 transition-all duration-300 ${
        speaking ? "animate-speak border-emerald-400/70" : "border-white/10"
      }`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${hue}`} />
      <div className="absolute inset-0 flex items-center justify-center pb-7 sm:pb-4">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-zinc-950/60 text-xs font-semibold tracking-wide sm:h-16 sm:w-16 sm:text-lg ${
            speaking ? "text-emerald-300" : "text-zinc-300"
          }`}
        >
          {initials}
        </div>
      </div>
      <div className="absolute bottom-2 left-2 flex max-w-[90%] items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[11px] text-zinc-200">
        <span className={speaking ? "text-emerald-400" : "text-zinc-400"}>
          <MicIcon muted={!speaking && !you} />
        </span>
        <span className="truncate font-medium">{name}</span>
        <span className="hidden truncate text-zinc-400 sm:inline">· {role}</span>
      </div>
      {speaking && (
        <div className="absolute right-2 top-2 hidden rounded bg-emerald-500/20 sm:block px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
          Speaking
        </div>
      )}
    </div>
  );
}

function Resolution({ state, onRestart }: { state: DialogueState; onRestart: () => void }) {
  const r = resolveLetterOfSupport(state);
  return (
    <div className="card animate-fade-in overflow-hidden">
      <div className={`border-b border-white/10 px-5 py-4 ${r.issued ? "bg-amber-400/10" : "bg-rose-500/10"}`}>
        <div className="eyebrow">Letter of Support resolution</div>
        <div className={`mt-1 text-xl font-semibold ${r.issued ? "text-amber-300" : "text-rose-300"}`}>
          {r.issued ? "Letter of Support issued" : "Pitch declined"}
        </div>
      </div>
      <div className="divide-y divide-white/10">
        {r.criteria.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <span className="text-zinc-300">{c.label}</span>
            <span className="flex items-center gap-3 font-mono tabular-nums">
              <span className="text-zinc-500">
                {c.op} {c.threshold}
              </span>
              <span className={c.passed ? "text-emerald-400" : "text-rose-400"}>{Math.round(c.value)}</span>
              <span aria-label={c.passed ? "passed" : "failed"} className={c.passed ? "text-emerald-400" : "text-rose-400"}>
                {c.passed ? "✓" : "✕"}
              </span>
            </span>
          </div>
        ))}
        {r.informational.map((i) => (
          <div key={i.key} className="flex items-center justify-between px-5 py-3 text-sm">
            <span className="text-zinc-500">{i.label} (tracked, not scored)</span>
            <span className="font-mono tabular-nums text-zinc-400">{Math.round(i.value)}</span>
          </div>
        ))}
      </div>
      <p className="border-t border-white/10 px-5 py-4 text-sm leading-relaxed text-zinc-400">{r.summary}</p>
      <div className="border-t border-white/10 px-5 py-4">
        <button onClick={onRestart} className="choice-btn text-center font-medium">
          Pitch again
        </button>
      </div>
    </div>
  );
}

export function PitchView({ state, dispatch }: { state: DialogueState; dispatch: (e: AppEvent) => void }) {
  const node = currentNode(CONTENT, state);
  const speaking = state.outcome ? null : activeSpeaker(node?.speaker);
  const choices = presentChoices(CONTENT, state);
  const answered = state.transcript.filter((t) => t.answer).length;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
      <section className="lg:col-start-1 lg:row-start-1">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-xs">
            <span className="flex items-center gap-2 text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> REC · Maple Venture Incubator · Committee review
            </span>
            <span className="font-mono text-zinc-500">Q{Math.min(answered + 1, 3)}/3</span>
          </div>
          <div className="grid grid-cols-2 gap-2 p-2 sm:gap-3 sm:p-3">
            {PANEL.map((p) => (
              <Tile key={p.id} {...p} speaking={speaking === p.id} />
            ))}
            <Tile name="You" role="Founder, Lagos" initials="YOU" hue="from-emerald-500/25 to-teal-500/5" speaking={false} you />
          </div>
          <div className="flex items-center justify-center gap-2 border-t border-white/10 px-4 py-3">
            {["Mute", "Stop video", "Share screen", "Participants (4)"].map((b) => (
              <span key={b} className="hidden rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-zinc-400 sm:inline">
                {b}
              </span>
            ))}
            <span className="rounded-lg bg-rose-600/90 px-3 py-1.5 text-[11px] font-semibold text-white">Leave</span>
          </div>
        </div>
      </section>

      <section className="space-y-3 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        {state.outcome ? (
          <Resolution state={state} onRestart={() => dispatch({ type: "PITCH_RESTART" })} />
        ) : (
          <div className="card animate-fade-in p-5" key={state.nodeId}>
            <div className="eyebrow">{node?.speaker}</div>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-100">{node?.text}</p>
            <div className="mt-5 space-y-2.5">
              {choices.map((c) => (
                <button
                  key={c.index}
                  className="choice-btn"
                  disabled={!c.enabled}
                  onClick={() => dispatch({ type: "PITCH_CHOOSE", index: c.index })}
                >
                  {c.text}
                  {!c.enabled && c.locked_hint && <span className="mt-1 block text-xs text-zinc-500">Locked: {c.locked_hint}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        <FeedbackChip feedback={state.feedback} />
      </section>
      <section className="lg:col-start-1 lg:row-start-2 lg:self-start">
        <div className="card space-y-4 p-5">
          <div className="eyebrow">Committee sentiment</div>
          {PITCH_STATS.map((s, i) => (
            <StatBar key={s.key} label={s.label} value={state.stats[s.key] ?? 0} tone={TONES[i]} threshold={THRESHOLDS[s.key]} />
          ))}
          <p className="text-[11px] leading-relaxed text-zinc-500">White tick marks the Letter of Support threshold.</p>
        </div>
      </section>
    </div>
  );
}
