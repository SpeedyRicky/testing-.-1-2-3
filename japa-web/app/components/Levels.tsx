"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Check, Lock, Map as MapIcon, Play, Star, X } from "lucide-react";
import { DB, evaluate } from "@/game/engine";
import { levelProgress, levelsFor, starRules } from "@/game/levels";
import type { AppEvent } from "@/game/machine";
import type { GameState, RouteId } from "@/game/types";
import { useCinematic } from "./Cinematic";
import { usePlayer } from "./Player";
import { awardStars } from "./Meta";
import { useSfxOnMount } from "./Sound";

// --- progress store: best stars and a replay snapshot per level, per player and route ----------

interface RouteProgress { best: number[]; snapshots: Record<number, GameState> }
interface Banner { id: number; route: RouteId; index: number; completed: { index: number; stars: number } | null }
interface Snapshot { progress: Record<string, RouteProgress>; banner: Banner | null }

const KEY = "japa.levels.v1";
const EMPTY: Snapshot = { progress: {}, banner: null };
let cache: Snapshot | null = null;
let bannerSeq = 0;
const listeners = new Set<() => void>();

function read(): Snapshot {
  if (cache) return cache;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    cache = { progress: raw && typeof raw === "object" ? raw : {}, banner: null };
  } catch {
    cache = { progress: {}, banner: null };
  }
  return cache;
}

function write(next: Snapshot) {
  cache = next;
  try { window.localStorage.setItem(KEY, JSON.stringify(next.progress)); } catch { /* storage full or blocked */ }
  listeners.forEach((l) => l());
}

const store = {
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  get: read,
  server: () => EMPTY,
};

const progressKey = (player: string, route: RouteId) => `${player}|${route}`;

function update(player: string, route: RouteId, change: (p: RouteProgress) => RouteProgress, banner?: Banner | null) {
  const cur = read();
  const key = progressKey(player, route);
  const p = cur.progress[key] ?? { best: [], snapshots: {} };
  write({ progress: { ...cur.progress, [key]: change(p) }, banner: banner === undefined ? cur.banner : banner });
}

/** This player's best stars for each level of a route. */
export function useBestStars(route: RouteId): number[] {
  const { profile } = usePlayer();
  const { progress } = useSyncExternalStore(store.subscribe, store.get, store.server);
  const p = progress[progressKey(profile?.username ?? "guest", route)];
  return levelsFor(DB, route).map((_, i) => p?.best[i] ?? 0);
}

/** Levels where this player has all three stars, across routes. */
export function threeStarCount(player: string): number {
  return Object.entries(read().progress)
    .filter(([k]) => k.startsWith(`${player}|`))
    .reduce((n, [, p]) => n + p.best.filter((b) => b >= 3).length, 0);
}

const dismissBanner = () => { const cur = read(); if (cur.banner) write({ ...cur, banner: null }); };

/** Watches the run: saves a snapshot when a level starts, records stars when one ends, raises the banner. */
export function useLevelTracking(run: GameState | undefined) {
  const { profile } = usePlayer();
  const player = profile?.username ?? "guest";
  const prev = useRef<GameState | undefined>(undefined);
  useEffect(() => {
    if (!run) return;
    const before = prev.current;
    prev.current = run;
    if (!levelsFor(DB, run.activeRoute).length) return;
    const switched = !before || before.activeRoute !== run.activeRoute;
    const restarted = !switched && run.history.length < before.history.length;
    const { to, entered, completed } = levelProgress(DB, switched || restarted ? undefined : before, run);
    if (switched || restarted) {
      // A fresh run, a replay or a tab switch: keep a snapshot of this level; announce it only on a real start.
      if (to < 0 || run.outcome) return;
      const announce = restarted || run.history.length <= 1;
      update(player, run.activeRoute, (p) => ({ ...p, snapshots: { ...p.snapshots, [to]: p.snapshots[to] ?? run } }),
        announce ? { id: ++bannerSeq, route: run.activeRoute, index: to, completed: null } : undefined);
      return;
    }
    if (entered === null && !completed) return;
    if (completed) {
      const prevBest = read().progress[progressKey(player, run.activeRoute)]?.best[completed.index] ?? 0;
      const level = levelsFor(DB, run.activeRoute)[completed.index];
      awardStars(player, `${run.activeRoute}:${level.id}:${completed.stars}`, completed.stars - prevBest, level.title);
    }
    update(player, run.activeRoute, (p) => {
      const best = [...p.best];
      if (completed) best[completed.index] = Math.max(best[completed.index] ?? 0, completed.stars);
      const snapshots = entered !== null ? { ...p.snapshots, [entered]: run } : p.snapshots;
      return { best, snapshots };
    }, entered !== null || completed ? { id: ++bannerSeq, route: run.activeRoute, index: entered ?? -1, completed } : undefined);
  }, [run, player]);
}

function Stars({ n, size = "h-3.5 w-3.5" }: { n: number; size?: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => <Star key={i} className={`${size} ${i < n ? "fill-amber-300 text-amber-300" : "text-zinc-600"}`} />)}
    </span>
  );
}

/** "Level 2 of 5 · The Paper Chase", after the cutscene, with the stars from the level just finished. */
export function LevelBanner() {
  const { banner } = useSyncExternalStore(store.subscribe, store.get, store.server);
  const { playing } = useCinematic();
  if (!banner || playing) return null;
  return <BannerCard key={banner.id} banner={banner} />;
}

