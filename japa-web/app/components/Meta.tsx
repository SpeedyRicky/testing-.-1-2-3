"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Check, Coins, Flame, ShoppingBag, Sparkles, Trophy, X } from "lucide-react";
import { DB } from "@/game/engine";
import { endingKey } from "@/game/endings";
import type { AppEvent, Bundle } from "@/game/machine";
import {
  FLAIRS, MAX_EQUIPPED, NEW_META, PERKS, TITLES, buy, bundleFor, dailyFor, dayKey, grant, nextTitle, runAward, titleFor,
  toggleEquip, touchStreak, type Award, type MetaState,
} from "@/game/meta";
import type { GameState, RouteId } from "@/game/types";
import { useCinematic } from "./Cinematic";
import { recordEnding } from "./Endings";
import { usePlayer } from "./Player";
import { useSfxOnMount } from "./Sound";

// --- store: one MetaState per player, plus the last award to show ---------------------------------

const KEY = "japa.meta.v1";
interface Snapshot { byPlayer: Record<string, MetaState>; lastAward: (Award & { id: number }) | null }
const EMPTY: Snapshot = { byPlayer: {}, lastAward: null };
let cache: Snapshot | null = null;
let awardSeq = 0;
const listeners = new Set<() => void>();

function read(): Snapshot {
  if (cache) return cache;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    cache = { byPlayer: raw && typeof raw === "object" ? raw : {}, lastAward: null };
  } catch {
    cache = { byPlayer: {}, lastAward: null };
  }
  return cache;
}
function write(next: Snapshot) {
  cache = next;
  try { window.localStorage.setItem(KEY, JSON.stringify(next.byPlayer)); } catch { /* storage full or blocked */ }
  listeners.forEach((l) => l());
}
const store = { subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }, get: read, server: () => EMPTY };

const metaOf = (player: string) => ({ ...NEW_META, ...read().byPlayer[player] });
function updateMeta(player: string, fn: (m: MetaState) => MetaState, award?: Award) {
  const cur = read();
  const before = metaOf(player);
  const after = fn(before);
  if (after === before && !award) return;
  write({
    byPlayer: { ...cur.byPlayer, [player]: after },
    lastAward: award && after !== before ? { ...award, id: ++awardSeq } : cur.lastAward,
  });
}

/** Stars earned in a level pay 5 JP each, once. Called by the level tracker. */
export function awardStars(player: string, key: string, newStars: number, levelTitle: string) {
  if (newStars <= 0) return;
  const award: Award = { key: `stars|${key}`, total: newStars * 5, lines: [{ label: `${levelTitle}: ${newStars} new star${newStars > 1 ? "s" : ""}`, jp: newStars * 5 }] };
  updateMeta(player, (m) => grant(m, award), award);
}

export function useMeta() {
  const { profile } = usePlayer();
  const player = profile?.username ?? "guest";
  const snap = useSyncExternalStore(store.subscribe, store.get, store.server);
  const meta = useMemo(() => ({ ...NEW_META, ...snap.byPlayer[player] }), [snap, player]);
  return { player, meta, update: (fn: (m: MetaState) => MetaState) => updateMeta(player, fn) };
}

const PLAYABLE = (Object.keys(DB.routes) as RouteId[]).filter((r) => DB.routes[r].status === "playable" && DB.routes[r].levels?.length);
const today = () => dayKey(new Date());

/** Keeps the equipped perks in the game state, and pays out when a run ends (after its cutscene). */
export function useRunRewards(run: GameState | undefined, dispatch: React.Dispatch<AppEvent>) {
  const { player, meta } = useMeta();
  const { playing } = useCinematic();
  const equipped = meta.equipped.join(",");
  useEffect(() => {
    const ids = equipped ? equipped.split(",") : [];
    dispatch({ type: "SET_BUNDLE", bundle: ids.length ? bundleFor(ids) : null });
  }, [equipped, dispatch]);

  const ending = run ? endingKey(DB, run) : null;
  const paid = useRef<string | null>(null);
  useEffect(() => {
    if (!run || !ending || playing) return;
    const key = `${ending}|${run.history.length}|${run.mods?.daily ?? ""}|${run.walletCad}|${run.desperation}`;
    if (paid.current === key) return;
    paid.current = key;
    const isNew = recordEnding(ending);
    const day = today();
    const m0 = touchStreak(metaOf(player), day);
    const dailyDone = run.mods?.daily === day && m0.dailyDone === day;
    const award = runAward(dailyDone ? { ...run, mods: { ...run.mods, daily: undefined } } : run,
      { key, newEnding: isNew, today: day, streak: m0.streak.count });
    updateMeta(player, (m) => {
      const touched = touchStreak(m, day);
      const paidOut = grant(touched, award);
      if (paidOut === touched) return touched;
      return { ...paidOut, runs: paidOut.runs + 1, dailyDone: run.mods?.daily === day ? day : paidOut.dailyDone };
    }, award);
  }, [run, ending, playing, player]);
}

