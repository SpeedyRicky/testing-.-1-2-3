"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Flame, Ghost, GraduationCap, Plane, Share2, ShieldAlert, Sparkles, TriangleAlert } from "lucide-react";
import type { Popup, Rank } from "@/game/types";
import { useSfxOnMount } from "./Sound";
import { track } from "../launch/analytics";
import { SITE_URL, shareUrl } from "../launch/site";

/** Gradient backdrop per rank id; unknown ids fall back to the corridor look. */
const RANK_VIBE: Record<string, string> = {
  vanier: "bg-[#1a1408]",
  pearson: "bg-[#140b0b]",
  village: "bg-[#0b140f]",
  flagged: "bg-[#160a0c]",
  pr: "bg-[#140b0b]",
  pgwp: "bg-[#1a1408]",
  hustle: "bg-zinc-950",
  protected: "bg-[#0b140f]",
  interview: "bg-[#0b1220]",
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

const EFFECT_NAMES: Record<string, string> = {
  walletCad: "CAD", walletNgn: "₦", energy: "Energy", desperation: "Village People", familyStrain: "Family strain",
  timeRemainingDays: "Days", careerScore: "Career", community: "Community", academicStanding: "Grades",
};
/** "₦-850,000 · Village People +15" for a crisis option. */
function effectLine(e: Record<string, number | undefined>): string {
  return Object.entries(e).filter(([, v]) => typeof v === "number" && v !== 0).map(([k, v]) => {
    const n = v as number;
    const sign = n > 0 ? "+" : "−";
    const abs = Math.abs(n).toLocaleString("en-NG");
    if (k === "walletNgn") return `₦${sign}${abs}`;
    if (k === "walletCad") return `${sign}CAD ${abs}`;
    return `${EFFECT_NAMES[k] ?? k} ${sign}${abs}`;
  }).join(" · ");
}

/** Opens a pre-filled post on X. Works on every route's ending. */
export function ShareOnX({ text, className = "" }: { text: string; className?: string }) {
  return (
    <a
      href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(`${SITE_URL}/?utm_source=x&utm_medium=share`)}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        // The live page's own address wins over the configured one (e.g. a preview deploy).
        e.currentTarget.href = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl("x"))}`;
        track("share", { channel: "x" });
      }}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition duration-500 ease-out hover:bg-amber-200 ${className}`}
    >
      <Share2 className="h-4 w-4" />
      Post on X
    </a>
  );
}

/** Copies the result text; if the browser refuses, shows it so the player can copy it by hand. */
function CopyResult({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  return (
    <>
      <button type="button"
        onClick={() => {
          track("share", { channel: "copy" });
          const full = `${text}\n${shareUrl("copy")}`;
          return navigator.clipboard?.writeText(full).then(() => setState("copied"), () => setState("manual")) ?? setState("manual");
        }}
        className="flex-1 rounded-2xl border border-white/20 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10">
        {state === "copied" ? "Copied!" : "Copy result"}
      </button>
      {state === "manual" ? (
        <textarea readOnly value={`${text}\n${shareUrl("copy")}`} aria-label="Your result" rows={5} onFocus={(e) => e.currentTarget.select()}
          className="mt-2 w-full basis-full rounded-xl border border-white/15 bg-black/40 p-2 font-mono text-xs text-zinc-200" />
      ) : null}
    </>
  );
}

/** Full-screen layer on <body> (above the sticky header), scrollable when the card is taller than the screen. */
function Overlay({ className, children }: { className: string; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setMounted(true), 0); return () => window.clearTimeout(t); }, []);
  if (!mounted) return null;
  return createPortal(
    <div className={`fixed inset-0 z-50 overflow-y-auto p-4 ${className}`} role="dialog" aria-modal="true">
      <div className="flex min-h-full items-center justify-center py-6">{children}</div>
    </div>,
    document.body,
  );
}

