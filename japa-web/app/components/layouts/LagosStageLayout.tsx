"use client";

import { useEffect, useRef, useState } from "react";
import { FileCheck2, Ghost, GraduationCap, Hammer, HeartCrack, Languages, MapPin, Sparkles, Trophy, Wallet, Zap } from "lucide-react";
import { DB, choose, computeCrs, presentChoices, rankFor } from "@/game/engine";
import { lessonFor } from "@/game/endings";
import { OddsChip } from "../OddsChip";
import { useBestStars } from "../Levels";
import { describeChoice } from "@/game/cinematic";
import { useCinematic } from "../Cinematic";
import { useChoiceKeys } from "../useChoiceKeys";
import { usePlayer } from "../Player";
import { usePathways } from "../Pathways";
import { CityMap } from "../maps/CityMap";
import { radarMarks } from "@/game/meta";
import { RunnerGate } from "../runner/Gate";
import { chance, rolls as rollDice } from "@/game/rng";
import type { BarSpec, GameState, RouteId, Transit } from "@/game/types";
import type { LayoutProps } from "../LayoutContainer";
import { SceneStage } from "../Stage2D";
import { TravelRibbon } from "../TravelRibbon";
import { CadFloat, GameOverModal, PopupModal } from "../Popups";
import { NGN_PER_CAD, PRICE_SHOCKS, shortNaira } from "@/game/nigeria";

const HUD: Record<string, { icon: typeof Wallet; bar: string; tint: string; glow: string }> = {
  walletNgn: { icon: Wallet, bar: "from-emerald-400 to-lime-300", tint: "bg-emerald-500/20 text-emerald-300", glow: "shadow-emerald-500/20" },
  energy: { icon: Zap, bar: "from-amber-400 to-yellow-200", tint: "bg-amber-500/20 text-amber-300", glow: "shadow-amber-400/20" },
  papers: { icon: FileCheck2, bar: "from-sky-400 to-cyan-200", tint: "bg-sky-500/20 text-sky-300", glow: "shadow-sky-400/20" },
  desperation: { icon: Ghost, bar: "from-lime-400 to-rose-500", tint: "bg-lime-500/20 text-lime-200", glow: "shadow-lime-400/20" },
  walletCad: { icon: Wallet, bar: "from-red-500 to-rose-300", tint: "bg-red-500/20 text-red-200", glow: "shadow-red-500/20" },
  crsScore: { icon: Trophy, bar: "from-sky-400 to-indigo-300", tint: "bg-sky-500/20 text-sky-200", glow: "shadow-sky-400/20" },
  clbFirst: { icon: Languages, bar: "from-violet-400 to-fuchsia-300", tint: "bg-violet-500/20 text-violet-200", glow: "shadow-violet-400/20" },
  academicStanding: { icon: GraduationCap, bar: "from-amber-300 to-orange-400", tint: "bg-amber-500/20 text-amber-200", glow: "shadow-amber-400/20" },
  familyStrain: { icon: HeartCrack, bar: "from-rose-300 to-red-600", tint: "bg-rose-500/20 text-rose-200", glow: "shadow-rose-500/20" },
  tradeYears: { icon: Hammer, bar: "from-orange-400 to-amber-200", tint: "bg-orange-500/20 text-orange-200", glow: "shadow-orange-400/20" },
  clbTrade: { icon: Languages, bar: "from-violet-400 to-fuchsia-300", tint: "bg-violet-500/20 text-violet-200", glow: "shadow-violet-400/20" },
  aipFile: { icon: FileCheck2, bar: "from-teal-300 to-sky-300", tint: "bg-teal-500/20 text-teal-200", glow: "shadow-teal-400/20" },
  relationshipProof: { icon: HeartCrack, bar: "from-pink-300 to-rose-400", tint: "bg-pink-500/20 text-pink-200", glow: "shadow-pink-400/20" },
  clbAip: { icon: Languages, bar: "from-violet-400 to-fuchsia-300", tint: "bg-violet-500/20 text-violet-200", glow: "shadow-violet-400/20" },
  provinceTies: { icon: MapPin, bar: "from-sky-300 to-emerald-300", tint: "bg-sky-500/20 text-sky-200", glow: "shadow-sky-400/20" },
};

