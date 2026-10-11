"use client";

import { useEffect, useRef, useState } from "react";
import { FileCheck2, Ghost, MapPin, Plane, Sparkles, Wallet, Zap } from "lucide-react";
import { DB, choose, presentChoices, rankFor } from "@/game/engine";
import { chance, rolls as rollDice } from "@/game/rng";
import type { BarSpec, GameState, RouteId, Transit } from "@/game/types";
import type { LayoutProps } from "../LayoutContainer";
import { LagosStage } from "../LagosStage";
import { TravelRibbon } from "../TravelRibbon";
import { CadFloat, GameOverModal, PopupModal } from "../Popups";

const STARS = [
  { top: "8%", left: "12%", delay: "0s" },
  { top: "18%", left: "78%", delay: "0.4s" },
  { top: "32%", left: "22%", delay: "1.1s" },
  { top: "44%", left: "91%", delay: "0.2s" },
  { top: "62%", left: "8%", delay: "1.6s" },
  { top: "70%", left: "64%", delay: "0.8s" },
  { top: "84%", left: "40%", delay: "1.3s" },
  { top: "14%", left: "48%", delay: "2s" },
];

const HUD: Record<string, { icon: typeof Wallet; bar: string; tint: string; glow: string }> = {
  walletNgn: { icon: Wallet, bar: "from-emerald-400 to-lime-300", tint: "bg-emerald-500/20 text-emerald-300", glow: "shadow-emerald-500/20" },
  energy: { icon: Zap, bar: "from-amber-400 to-yellow-200", tint: "bg-amber-500/20 text-amber-300", glow: "shadow-amber-400/20" },
  papers: { icon: FileCheck2, bar: "from-sky-400 to-cyan-200", tint: "bg-sky-500/20 text-sky-300", glow: "shadow-sky-400/20" },
  desperation: { icon: Ghost, bar: "from-lime-400 to-rose-500", tint: "bg-lime-500/20 text-lime-200", glow: "shadow-lime-400/20" },
};

const naira = (v: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(v);

function valueOf(run: GameState, key: BarSpec["key"]): number {
  return key in run.routeStats ? run.routeStats[key as keyof GameState["routeStats"]] ?? 0 : (run[key as keyof GameState] as number);
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
  const shown = spec.format === "ngn" ? naira(value) : `${Math.round(value)}${spec.suffix ?? ""}`;
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
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/40">
        <div className={`h-full rounded-full bg-gradient-to-r ${theme.bar} transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
      </div>
      {delta.n !== 0 && (
        <span key={delta.key} className={`animate-delta pointer-events-none absolute right-3 top-2 font-mono text-xs font-bold ${good ? "text-lime-300" : "text-rose-300"}`}>
          {delta.n > 0 ? "+" : ""}
          {spec.format === "ngn" ? naira(delta.n) : delta.n}
        </span>
      )}
    </div>
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

/** The animated Lagos backdrop: orbs, stars and a plane taxiing across. */
export function LagosBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#3b1d6e_0%,_#07060c_55%)]" />
      <div className="bg-orb -left-20 top-10 h-72 w-72 animate-[drift_12s_ease-in-out_infinite] bg-fuchsia-600/30" />
      <div className="bg-orb right-[-4rem] top-32 h-80 w-80 animate-[drift-alt_14s_ease-in-out_infinite] bg-amber-500/20" />
      <div className="bg-orb bottom-[-3rem] left-1/3 h-64 w-64 animate-[drift_16s_ease-in-out_infinite] bg-sky-500/20" />
      {STARS.map((s) => (
        <span key={`${s.top}-${s.left}`} className="star" style={{ top: s.top, left: s.left, animationDelay: s.delay }} />
      ))}
      <div className="animate-plane absolute top-40 text-amber-200/70"><Plane className="h-7 w-7" /></div>
    </div>
  );
}

const TRAVEL_MS: Record<Transit, number> = { none: 0, call: 950, trek: 1250, danfo: 1250, okada: 1250, plane: 1250 };

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

  function pick(index: number) {
    if (moving || run.popup) return;
    const rolls = rollDice();
    const next = choose(DB, run, index, rolls); // same pure rules the reducer runs
    if (next === run) return;
    dispatch({ type: "CHOOSE", index, rolls });
    const dest = DB.scenes[next.currentSceneId];
    const mode = dest?.transitIn ?? "none";
    if (mode === "none" || !dest) return;
    setHold(run.currentSceneId);
    setTravel({ mode, destination: dest.location ?? "" });
    timer.current = window.setTimeout(() => { setHold(null); setTravel(null); }, TRAVEL_MS[mode]);
  }

  const rank = ended ? rankFor(DB, run) : null;
  const nextRoutes = (cfg.nextRoutes ?? []).filter((r) => DB.routes[r]?.status === "playable");

  return (
    <div className="relative">
      {isWin && <Confetti />}
      <div className="mb-4 flex flex-col gap-4">
        <div>
          <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-300">
            <Sparkles className="h-3 w-3 animate-[bounce-soft_1.4s_ease-in-out_infinite]" />
            Lagos Life · Japa
          </p>
          <p className="title-shimmer text-xl font-black tracking-tight sm:text-3xl">{cfg.tagline}</p>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {cfg.bars.map((b) => <HudMeter key={b.key} spec={b} value={valueOf(run, b.key)} />)}
        </dl>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative">
          {scene?.stage && <LagosStage scene={scene.stage} />}
          <CadFloat amount={run.cadFloat.amount} tick={run.cadFloat.tick} />
          {travel && <TravelRibbon mode={travel.mode} destination={travel.destination} />}
        </div>

        <article
          key={shownId}
          className={`animate-scene-in relative overflow-hidden rounded-[2rem] border p-5 shadow-[0_20px_80px_-30px_rgba(251,191,36,0.55)] sm:p-7 ${
            isWin ? "border-amber-300/50 bg-gradient-to-br from-amber-500/20 to-zinc-950/80"
              : ended ? "border-rose-400/40 bg-gradient-to-br from-rose-950/70 to-zinc-950/80"
                : "border-white/10 bg-zinc-950/55 backdrop-blur-xl"}`}
        >
          <p className="animate-stamp mb-3 inline-flex items-center gap-2 rounded-full border border-dashed border-amber-300/50 px-3 py-1 text-xs uppercase tracking-[0.18em] text-amber-200">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {scene?.location}
          </p>
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{scene?.title}</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">{scene?.dialogue}</p>

          {run.lastChoice?.feedback && !moving && (
            <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/5 px-4 py-2.5 text-sm text-amber-100/90">
              {run.lastChoice.feedback}
            </p>
          )}

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
                {c.text}
              </button>
            ))}
          </div>
        </article>
      </div>

      {run.popup && !run.outcome && <PopupModal popup={run.popup} onDismiss={() => dispatch({ type: "DISMISS_POPUP" })} />}
      {ended && rank && (
        <GameOverModal
          rank={rank}
          interference={run.desperation}
          routeName={cfg.title}
          onReset={() => dispatch({ type: "RESTART" })}
          next={isWin ? nextRoutes.map((r: RouteId) => ({ label: DB.routes[r].short, onClick: () => dispatch({ type: "SELECT_ROUTE", route: r }) })) : undefined}
        />
      )}
    </div>
  );
}
