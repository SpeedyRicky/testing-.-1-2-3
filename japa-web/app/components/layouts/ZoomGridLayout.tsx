"use client";

import { CheckCircle2, Mic, MicOff, MonitorUp, PhoneOff, RotateCcw, Users, Video, XCircle } from "lucide-react";
import { DB, choose, currentScene, explainResolution, presentChoices } from "@/game/engine";
import { describeChoice } from "@/game/cinematic";
import { rolls as rollDice } from "@/game/rng";
import { OddsChip } from "../OddsChip";
import { useCinematic } from "../Cinematic";
import { useChoiceKeys } from "../useChoiceKeys";
import { usePlayer } from "../Player";
import type { GameState, StatKey } from "@/game/types";
import type { LayoutProps } from "../LayoutContainer";
import { FeedbackChip } from "../FeedbackChip";
import { Person, type PersonPose, type PersonWho } from "../Person";
import { ShareOnX } from "../Popups";

const PANEL: { id: string; name: string; role: string; who: PersonWho; room: string; window?: "snow" | "city" | "night" }[] = [
  { id: "vance", name: "Ms. Vance", role: "Committee Chair", who: "vance", room: "linear-gradient(#312e81, #1e1b4b)", window: "snow" },
  { id: "chen", name: "Mr. Chen", role: "Chief Technology Officer", who: "chen", room: "linear-gradient(#0e7490, #164e63)", window: "city" },
  { id: "ross", name: "Mr. Ross", role: "Managing Partner", who: "ross", room: "linear-gradient(#78350f, #451a03)", window: "snow" },
];

type TileMood = "listen" | "talk" | "win" | "fail";

/** One Zoom tile: a little 2D room with the person in it, animated by what is happening. */
function Tile({ name, role, who, room, window: win, speaking, mood, you }: {
  name: string; role: string; who: PersonWho; room: string; window?: "snow" | "city" | "night";
  speaking: boolean; mood: TileMood; you?: boolean;
}) {
  const live = speaking || you;
  const pose: PersonPose = mood === "win" ? (you ? "cheer" : "wave")
    : mood === "fail" ? (you ? "slump" : "idle")
      : speaking ? "talk" : you ? "sit" : "idle";
  return (
    <div className={`relative aspect-video max-w-full overflow-hidden rounded-xl border transition-all duration-300 ${
      speaking ? "animate-speak border-emerald-400/70" : "border-white/10"}`} style={{ background: room }}>
      <div className="zoom-room">
        <span className="prop shelf" />
        <span className={`window-pane ${win ?? ""}`} />
        <Person who={who} pose={pose} x={50} scale={1.25} />
      </div>
      <div className="absolute bottom-2 left-2 z-10 flex max-w-[90%] items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[11px] text-zinc-200">
        {live ? <Mic className="h-3 w-3 shrink-0 text-emerald-400" /> : <MicOff className="h-3 w-3 shrink-0 text-zinc-500" />}
        <span className="truncate font-medium">{name}</span>
        <span className="hidden truncate text-zinc-400 sm:inline">· {role}</span>
      </div>
      {speaking && (
        <div className="absolute right-2 top-2 z-10 hidden rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 sm:block">
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
      <div className="flex flex-col gap-2 border-t border-white/10 px-5 py-4 sm:flex-row">
        <ShareOnX className="sm:flex-1"
          text={won ? "Maple Venture Incubator just issued my Letter of Support in Japa: The Great Escape. 🇳🇬➡️🇨🇦"
            : "The Startup Visa committee passed on my pitch in Japa: The Great Escape. Back to the deck. 🇳🇬"} />
        <button onClick={onRestart} className="choice-btn flex items-center justify-center gap-2 font-medium sm:flex-1">
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
  const { play, playing } = useCinematic();
  useChoiceKeys(choices, pick, !playing && !run.outcome);
  const { t, profile } = usePlayer();
  function pick(index: number) {
    const choice = scene?.choices?.[index];
    const rolls = rollDice();
    const next = choose(DB, run, index, rolls);
    if (!choice || next === run) return;
    dispatch({ type: "CHOOSE", index, rolls });
    const asker = PANEL.find((p) => p.id === speaking)?.who ?? "vance";
    play({ spec: describeChoice(DB, run, next, t(choice.text), next.lastChoice?.label ?? choice.label, t(next.lastChoice?.feedback ?? choice.feedback)), stage: "pitch-room", reactor: asker });
  }
  const mood: TileMood = run.outcome ? (run.outcome.result === "win" ? "win" : "fail") : "listen";
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
            {PANEL.map((p) => <Tile key={p.id} {...p} speaking={speaking === p.id} mood={mood} />)}
            <Tile name={profile?.username ?? "You"} role={t("Founder, {city}")} who="you" room="linear-gradient(#14532d, #052e16)" window="night"
              speaking={false} mood={mood} you />
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
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-100">{t(scene?.dialogue)}</p>
            <div className="mt-5 space-y-2.5">
              {choices.map((c) => (
                <button key={c.index} className="choice-btn" disabled={!c.enabled} onClick={() => pick(c.index)}>
                  {t(c.text)}<OddsChip odds={c.odds} />
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