// --- UI -------------------------------------------------------------------------------------------

/** "+65 JP" card after a run: what you earned and why. */
export function AwardToast() {
  const { lastAward } = useSyncExternalStore(store.subscribe, store.get, store.server);
  const { playing } = useCinematic();
  const [hidden, setHidden] = useState<number | null>(null);
  if (!lastAward || playing || hidden === lastAward.id) return null;
  return <AwardCard key={lastAward.id} award={lastAward} onClose={() => setHidden(lastAward.id)} />;
}

function AwardCard({ award, onClose }: { award: Award; onClose: () => void }) {
  useSfxOnMount("coin");
  useEffect(() => {
    const t = window.setTimeout(onClose, 5200);
    return () => window.clearTimeout(t);
  }, [onClose]);
  return (
    <div className="award-toast fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4" role="status">
      <div className="w-full max-w-sm rounded-2xl border border-amber-300/50 bg-zinc-950/95 p-4 shadow-[0_20px_60px_-20px_rgba(251,191,36,0.7)]">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-lg font-black text-amber-200"><Coins className="h-5 w-5" /> +{award.total} JP</p>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <ul className="mt-2 space-y-1 text-xs text-zinc-300">
          {award.lines.map((l) => (
            <li key={l.label} className="flex justify-between gap-3"><span>{l.label}</span><span className="font-mono text-amber-100">+{l.jp}</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Header chip: JP, title, streak. Opens the Japa Hub. */
export function MetaChip({ dispatch, run }: { dispatch: React.Dispatch<AppEvent>; run?: GameState }) {
  const { meta } = useMeta();
  const [open, setOpen] = useState(false);
  const flair = FLAIRS.find((f) => f.id === meta.flair)?.emoji ?? "";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:-translate-y-0.5 hover:border-amber-300 active:scale-95"
        aria-label={`Japa Hub: ${meta.jp} JP, ${titleFor(meta.lifetime)}, ${meta.streak.count}-day streak`}>
        <span aria-hidden>{flair}</span>
        <Coins className="h-3.5 w-3.5" /> {meta.jp} JP
        <span className="text-amber-200/70">· {titleFor(meta.lifetime)}</span>
        {meta.streak.count ? <span className="inline-flex items-center gap-0.5 text-orange-300"><Flame className="h-3.5 w-3.5" />{meta.streak.count}</span> : null}
      </button>
      {open ? createPortal(<Hub dispatch={dispatch} run={run} onClose={() => setOpen(false)} />, document.body) : null}
    </>
  );
}

type Tab = "daily" | "oja" | "stats";

function Hub({ dispatch, run, onClose }: { dispatch: React.Dispatch<AppEvent>; run?: GameState; onClose: () => void }) {
  const { meta, update } = useMeta();
  const [tab, setTab] = useState<Tab>("daily");
  const day = today();
  const daily = dailyFor(day, PLAYABLE);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const next = nextTitle(meta.lifetime);
  const playDaily = () => {
    const bundle: Bundle = bundleFor(meta.equipped, { day, modifier: daily.modifier });
    dispatch({ type: "START_DAILY", route: daily.route, bundle });
    onClose();
    window.scrollTo({ top: 0 });
  };
  const inDaily = run?.mods?.daily === day && run.activeRoute === daily.route && !run.outcome;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="hub-title" onClick={onClose}>
      <div className="animate-scene-in my-8 w-full max-w-2xl rounded-[2rem] border border-white/15 bg-zinc-950 p-5 sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="hub-title" className="text-2xl font-black text-white">Japa Hub</h2>
            <p className="mt-1 text-sm text-zinc-400">
              <b className="text-amber-200">{meta.jp} JP</b> to spend · {titleFor(meta.lifetime)}
              {next ? <> · {next.min - meta.lifetime} JP to <i>{next.title}</i></> : null}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div role="tablist" aria-label="Hub" className="mt-4 flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {([["daily", "Daily challenge", CalendarDays], ["oja", "Oja market", ShoppingBag], ["stats", "Your record", Trophy]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold ${tab === id ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200"}`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {tab === "daily" && (
          <section className="mt-5 space-y-4">
            <div className="rounded-2xl border border-amber-300/30 bg-amber-300/5 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200">Today · {day}</p>
              <p className="mt-1 text-xl font-black text-white">{DB.routes[daily.route].title}</p>
              <p className="mt-1 text-sm text-zinc-300"><b className="text-amber-100">{daily.modifier.name}:</b> {daily.modifier.blurb}</p>
              <p className="mt-2 text-xs text-zinc-400">Win for 60 JP, or 20 JP for trying, multiplied by your streak (up to ×2). Same challenge for every player today.</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {meta.dailyDone === day ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300"><Check className="h-4 w-4" /> Done today. New challenge tomorrow.</span>
                ) : inDaily ? (
                  <span className="text-sm font-semibold text-amber-200">You&apos;re playing it now.</span>
                ) : (
                  <button type="button" onClick={playDaily} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-300 px-4 py-2 text-sm font-black text-zinc-950 hover:bg-amber-200">
                    <Sparkles className="h-4 w-4" /> Play today&apos;s challenge
                  </button>
                )}
                <span className="inline-flex items-center gap-1 text-sm text-orange-300"><Flame className="h-4 w-4" /> {meta.streak.count}-day streak</span>
              </div>
            </div>
            <p className="text-xs leading-5 text-zinc-500">Finish any run on consecutive days to grow your streak. Miss a day and it starts again.</p>
          </section>
        )}

        {tab === "oja" && (
          <section className="mt-5 space-y-5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200/80">Perks · equip up to {MAX_EQUIPPED} (from your next run)</h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {PERKS.map((p) => {
                  const owned = meta.owned.includes(p.id);
                  const on = meta.equipped.includes(p.id);
                  return (
                    <li key={p.id} className={`rounded-xl border p-3 ${on ? "border-emerald-400/40 bg-emerald-400/5" : "border-white/10 bg-white/[0.02]"}`}>
                      <p className="font-semibold text-white">{p.name}</p>
                      <p className="mt-0.5 text-xs text-zinc-400">{p.blurb}</p>
                      <div className="mt-2">
                        {owned ? (
                          <button type="button" onClick={() => update((m) => toggleEquip(m, p.id))}
                            disabled={!on && meta.equipped.length >= MAX_EQUIPPED}
                            className={`rounded-lg px-3 py-1 text-xs font-bold ${on ? "bg-emerald-400 text-zinc-950" : "border border-white/20 text-zinc-200 disabled:opacity-40"}`}>
                            {on ? "Equipped" : "Equip"}
                          </button>
                        ) : (
                          <button type="button" onClick={() => update((m) => buy(m, p.id))} disabled={meta.jp < p.cost}
                            className="rounded-lg bg-amber-300 px-3 py-1 text-xs font-black text-zinc-950 disabled:opacity-40">
                            Buy · {p.cost} JP
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200/80">Name flair</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {FLAIRS.map((f) => {
                  const owned = meta.owned.includes(f.id) || f.cost === 0;
                  const on = meta.flair === f.id;
                  return (
                    <li key={f.id}>
                      <button type="button"
                        onClick={() => update((m) => owned ? { ...m, flair: f.id } : buy(m, f.id))}
                        disabled={!owned && meta.jp < f.cost}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${on ? "border-amber-300 bg-amber-300/15 text-amber-100" : "border-white/15 text-zinc-200"}`}
                        aria-label={`${f.name}${owned ? (on ? ", worn" : ", wear it") : `, buy for ${f.cost} JP`}`}>
                        <span aria-hidden>{f.emoji}</span> {owned ? f.name : `${f.cost} JP`}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        {tab === "stats" && (
          <section className="mt-5 space-y-4">
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[["Runs finished", meta.runs], ["Lifetime JP", meta.lifetime], ["Day streak", meta.streak.count], ["Perks owned", meta.owned.filter((o) => PERKS.some((p) => p.id === o)).length]].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <dt className="text-[11px] uppercase tracking-wider text-zinc-500">{k}</dt>
                  <dd className="mt-0.5 font-mono text-lg font-bold text-white">{v}</dd>
                </div>
              ))}
            </dl>
            <ol className="space-y-1.5 text-sm">
              {TITLES.map((t) => (
                <li key={t.title} className={`flex items-center justify-between rounded-lg px-3 py-1.5 ${meta.lifetime >= t.min ? "bg-amber-300/10 text-amber-100" : "text-zinc-500"}`}>
                  <span>{t.title}</span><span className="font-mono text-xs">{t.min} JP</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-zinc-500">JP: 10 for finishing a run, 30 for a win, 25 for a new ending, 5 per new level star, plus the daily challenge.</p>
          </section>
        )}
      </div>
    </div>
  );
}

/** Shows the daily modifier while a daily run is in progress. */
export function RunModsChip({ run }: { run: GameState }) {
  if (!run.mods?.label) return null;
  return (
    <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold text-amber-100">
      <CalendarDays className="h-3.5 w-3.5" /> Daily challenge · {run.mods.label}
    </p>
  );
}