/** Village People trap or parallel-market shock. */
export function PopupModal({ popup, onDismiss, onChoose }: { popup: Popup; onDismiss: () => void; onChoose?: (i: number) => void }) {
  const market = popup.kind === "market";
  const blessing = popup.kind === "blessing";
  useSfxOnMount(market ? "cashOut" : blessing ? "good" : "trap");
  return (
    <Overlay className="bg-black/70 backdrop-blur-sm">
      <div
        className={`animate-scene-in relative w-full max-w-md rounded-3xl border p-6 ${
          market
            ? "border-amber-300/40 bg-zinc-950"
            : blessing
              ? "border-emerald-300/50 bg-[#07140f]"
              : "border-rose-400/40 bg-[#160a0c]"
        }`}
      >
        <p className={`inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] ${market ? "text-amber-300" : blessing ? "text-emerald-300" : "text-rose-300"}`}>
          {blessing ? <Sparkles className="h-3.5 w-3.5" /> : !market && <TriangleAlert className="h-3.5 w-3.5" />}
          {popup.kicker}
        </p>
        <h3 className="mt-2 text-2xl font-black text-white">{popup.title}</h3>
        <p className="mt-3 text-sm leading-7 text-zinc-300">{popup.body}</p>
        {popup.options?.length && onChoose ? (
          <div className="mt-5 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-200/80">Village People attack! Choose:</p>
            {popup.options.map((o, i) => (
              <button key={i} type="button" autoFocus={i === 0} onClick={() => onChoose(i)}
                className="block w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-left text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-amber-300/60">
                <span className="mr-2 font-mono text-xs text-amber-300">{i + 1}</span>{o.label}
                <span className="mt-1 block font-mono text-[11px] font-normal text-zinc-400">{effectLine(o.effects)}</span>
              </button>
            ))}
          </div>
        ) : (
        <button
          type="button"
          autoFocus
          onClick={onDismiss}
          className={`mt-6 w-full rounded-2xl px-4 py-3 text-sm font-black transition duration-500 ease-out ${
            market ? "bg-amber-300 text-zinc-950 hover:bg-amber-200" : blessing ? "bg-emerald-300 text-zinc-950 hover:bg-emerald-200" : "border border-white/15 font-bold text-white hover:bg-white/10"
          }`}
        >
          {popup.button ?? "Keep moving"}
        </button>
        )}
      </div>
    </Overlay>
  );
}

export function GameOverModal({
  rank, interference, routeName, next, onReset, lesson, won, stars, moves,
}: {
  rank: Rank;
  /** Best stars per level on this route, for the share text. */
  stars?: number[];
  moves?: number;
  /** The run ended in a win (otherwise the rank decides). */
  won?: boolean;
  /** "Reality check" for this ending. */
  lesson?: string;
  interference: number;
  routeName: string;
  next?: { label: string; onClick: () => void }[];
  onReset: () => void;
}) {
  const starRow = (stars ?? []).map((n, i) => `L${i + 1} ${"⭐".repeat(n)}${"☆".repeat(Math.max(0, 3 - n))}`).join(" · ");
  const text = [
    `Japa 🇳🇬→🇨🇦 · ${routeName}`,
    `${rank.title} ${RANK_EMOJI[rank.id] ?? ""}`.trim(),
    starRow,
    `Village People Interference ${Math.round(interference)}%${moves ? ` · ${moves} moves` : ""}`,
    "Can you japa better? #JapaTheGame",
  ].filter(Boolean).join("\n");
  return (
    <Overlay className="bg-black/75 backdrop-blur-md">
      <div className={`animate-scene-in relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/15 p-7 ${RANK_VIBE[rank.id] ?? RANK_VIBE.hustle}`}>
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
          <CopyResult text={text} />
          <button type="button" onClick={onReset}
            className="flex-1 rounded-2xl border border-white/20 px-4 py-3 text-sm font-bold text-white transition duration-500 ease-out hover:bg-white/10">
            Run it back
          </button>
        </div>
      </div>
    </Overlay>
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