const naira = (v: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(v);
const cad = (v: number) => `CAD ${Math.round(v).toLocaleString("en-CA")}`;
const money = (spec: BarSpec, v: number) => (spec.format === "ngn" ? naira(v) : spec.format === "cad" ? cad(v) : null);
/** Short money for the HUD so big balances fit a 360px phone: ₦1.8M, CAD 3.5k. */
const compactMoney = (spec: BarSpec, v: number) => {
  if (spec.format === "ngn") return Math.abs(v) >= 1_000_000 ? shortNaira(v) : naira(v);
  if (spec.format === "cad") return Math.abs(v) >= 10_000 ? `CAD ${(v / 1000).toFixed(1)}k` : cad(v);
  return null;
};

function valueOf(run: GameState, key: BarSpec["key"]): number {
  return key in run.routeStats ? run.routeStats[key as keyof GameState["routeStats"]] ?? 0 : (run[key as keyof GameState] as number);
}

/** Rapid-fire countdown: the bar drains; at zero you "freeze" and the timeout answer is given for you. */
function ChoiceTimer({ seconds, paused, onTimeout }: { seconds: number; paused: boolean; onTimeout: () => void }) {
  const [left, setLeft] = useState(seconds * 10);
  const fired = useRef(false);
  const cb = useRef(onTimeout);
  useEffect(() => { cb.current = onTimeout; });
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      // Pause while the tab is hidden or any window (tutorial, Gist, Hub, help) covers the question.
      if (document.hidden || document.querySelector('[aria-modal="true"]')) return;
      setLeft((l) => Math.max(0, l - 1));
    }, 100);
    return () => window.clearInterval(id);
  }, [paused]);
  useEffect(() => {
    if (left === 0 && !fired.current) { fired.current = true; cb.current(); }
  }, [left]);
  const pct = (left / (seconds * 10)) * 100;
  const urgent = left <= 50;
  return (
    <div className="mt-5" role="timer" aria-label={`${Math.ceil(left / 10)} seconds to answer`}>
      <div className="flex justify-between text-[11px] font-bold uppercase tracking-[0.18em]">
        <span className={urgent ? "animate-pulse text-rose-300" : "text-amber-200"}>Rapid fire: answer now</span>
        <span className={`font-mono ${urgent ? "text-rose-300" : "text-zinc-400"}`}>{Math.ceil(left / 10)}s</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full transition-[width] duration-100 ease-linear ${urgent ? "bg-rose-500" : "bg-amber-300"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function HudMeter({ spec, value }: { spec: BarSpec; value: number }) {
  const prev = useRef(value);
  const [delta, setDelta] = useState({ n: 0, key: 0 });
  useEffect(() => {
    const d = value - prev.current;
    prev.current = value;
    if (d === 0) return;
    const show = window.setTimeout(() => setDelta((o) => ({ n: d, key: o.key + 1 })), 0);
    const hide = window.setTimeout(() => setDelta((o) => ({ ...o, n: 0 })), 1000);
    return () => { window.clearTimeout(show); window.clearTimeout(hide); };
  }, [value]);

  const theme = HUD[spec.key] ?? HUD.energy;
  const Icon = theme.icon;
  const pct = Math.max(0, Math.min(100, (value / (spec.max ?? 100)) * 100));
  const shown = compactMoney(spec, value) ?? `${Math.round(value)}${spec.suffix ?? ""}`;
  // For invert meters (interference), a rise is bad news.
  const good = (delta.n > 0) !== !!spec.invert;
  const flash = delta.n === 0 ? "" : good ? "hud-flash-up" : "hud-flash-down";

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur-md transition-transform duration-300 hover:-translate-y-1 ${theme.glow} ${flash}`}>
      <div className="flex items-center gap-3">
        <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${theme.tint}`}>
          {delta.n !== 0 && <span key={delta.key} className="absolute inset-0 animate-[pulse-ring_0.8s_ease-out] rounded-2xl border border-white/40" />}
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <dt className="text-[11px] uppercase leading-tight tracking-wider text-zinc-400">{spec.label}</dt>
          <dd className="truncate font-mono text-sm font-semibold text-white">{shown}</dd>
          {spec.format === "cad" ? <dd className="truncate font-mono text-[10px] text-zinc-500">≈ {shortNaira(value * NGN_PER_CAD)}</dd> : null}
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/40">
        <div className={`h-full rounded-full bg-gradient-to-r ${theme.bar} transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
      </div>
      {delta.n !== 0 && (
        <span key={delta.key} className={`animate-delta pointer-events-none absolute right-3 top-2 font-mono text-xs font-bold ${good ? "text-lime-300" : "text-rose-300"}`}>
          {delta.n > 0 ? "+" : ""}
          {money(spec, delta.n) ?? delta.n}
        </span>
      )}
    </div>
  );
}

/** The moment you land: your naira, converted, and what things cost in it. */
const FX_SCENES = new Set(["FY_LANDING", "ST_ARRIVAL", "SF_REMIT", "TT_WINTER"]);
function FxShock({ run }: { run: GameState }) {
  const [open, setOpen] = useState(true);
  if (!open || !FX_SCENES.has(run.currentSceneId)) return null;
  const naira = run.walletCad * NGN_PER_CAD;
  return (
    <aside className="animate-scene-in mb-4 rounded-2xl border border-sky-300/30 bg-[#0b1220] p-4" aria-label="Exchange rate shock">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200">Exchange rate shock · ₦{NGN_PER_CAD.toLocaleString("en-NG")} = CAD 1</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-zinc-400 hover:text-white">Close</button>
      </div>
      <p className="mt-2 text-sm text-zinc-200">
        Your <b className="font-mono">{shortNaira(naira)}</b> is now <b className="font-mono">CAD {Math.round(run.walletCad).toLocaleString("en-CA")}</b>.
      </p>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {PRICE_SHOCKS.map((p) => (
          <li key={p.item} className="flex justify-between gap-2 rounded-xl bg-black/30 px-3 py-1.5 text-xs">
            <span className="text-zinc-300">{p.item}</span>
            <span className="font-mono text-rose-300">CAD {p.cad} = {shortNaira(p.cad * NGN_PER_CAD)}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Confetti() {
  const bits = [["#fbbf24", "8%", "0ms"], ["#fb7185", "22%", "80ms"], ["#34d399", "38%", "40ms"],
    ["#38bdf8", "55%", "120ms"], ["#c084fc", "70%", "20ms"], ["#facc15", "84%", "90ms"]] as const;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-10 h-40 overflow-hidden">
      {bits.map(([color, left, delay], i) => (
        <span key={i} className="confetti-bit" style={{ left, background: color, animationDelay: delay, transform: `rotate(${i * 18}deg)` }} />
      ))}
    </div>
  );
}

/** The page backdrop: one plain, flat colour behind every screen. */
export function LagosBackdrop({ route = "NIGERIA_LIFE" }: { route?: string }) {
  return <div className="pointer-events-none fixed inset-0 z-0 bg-[#07060c]" data-route={route} aria-hidden />;
}

const TRAVEL_MS: Record<Transit, number> = {
  none: 0, call: 950, trek: 1250, danfo: 1250, okada: 1250, plane: 1250, streetcar: 1250, "snow-walk": 1250,
};

/** Express Entry: where the points come from, so players see what each choice changed. */
function CrsBreakdown({ run }: { run: GameState }) {
  if (!DB.crs || run.routeStats.ageYears === undefined) return null;
  const b = computeCrs(DB.crs, run.routeStats);
  const rows: [string, number][] = [
    ["Age", b.age], ["Education", b.education], ["English", b.language], ["French", b.secondLanguage],
    ["Canadian work", b.canadianWork], ["Transferability", b.transferability], ["Additional", b.additional],
  ];
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur-md">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200/80">CRS breakdown</p>
        <p className="font-mono text-lg font-black text-white">{b.total}</p>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2 border-b border-white/5 py-1 text-xs">
            <dt className="text-zinc-400">{k}</dt>
            <dd className="font-mono text-zinc-100">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] leading-5 text-zinc-500">
        Single applicant, same score in all four language abilities. Job offers add no points since March 2025.
      </p>
    </div>
  );
}

export function LagosStageLayout({ run, dispatch }: LayoutProps) {
  const cfg = DB.routes[run.activeRoute];
  // While travelling, keep drawing the scene we are leaving; the meters update at once.
  const [hold, setHold] = useState<string | null>(null);
  const [travel, setTravel] = useState<{ mode: Transit; destination: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const shownId = hold ?? run.currentSceneId;
  const scene = DB.scenes[shownId];
  const choices = hold ? [] : presentChoices(DB, run);
  const moving = hold !== null;
  const ended = !!run.outcome && !moving;
  const isWin = ended && run.outcome?.result === "win";

  // Parallel-market shocks arrive on a timer while the run is live.
  const shock = cfg.marketShock;
  const live = !run.outcome;
  useEffect(() => {
    if (!shock || !live) return;
    const id = window.setInterval(() => {
      if (chance(shock.chance)) dispatch({ type: "MARKET_SHOCK" });
    }, shock.intervalSeconds * 1000);
    return () => window.clearInterval(id);
  }, [shock, live, dispatch]);

  const { play, playing } = useCinematic();
  const bestStars = useBestStars(run.activeRoute);
  useChoiceKeys(choices, pick, !moving && !run.popup && !playing && !run.outcome);
  const { t } = usePlayer();
  const pathways = usePathways();
  const radar = radarMarks(DB, run);

  /** Choice -> cutscene -> travel ribbon -> next scene. The meters update at once underneath. */
  function pick(index: number) {
    if (moving || run.popup) return;
    const rolls = rollDice();
    const next = choose(DB, run, index, rolls); // same pure rules the reducer runs
    if (next === run) return;
    const choice = DB.scenes[run.currentSceneId]?.choices?.[index];
    // Describe the choice itself; a Village People trap gets its own pop-up afterwards.
    const clean = next.popup ? choose(DB, run, index, [1, 0, rolls[2], 1]) : next;
    const spec = describeChoice(DB, run, clean, t(choice?.text, run), clean.lastChoice?.label ?? choice?.label ?? "",
      t(clean.lastChoice?.feedback ?? choice?.feedback, run));
    dispatch({ type: "CHOOSE", index, rolls });
    const from = run.currentSceneId;
    setHold(from);
    const dest = DB.scenes[next.currentSceneId];
    const mode = dest?.transitIn ?? "none";
    play({ spec, stage: DB.scenes[from]?.stage ?? "room-night", location: t(DB.scenes[from]?.location, run) }, () => {
      if (mode === "none" || !dest) { setHold(null); return; }
      setTravel({ mode, destination: t(dest.location, next) });
      timer.current = window.setTimeout(() => { setHold(null); setTravel(null); }, TRAVEL_MS[mode]);
    });
  }

  const rank = ended ? rankFor(DB, run) : null;
  const nextRoutes = (cfg.nextRoutes ?? []).filter((r) => DB.routes[r]?.status === "playable" && (pathways?.[r].ok ?? true));
  // A scene that unlocks a route carries the player's profile into it; otherwise offer fresh starts.
  const unlock = ended && scene?.unlocksRoute && run.outcome?.result !== "fail" ? scene.unlocksRoute : undefined;
  const next = unlock
    ? [{ label: `Continue: ${DB.routes[unlock].short}`, onClick: () => dispatch({ type: "FOLLOW_UNLOCK" }) }]
    : isWin ? nextRoutes.map((r: RouteId) => ({ label: DB.routes[r].short, onClick: () => dispatch({ type: "SELECT_ROUTE", route: r }) }))
      : undefined;

  return (
    <div className="relative">
      {isWin && <Confetti />}
      <div className="mb-4 flex flex-col gap-4">
        <div>
          <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-300">
            <Sparkles className="h-3 w-3 animate-[bounce-soft_1.4s_ease-in-out_infinite]" />
            {cfg.short} · Japa
          </p>
          <p className="title-shimmer text-xl font-black tracking-tight sm:text-3xl">{t(cfg.tagline)}</p>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {cfg.bars.map((b) => <HudMeter key={b.key} spec={b} value={valueOf(run, b.key)} />)}
        </dl>
        <CrsBreakdown run={run} />
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative">
          {scene?.stage && <SceneStage stage={scene.stage} mood={ended ? (isWin ? "win" : "fail") : "calm"} />}
          <CadFloat amount={run.cadFloat.amount} tick={run.cadFloat.tick} />
          {travel && <TravelRibbon mode={travel.mode} destination={travel.destination} />}
        </div>

        <FxShock key={run.currentSceneId} run={run} />
        {!ended && !moving ? <RunnerGate run={run} dispatch={dispatch} /> : null}
        {!ended ? <CityMap run={run} choices={choices} onPick={pick} disabled={moving || !!run.popup} /> : null}
        <article
          key={shownId}
          className={`animate-scene-in relative overflow-hidden rounded-[2rem] border p-5 sm:p-7 ${
            isWin ? "border-amber-300/50 bg-[#1a1408]"
              : ended ? "border-rose-400/40 bg-[#1a0b0e]"
                : "border-white/10 bg-zinc-950/55 backdrop-blur-xl"}`}
        >
          <p className="animate-stamp mb-3 inline-flex items-center gap-2 rounded-full border border-dashed border-amber-300/50 px-3 py-1 text-xs uppercase tracking-[0.18em] text-amber-200">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {t(scene?.location, run)}
          </p>
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{t(scene?.title, run)}</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">{t(scene?.dialogue, run)}</p>

          {run.lastChoice?.feedback && !moving && (
            <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/5 px-4 py-2.5 text-sm text-amber-100/90">
              {t(run.lastChoice.feedback, run)}
            </p>
          )}

          {scene?.timer && !ended ? (
            <ChoiceTimer key={`${run.currentSceneId}:${run.history.length}`} seconds={scene.timer.seconds}
              paused={moving || !!run.popup} onTimeout={() => pick(scene.timer!.timeoutIndex)} />
          ) : null}
          <div className="mt-8 flex flex-col gap-3">
            {choices.map((c, i) => (
              <button
                key={c.index}
                type="button"
                disabled={moving || !c.enabled || !!run.popup}
                onClick={() => pick(c.index)}
                style={{ animationDelay: `${120 + i * 90}ms` }}
                className="animate-option-in group rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left text-sm font-semibold leading-6 text-zinc-100 transition duration-300 hover:-translate-y-1 hover:border-amber-300/80 hover:bg-amber-300/10 hover:shadow-[0_12px_40px_-18px_rgba(251,191,36,0.8)] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 active:scale-[0.98] disabled:opacity-60"
              >
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-300/15 text-[11px] text-amber-200 transition group-hover:scale-110">
                  {i + 1}
                </span>
                {t(c.text, run)}
                <OddsChip odds={c.odds} />
                {radar.has(c.index) ? (
                  <span className="ml-2 inline-flex items-center rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-200">⚠️ Scam radar</span>
                ) : null}
                {!c.enabled && c.lockedHint ? <span className="mt-1 block text-xs font-normal text-zinc-500">Locked: {t(c.lockedHint, run)}</span> : null}
              </button>
            ))}
          </div>
        </article>
      </div>

      {run.popup && !run.outcome && !moving && <PopupModal popup={{ ...run.popup, title: t(run.popup.title, run), body: t(run.popup.body, run),
        options: run.popup.options?.map((o) => ({ ...o, label: t(o.label, run), feedback: t(o.feedback, run) })) }} onDismiss={() => dispatch({ type: "DISMISS_POPUP" })}
        onChoose={(index) => dispatch({ type: "RESOLVE_POPUP", index })} />}
      {ended && rank && (
        <GameOverModal
          rank={{ ...rank, title: t(rank.title), blurb: t(rank.blurb) }}
          lesson={lessonFor(DB, run) ? t(lessonFor(DB, run), run) : undefined}
          won={isWin}
          stars={bestStars}
          moves={run.history.filter((h) => h.answer).length}
          interference={run.desperation}
          routeName={cfg.title}
          onReset={() => dispatch({ type: "RESTART" })}
          next={next}
        />
      )}
    </div>
  );
}
