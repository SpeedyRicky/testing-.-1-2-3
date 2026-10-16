"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp, Coins, Dices, Gauge, Map as MapIcon, Trophy } from "lucide-react";

const KEY = "japa.tutorial.v1";

const CARDS = [
  {
    Icon: Gauge, title: "Every choice moves your meters",
    body: "Cash, Energy, Papers and Village People Interference. Run out of energy or money, or let Interference hit 100%, and the run ends. The higher Interference gets, the more often Village People strike.",
  },
  {
    Icon: Dices, title: "Risky choices show their odds",
    body: "A 🎲 chip shows the chance a move works. Preparation raises it: study before IELTS, gather evidence before a hearing. Green is likely, red is a long shot. Shortcuts that break the rules always fail.",
  },
  {
    Icon: MapIcon, title: "Levels, stars and endings",
    body: "Each route has levels with a goal and three stars. Replay any level from the Level map. Every ending teaches one real rule (the Reality check) and goes into your Endings cabinet: can you find all of them?",
  },
  {
    Icon: Coins, title: "Japa Points, perks and the daily challenge",
    body: "Finishing runs, winning, new endings and stars earn JP. Spend them in the Oja market on perks that change your next runs. Play the daily challenge every day to grow your streak.",
  },
];

/** Shown once after sign-up; the ? button in the header opens it again. */
export function Tutorial({ forceOpen, onClose }: { forceOpen: boolean; onClose: () => void }) {
  const [auto, setAuto] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => {
      try { if (!window.localStorage.getItem(KEY)) setAuto(true); } catch { /* storage blocked: skip the tour */ }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  const open = forceOpen || auto;
  if (!open) return null;
  const close = () => {
    try { window.localStorage.setItem(KEY, "seen"); } catch { /* ignore */ }
    setAuto(false);
    setStep(0);
    onClose();
  };
  const card = CARDS[step];
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="animate-scene-in w-full max-w-md rounded-[2rem] border border-amber-300/40 bg-zinc-950 p-6 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300">How to play · {step + 1} of {CARDS.length}</p>
        <card.Icon className="mx-auto mt-4 h-10 w-10 text-amber-200" aria-hidden />
        <h2 id="tour-title" className="mt-3 text-2xl font-black text-white">{card.title}</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-300">{card.body}</p>
        <div className="mt-5 flex justify-center gap-1.5" aria-hidden>
          {CARDS.map((c, i) => <span key={c.title} className={`h-1.5 w-6 rounded-full ${i === step ? "bg-amber-300" : "bg-white/15"}`} />)}
        </div>
        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" onClick={close} className="text-sm text-zinc-400 hover:text-white">Skip</button>
          {step < CARDS.length - 1 ? (
            <button type="button" onClick={() => setStep(step + 1)} className="rounded-xl bg-amber-300 px-5 py-2.5 text-sm font-black text-zinc-950 hover:bg-amber-200">Next</button>
          ) : (
            <button type="button" onClick={close} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-300 px-5 py-2.5 text-sm font-black text-zinc-950 hover:bg-amber-200">
              <Trophy className="h-4 w-4" /> Let&apos;s japa
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="How to play"
      className="inline-flex shrink-0 items-center rounded-full border border-white/15 bg-white/5 p-1.5 text-zinc-300 hover:border-amber-300/60 hover:text-white">
      <CircleHelp className="h-4 w-4" />
    </button>
  );
}
