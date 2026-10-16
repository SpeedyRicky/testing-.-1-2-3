"use client";

// The journey map: Nigeria, the Atlantic and Canada, with a plane path from your airport to where the active route
// ends up, and how far along it you are. Land shapes: Natural Earth (public domain).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plane, X } from "lucide-react";
import { DB } from "@/game/engine";
import type { GameState, RouteId } from "@/game/types";
import { pathD, type Pt } from "@/game/maps/geo";
import { journeyDestination, journeyProgress } from "@/game/maps/places";
import { placeFor, vacCityFor } from "@/game/nigeria";
import world from "@/game/maps/world.json";
import { usePlayer } from "../Player";

const W = world as unknown as { width: number; height: number; land: number[][]; nigeria: number[][]; canada: number[][]; places: Record<string, Pt> };
const NAMES: Record<string, string> = {
  pearson: "Toronto Pearson", halifax: "Halifax", stjohns: "St. John's", moncton: "Moncton", charlottetown: "Charlottetown",
  winnipeg: "Winnipeg", saskatoon: "Saskatoon", edmonton: "Edmonton", lagos: "Lagos", abuja: "Abuja",
};

/** A great-circle-looking arc: a quadratic curve bowed north. */
function arc(a: Pt, b: Pt): { d: string; at: (t: number) => Pt } {
  const c: Pt = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - Math.abs(a[0] - b[0]) * 0.28];
  const at = (t: number): Pt => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
  return { d: `M${a[0]} ${a[1]}Q${c[0]} ${c[1]} ${b[0]} ${b[1]}`, at };
}

export function JourneyButton({ run, runs }: { run?: GameState; runs: Partial<Record<RouteId, GameState>> }) {
  const [open, setOpen] = useState(false);
  if (!run) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:-translate-y-0.5 hover:border-amber-300/60 hover:text-white">
        <Plane className="h-3.5 w-3.5 text-sky-300" /> Journey
      </button>
      {open ? <JourneyMap run={run} runs={runs} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function JourneyMap({ run, runs, onClose }: { run: GameState; runs: Partial<Record<RouteId, GameState>>; onClose: () => void }) {
  const { profile } = usePlayer();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const home = vacCityFor(placeFor(profile?.stateCode ?? "LA")) === "Lagos" ? "lagos" : "abuja";
  const origin = W.places[home];
  const dest = journeyDestination(run);
  const path = arc(origin, W.places[dest] ?? W.places.pearson);
  const progress = journeyProgress(DB, run);
  const plane = path.at(progress);
  const ahead = path.at(Math.min(1, progress + 0.02));
  const angle = (Math.atan2(ahead[1] - plane[1], ahead[0] - plane[0]) * 180) / Math.PI;
  // The other routes you've started, faintly.
  const others = (Object.values(runs) as GameState[]).filter((r) => r.activeRoute !== run.activeRoute && r.history.length > 0);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="journey-title" onClick={onClose}>
      <div className="animate-scene-in my-8 w-full max-w-3xl rounded-[2rem] border border-white/15 bg-zinc-950 p-5 sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-300">Your journey</p>
            <h2 id="journey-title" className="mt-1 text-xl font-black text-white">
              {NAMES[home]} → {NAMES[dest]} · {DB.routes[run.activeRoute].short}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">{run.outcome?.result === "win" ? "You made it." : `${Math.round(progress * 100)}% of the way, by levels reached.`}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0b3a5c]">
          <svg viewBox={`0 0 ${W.width} ${W.height}`} className="block h-auto w-full" role="img" aria-label={`Map of the route from ${NAMES[home]} to ${NAMES[dest]}`}>
            {W.land.map((r, i) => <path key={i} d={pathD(r, true)} fill="#2d5a3d" stroke="#1f3f2b" strokeWidth={0.6} />)}
            {W.canada.map((r, i) => <path key={`c${i}`} d={pathD(r, true)} fill="#d94b4b" stroke="#8f2a2a" strokeWidth={0.8} />)}
            {W.nigeria.map((r, i) => <path key={`n${i}`} d={pathD(r, true)} fill="#18a058" stroke="#0c6b39" strokeWidth={0.8} />)}
            {others.map((r) => {
              const p = arc(origin, W.places[journeyDestination(r)] ?? W.places.pearson);
              return <path key={r.activeRoute} d={p.d} fill="none" stroke="#ffffff" strokeOpacity={0.18} strokeWidth={1.5} strokeDasharray="4 5" />;
            })}
            <path d={path.d} fill="none" stroke="#fde68a" strokeWidth={2.4} strokeDasharray="6 6" />
            {[origin, W.places[dest] ?? W.places.pearson].map((p, i) => (
              <g key={i}>
                <circle cx={p[0]} cy={p[1]} r={6} fill={i ? "#fca5a5" : "#86efac"} stroke="#fff" strokeWidth={1.5} />
                <text x={p[0] + (i ? -8 : 8)} y={p[1] + 18} fontSize={13} fontWeight={800} fill="#fff" textAnchor={i ? "end" : "start"}>{NAMES[i ? dest : home]}</text>
              </g>
            ))}
            <g transform={`translate(${plane[0]} ${plane[1]}) rotate(${angle})`} className="journey-plane">
              <path d="M-12 0 L10 0 M2 0 L-4 -8 M2 0 L-4 8 M-10 0 L-13 -4 M-10 0 L-13 4" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
            </g>
          </svg>
        </div>
        <p className="mt-3 text-[11px] text-zinc-500">Land shapes: Natural Earth (public domain). City maps: © OpenStreetMap contributors (ODbL).</p>
      </div>
    </div>,
    document.body,
  );
}
