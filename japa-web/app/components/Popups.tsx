"use client";

import { Flame, Ghost, GraduationCap, Plane, Share2, ShieldAlert, TriangleAlert } from "lucide-react";
import type { Popup, Rank } from "@/game/types";

/** Gradient backdrop per rank id; unknown ids fall back to the corridor look. */
const RANK_VIBE: Record<string, string> = {
  vanier: "from-amber-300/30 via-fuchsia-500/20 to-zinc-950",
  pearson: "from-red-500/25 via-zinc-900 to-green-900/40",
  village: "from-emerald-900/40 via-zinc-950 to-rose-950/50",
  flagged: "from-rose-900/50 via-zinc-950 to-zinc-900",
  pr: "from-red-600/30 via-zinc-950 to-sky-900/40",
  pgwp: "from-amber-300/25 via-red-900/30 to-zinc-950",
  hustle: "from-zinc-800 via-zinc-950 to-amber-950/40",
  protected: "from-red-600/30 via-zinc-950 to-emerald-900/40",
  interview: "from-sky-700/30 via-zinc-950 to-amber-900/30",
};

const RANK_EMOJI: Record<string, string> = {
  vanier: "🎓🔥", pearson: "🇨🇦✈️🇳🇬", village: "👻", flagged: "🚫", hustle: "🚌", pr: "🇨🇦🍁", pgwp: "🎓🍁",
  protected: "🇨🇦🛡️", interview: "💼🇨🇦", field: "💼🍁", surviving: "🧾🍁", japada: "✈️🇳🇬", lmiascam: "📄💸", caught: "🚨", ifa: "🧭🇳🇬", refused: "📄❌", abandoned: "🎉✈️", expired: "⏳", couch: "🛋️",
};

/** Ranks that celebrate a win; the rest are game overs. */
const WIN_RANKS: ReadonlySet<string> = new Set(["vanier", "pr", "pgwp", "protected", "interview"]);

function RankGlyph({ id }: { id: string }) {
  if (id === "vanier") {
    return (
      <div className="flex items-center justify-center gap-3 text-4xl">
        <GraduationCap className="h-10 w-10 text-amber-200" />
        <Flame className="h-10 w-10 text-orange-400" />
      </div>
    );
  }
  if (id === "pearson") {
    return (
      <div className="flex items-center justify-center gap-3 text-4xl">
        <span aria-hidden>🇨🇦</span>
        <Plane className="h-9 w-9 text-sky-200" />
        <span aria-hidden>🇳🇬</span>
      </div>
    );
  }
  if (id === "village") return <Ghost className="mx-auto h-10 w-10 text-lime-300" />;
  if (id === "pr") return <span className="block text-center text-4xl" aria-hidden>🇨🇦🍁</span>;
  if (id === "pgwp") {
    return (
      <div className="flex items-center justify-center gap-3 text-4xl">
        <GraduationCap className="h-10 w-10 text-amber-200" />
        <span aria-hidden>🍁</span>
      </div>
    );
  }
  if (id === "flagged") return <ShieldAlert className="mx-auto h-10 w-10 text-rose-300" />;
  if (RANK_EMOJI[id] && id !== "hustle") return <span className="block text-center text-4xl" aria-hidden>{RANK_EMOJI[id]}</span>;
  return <span className="block text-center text-4xl">🚌</span>;
}

/** Opens a pre-filled post on X. Works on every route's ending. */
export function ShareOnX({ text, className = "" }: { text: string; className?: string }) {
  return (
    <a
      href={`https://x.com/intent/post?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition duration-500 ease-out hover:bg-amber-200 ${className}`}
    >
      <Share2 className="h-4 w-4" />
      Post on X
    </a>
  );
}

/** Village People trap or parallel-market shock. */
export function PopupModal({ popup, onDismiss }: { popup: Popup; onDismiss: () => void }) {
  const market = popup.kind === "market";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div
        className={`animate-scene-in relative w-full max-w-md rounded-3xl border p-6 ${
          market
            ? "border-amber-300/40 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-[0_0_80px_-20px_rgba(251,191,36,0.7)]"
            : "border-rose-400/40 bg-gradient-to-b from-rose-950/80 to-zinc-950"
        }`}
      >
        <p className={`inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] ${market ? "text-amber-300" : "text-rose-300"}`}>
          {!market && <TriangleAlert className="h-3.5 w-3.5" />}
          {popup.kicker}
        </p>
        <h3 className="mt-2 text-2xl font-black text-white">{popup.title}</h3>
        <p className="mt-3 text-sm leading-7 text-zinc-300">{popup.body}</p>
        <button
          type="button"
          autoFocus
          onClick={onDismiss}
          className={`mt-6 w-full rounded-2xl px-4 py-3 text-sm font-black transition duration-500 ease-out ${
            market ? "bg-amber-300 text-zinc-950 hover:bg-amber-200" : "border border-white/15 font-bold text-white hover:bg-white/10"
          }`}
        >
          {popup.button ?? "Keep moving"}
        </button>
      </div>
    </div>
  );
}

export function GameOverModal({
  rank, interference, routeName, next, onReset, lesson, won,
}: {
  rank: Rank;
  /** The run ended in a win (otherwise the rank decides). */
  won?: boolean;
  /** "Reality check" for this ending. */
  lesson?: string;
  interference: number;
  routeName: string;
  next?: { label: string; onClick: () => void }[];
  onReset: () => void;
}) {
  const text = `I ranked ${rank.title} ${RANK_EMOJI[rank.id] ?? ""} in ${routeName} · Japa. Village People Interference: ${Math.round(interference)}%.`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" role="dialog" aria-modal="true">
      <div className={`animate-scene-in relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/15 bg-gradient-to-br p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] ${RANK_VIBE[rank.id] ?? RANK_VIBE.hustle}`}>
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.28em] text-amber-200">{won ?? WIN_RANKS.has(rank.id) ? "You made it" : "Game Over"} · {routeName}</p>
        <div className="mt-5"><RankGlyph id={rank.id} /></div>
        <h3 className="mt-4 text-center text-3xl font-black tracking-tight text-white">{rank.title}</h3>
        <p className="mt-3 text-center text-sm leading-7 text-zinc-200">{rank.blurb}</p>
        {lesson ? (
          <div className="mt-4 rounded-2xl border border-sky-300/25 bg-black/25 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-200">Reality check</p>
            <p className="mt-1 text-sm leading-6 text-zinc-100">{lesson}</p>
          </div>
        ) : null}
        <p className="mt-4 text-center font-mono text-xs text-zinc-400">Village People Interference {Math.round(interference)}%</p>
        {next && next.length > 0 && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200/80">Next chapter</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              {next.map((n) => (
                <button key={n.label} type="button" onClick={n.onClick}
                  className="flex-1 rounded-xl bg-amber-300 px-3 py-2.5 text-sm font-black text-zinc-950 transition hover:bg-amber-200">
                  {n.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <ShareOnX text={text} className="flex-1" />
          <button type="button" onClick={onReset}
            className="flex-1 rounded-2xl border border-white/20 px-4 py-3 text-sm font-bold text-white transition duration-500 ease-out hover:bg-white/10">
            Run it back
          </button>
        </div>
      </div>
    </div>
  );
}

export function CadFloat({ amount, tick }: { amount: number; tick: number }) {
  if (!tick) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      <span key={tick} className="cad-float absolute left-1/2 top-1/2 rounded-full bg-rose-500/90 px-3 py-1 font-mono text-sm font-black text-white shadow-lg">
        -${amount.toLocaleString("en-CA")} CAD
      </span>
    </div>
  );
}
