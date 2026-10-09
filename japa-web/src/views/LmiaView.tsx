import { CONTENT, currentNode, formatTag, presentChoices, type DialogueState } from "../engine/dialogue";
import type { AppEvent } from "../engine/machine";
import { StatBar } from "../components/StatBar";
import { FeedbackChip } from "../components/FeedbackChip";

const RESOLVE = CONTENT.dialogue_nodes["kovacs_resolve"]?.auto_branch?.find((b) => b.when)?.when ?? {};
const need = (key: string) => Number(RESOLVE[`route.${key}`]?.[1] ?? 0);

export function LmiaView({ state, dispatch }: { state: DialogueState; dispatch: (e: AppEvent) => void }) {
  const node = currentNode(CONTENT, state);
  const choices = presentChoices(CONTENT, state);
  const won = state.outcome?.result === "win";

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900 via-[#0f1622] to-[#0b0f16]">
      {/* Boardroom header: glass wall, walnut table edge */}
      <div className="relative border-b border-white/10 px-6 py-5">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0,transparent_calc(25%-1px),rgba(255,255,255,.04)_25%,transparent_calc(25%+1px),transparent_calc(50%-1px),rgba(255,255,255,.04)_50%,transparent_calc(50%+1px),transparent_calc(75%-1px),rgba(255,255,255,.04)_75%,transparent_calc(75%+1px))]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-200/20 bg-gradient-to-br from-slate-700 to-slate-900 font-serif text-lg text-amber-100">
              MK
            </div>
            <div>
              <div className="eyebrow text-amber-200/60">Northline Logistics · Boardroom 4B · Mississauga</div>
              <div className="mt-0.5 font-serif text-2xl text-zinc-50">Mr. Kovacs</div>
              <div className="text-xs text-zinc-400">Operations Director</div>
            </div>
          </div>
          {state.flags.from_tourist_gamble && (
            <div className="rounded-full border border-amber-300/20 bg-amber-300/5 px-3 py-1 text-[11px] text-amber-200/80">
              Via the Tourist Gamble · desperation carried in
            </div>
          )}
        </div>
      </div>
      <div className="h-1.5 bg-gradient-to-r from-[#3b2414] via-[#6b4226] to-[#3b2414]" aria-hidden />

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="space-y-4 border-white/10 p-6 lg:border-r">
          {state.transcript.map((t, i) => (
            <div key={i} className="space-y-2">
              <div className="rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-zinc-300">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-200/60">{t.speaker}</div>
                {t.text}
              </div>
              {t.answer && (
                <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm border border-sky-400/20 bg-sky-400/[0.06] px-4 py-3 text-sm leading-relaxed text-zinc-200">
                  {t.answer}
                  {t.tag && <div className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-sky-300/70">{formatTag(t.tag)}</div>}
                </div>
              )}
            </div>
          ))}

          {!state.outcome && node && (
            <div key={state.nodeId} className="animate-fade-in space-y-3">
              <div className="rounded-2xl rounded-tl-sm border border-amber-200/15 bg-amber-100/[0.03] px-4 py-3 text-[15px] leading-relaxed text-zinc-100">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-200/70">{node.speaker}</div>
                {node.text}
              </div>
              <div className="eyebrow pt-2">Your response</div>
              {choices.map((c) => (
                <button
                  key={c.index}
                  className="choice-btn focus-visible:ring-sky-400/60"
                  disabled={!c.enabled}
                  onClick={() => dispatch({ type: "LMIA_CHOOSE", index: c.index })}
                >
                  {c.text}
                </button>
              ))}
            </div>
          )}

          {state.outcome && (
            <div className={`animate-fade-in rounded-2xl border p-5 ${won ? "border-emerald-400/30 bg-emerald-400/[0.05]" : "border-rose-500/30 bg-rose-500/[0.05]"}`}>
              <div className={`font-serif text-xl ${won ? "text-emerald-300" : "text-rose-300"}`}>
                {state.outcome.celebration?.title ?? formatTag(state.outcome.reason)}
              </div>
              {state.outcome.celebration?.subtitle && <p className="mt-1 text-sm text-zinc-400">{state.outcome.celebration.subtitle}</p>}
              <button onClick={() => dispatch({ type: "LMIA_RESTART" })} className="choice-btn mt-4 text-center font-medium">
                Request another meeting
              </button>
            </div>
          )}
        </section>

        <aside className="space-y-5 border-t border-white/10 p-6 lg:border-t-0">
          <div className="eyebrow">Meeting read-out</div>
          <StatBar label="Employer Trust" value={state.stats.employer_trust ?? 0} tone="gold" threshold={need("employer_trust")} />
          <StatBar label="LMIA Probability" value={state.stats.lmia_probability ?? 0} tone="sky" threshold={need("lmia_probability")} />
          <StatBar label="Desperation" value={state.stats.desperation ?? 0} tone="rose" invert />
          <FeedbackChip feedback={state.feedback} />
          <p className="text-[11px] leading-relaxed text-zinc-500">
            An LMIA is applied for by the employer, not bought. Suggesting a fake posting is misrepresentation and ends the meeting.
          </p>
        </aside>
      </div>
    </div>
  );
}
