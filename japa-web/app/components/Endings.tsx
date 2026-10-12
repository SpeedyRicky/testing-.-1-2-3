"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { BookOpen, Lock, Trophy, X } from "lucide-react";
import { DB } from "@/game/engine";
import { allEndings, lessonFor } from "@/game/endings";
import type { GameState, RouteId } from "@/game/types";
import { usePlayer } from "./Player";

// --- The endings a player has found, remembered on this device ---------------------------

const KEY = "japa.endings.v1";
interface Snapshot { found: readonly string[]; lastNew: string | null }
const EMPTY: Snapshot = { found: [], lastNew: null };
let cache: Snapshot | null = null;
const listeners = new Set<() => void>();

function read(): Snapshot {
  if (cache) return cache;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    cache = { found: Array.isArray(raw) ? raw.filter((k) => typeof k === "string") : [], lastNew: null };
  } catch {
    cache = { found: [], lastNew: null };
  }
  return cache;
}

const store = {
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  get: read,
  server: () => EMPTY,
  add(key: string): boolean {
    const cur = read();
    if (cur.found.includes(key)) return false;
    cache = { found: [...cur.found, key], lastNew: key };
    try { window.localStorage.setItem(KEY, JSON.stringify(cache.found)); } catch { /* storage blocked: this visit only */ }
    listeners.forEach((l) => l());
    return true;
  },
};

/** How many endings this device has found. */
export const foundCount = () => read().found.length;

/** Records an ending; true the first time this player's device sees it. */
export const recordEnding = (key: string) => store.add(key);

const useFound = () => useSyncExternalStore(store.subscribe, store.get, store.server);

const ROUTE_ORDER = Object.keys(DB.routes) as RouteId[];

/** Header chip: "Endings 7/43", opens the cabinet. Pops a badge when a new ending is found. */
export function EndingsButton() {
  const { found } = useFound();
  const endings = useMemo(() => allEndings(DB), []);
  const [open, setOpen] = useState(false);
  const count = endings.filter((e) => found.includes(e.key)).length;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="relative inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:-translate-y-0.5 hover:border-amber-300/60 hover:text-white active:scale-95">
        <Trophy className="h-3.5 w-3.5 text-amber-300" /> Endings {count}/{endings.length}

      </button>
      {open ? <Cabinet found={found} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function Cabinet({ found, onClose }: { found: readonly string[]; onClose: () => void }) {
  const { t } = usePlayer();
  const endings = useMemo(() => allEndings(DB), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="cabinet-title" onClick={onClose}>
      <div className="animate-scene-in my-8 w-full max-w-3xl rounded-[2rem] border border-white/15 bg-zinc-950 p-5 sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="cabinet-title" className="text-2xl font-black text-white">Endings cabinet</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {endings.filter((e) => found.includes(e.key)).length} of {endings.length} found. Every ending teaches one real rule.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 space-y-6">
          {ROUTE_ORDER.filter((r) => endings.some((e) => e.route === r)).map((r) => {
            const list = endings.filter((e) => e.route === r);
            const got = list.filter((e) => found.includes(e.key)).length;
            return (
              <section key={r}>
                <h3 className="flex items-baseline justify-between text-xs font-bold uppercase tracking-[0.18em] text-amber-200/80">
                  <span>{DB.routes[r].short}</span><span className="font-mono text-zinc-500">{got}/{list.length}</span>
                </h3>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {list.map((e) => {
                    const has = found.includes(e.key);
                    return (
                      <li key={e.key} className={`rounded-xl border px-3 py-2.5 text-sm ${has
                        ? e.result === "win" ? "border-emerald-400/30 bg-emerald-400/5" : "border-rose-400/25 bg-rose-400/5"
                        : "border-white/10 bg-white/[0.02]"}`}>
                        {has ? (
                          <>
                            <p className="font-semibold text-white">{t(e.title)}</p>
                            {e.lesson ? <p className="mt-1 text-xs leading-5 text-zinc-400">{t(e.lesson)}</p> : null}
                          </>
                        ) : (
                          <p className="flex items-center gap-1.5 text-zinc-500"><Lock className="h-3.5 w-3.5" /> {e.result === "win" ? "A win, still hidden" : "Still hidden"}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** What the ending teaches about the real process. */
export function RealityCheck({ run, className = "" }: { run: GameState; className?: string }) {
  const { t } = usePlayer();
  const lesson = lessonFor(DB, run);
  if (!lesson) return null;
  return (
    <aside className={`rounded-2xl border border-sky-300/25 bg-sky-300/5 px-4 py-3 text-left ${className}`} aria-label="Reality check">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-200">
        <BookOpen className="h-3.5 w-3.5" /> Reality check
      </p>
      <p className="mt-1.5 text-sm leading-6 text-zinc-200">{t(lesson, run)}</p>
    </aside>
  );
}