function BannerCard({ banner }: { banner: Banner }) {
  const { t } = usePlayer();
  const levels = levelsFor(DB, banner.route);
  const level = banner.index >= 0 ? levels[banner.index] : null;
  const done = banner.completed ? levels[banner.completed.index] : null;
  useSfxOnMount(level ? "levelUp" : null);
  useEffect(() => {
    const id = window.setTimeout(dismissBanner, 4600);
    return () => window.clearTimeout(id);
  }, []);
  if (!level && !done) return null;
  return (
    <div className="level-banner pointer-events-none fixed inset-x-0 top-24 z-40 flex justify-center px-4" role="status">
      <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-amber-300/50 bg-zinc-950/95 p-5 text-center">
        {done ? (
          <p className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-200">
            <Check className="h-3.5 w-3.5" /> {t(done.title)} complete <Stars n={banner.completed!.stars} />
          </p>
        ) : null}
        {level ? (
          <>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.3em] text-amber-300">Level {banner.index + 1} of {levels.length}</p>
            <p className="mt-1 text-2xl font-black tracking-tight text-white">{t(level.title)}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{t(level.goal)}</p>
          </>
        ) : null}
        <button type="button" onClick={dismissBanner} className="mt-3 text-xs font-semibold text-zinc-400 hover:text-white">Got it</button>
      </div>
    </div>
  );
}

/** The route's levels as a row of chips, plus a map to replay any level reached. */
export function LevelStrip({ run, dispatch }: { run: GameState; dispatch: React.Dispatch<AppEvent> }) {
  const { profile, t } = usePlayer();
  const { progress } = useSyncExternalStore(store.subscribe, store.get, store.server);
  const [open, setOpen] = useState(false);
  const levels = levelsFor(DB, run.activeRoute);
  if (!levels.length) return null;
  const p = progress[progressKey(profile?.username ?? "guest", run.activeRoute)] ?? { best: [], snapshots: {} };
  const current = levelProgress(DB, undefined, run).to;
  return (
    <>
      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1" aria-label="Levels">
        {levels.map((l, i) => {
          const here = i === current;
          const reached = !!p.snapshots[i] || i <= current;
          return (
            <span key={l.id} className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${
              here ? "border-amber-300 bg-amber-300/15 text-amber-100" : reached ? "border-white/15 bg-white/5 text-zinc-300" : "border-white/5 text-zinc-600"}`}>
              {reached ? null : <Lock className="h-3 w-3" />}
              L{i + 1} {t(l.title)}
              {p.best[i] ? <Stars n={p.best[i]} size="h-3 w-3" /> : null}
            </span>
          );
        })}
        <button type="button" onClick={() => setOpen(true)}
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-zinc-200 hover:border-amber-300/60 hover:text-white">
          <MapIcon className="h-3.5 w-3.5" /> Level map
        </button>
      </div>
      {open ? createPortal(
        // On <body>, so the map sits above the sticky header and the page's own stacking context.
        <LevelMap run={run} progress={p} current={current} onClose={() => setOpen(false)}
          onPlay={(snap) => { setOpen(false); dispatch({ type: "LOAD_RUN", run: snap }); }} />,
        document.body,
      ) : null}
    </>
  );
}

function LevelMap({ run, progress, current, onClose, onPlay }: {
  run: GameState; progress: RouteProgress; current: number; onClose: () => void; onPlay: (s: GameState) => void;
}) {
  const { t } = usePlayer();
  const levels = levelsFor(DB, run.activeRoute);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="map-title" onClick={onClose}>
      <div className="animate-scene-in my-8 w-full max-w-2xl rounded-[2rem] border border-white/15 bg-zinc-950 p-5 sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="map-title" className="text-2xl font-black text-white">{DB.routes[run.activeRoute].title}: levels</h2>
            <p className="mt-1 text-sm text-zinc-400">Finish a level for one star; meet its two targets for the other two. Replay any level you have reached.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <ol className="mt-5 space-y-3">
          {levels.map((l, i) => {
            const snap = progress.snapshots[i];
            const best = progress.best[i] ?? 0;
            return (
              <li key={l.id} className={`rounded-2xl border p-4 ${i === current ? "border-amber-300/50 bg-amber-300/5" : "border-white/10 bg-white/[0.02]"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-200/80">Level {i + 1}</p>
                    <p className="text-lg font-black text-white">{t(l.title)}</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">{t(l.goal)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Stars n={best} />
                    {snap ? (
                      <button type="button" onClick={() => onPlay(snap)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-300 px-3 py-1.5 text-xs font-black text-zinc-950 hover:bg-amber-200">
                        <Play className="h-3.5 w-3.5" /> {i === current ? "Restart level" : "Play"}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-500"><Lock className="h-3.5 w-3.5" /> Reach it first</span>
                    )}
                  </div>
                </div>
                <ul className="mt-3 grid gap-1 text-xs text-zinc-400 sm:grid-cols-2">
                  <li className="flex items-center gap-1.5"><Star className="h-3 w-3 text-amber-300" /> Finish the level</li>
                  {starRules(l).map((s) => (
                    <li key={s.label} className="flex items-center gap-1.5">
                      <Star className="h-3 w-3 text-amber-300" /> {s.label}
                      {i === current && evaluate(run, s.when) ? <Check className="h-3 w-3 text-emerald-300" aria-label="met now" /> : null}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
