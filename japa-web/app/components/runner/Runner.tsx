"use client";

// The playable 2D run between story chapters. Optional: you can skip it at the gate or from inside it.
// Keyboard: A/D or arrows to run, Space/W/Up to jump, S/Down to slide. Touch: the on-screen buttons.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pause, Play, X } from "lucide-react";
import { newRunner, runReward, step, VIEW_H, type Input, type Level, type RunnerState } from "@/game/runner/engine";
import { DEFAULT_AVATAR, type Avatar } from "@/game/profile";
import { useSound } from "../Sound";
import { drawFrame } from "./draw";

export interface RunResult { coins: number; stamps: number; hearts: number; done: boolean; jp: number; effects: { desperation: number; energy: number } }

const KEYS: Record<string, keyof Input> = {
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
  Space: "jump", KeyW: "jump", ArrowUp: "jump", ArrowDown: "slide", KeyS: "slide",
};

type Phase = "intro" | "playing" | "paused" | "ended";

export function Runner({ level, avatar, onFinish, onClose }: {
  level: Level;
  avatar?: Avatar | null;
  onFinish: (r: RunResult) => void;
  onClose: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const state = useRef<RunnerState>(newRunner(level));
  const input = useRef<Input>({ left: false, right: false, jump: false, slide: false });
  const sparkle = useRef<{ x: number; y: number; t: number }[]>([]);
  const [phase, setPhase] = useState<Phase>("intro");
  const [hud, setHud] = useState({ hearts: 3, coins: 0, stamps: 0, progress: 0 });
  const [result, setResult] = useState<{ done: boolean; reward: ReturnType<typeof runReward> } | null>(null);
  const { play } = useSound();
  const av = avatar ?? DEFAULT_AVATAR;

  // Keyboard.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Escape") { setPhase((p) => (p === "playing" ? "paused" : p)); return; }
      const k = KEYS[e.code];
      if (!k) return;
      e.preventDefault();
      input.current[k] = true;
    };
    const up = (e: KeyboardEvent) => { const k = KEYS[e.code]; if (k) input.current[k] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // Pause when the phone backgrounds the app.
  useEffect(() => {
    const onVis = () => { if (document.hidden) setPhase((p) => (p === "playing" ? "paused" : p)); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const finish = useCallback(() => {
    const s = state.current;
    const r = runReward(s);
    onFinish({ coins: r.coins, stamps: r.stamps, hearts: s.hearts, done: s.done, jp: r.jp, effects: r.effects });
  }, [onFinish]);

  // The loop: fixed 60 Hz steps, drawn every animation frame.
  useEffect(() => {
    const cv = canvas.current, box = wrap.current;
    if (!cv || !box) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let raf = 0, last = performance.now(), acc = 0;
    const DT = 1 / 60;
    const frame = (now: number) => {
      const cssW = box.clientWidth, cssH = box.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(cssW * dpr) || cv.height !== Math.round(cssH * dpr)) { cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr); }
      const scale = (cssH / VIEW_H) * dpr;
      const viewW = cv.width / scale;
      acc += Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = state.current;
      if (phase === "playing") {
        while (acc >= DT) {
          acc -= DT;
          for (const e of step(s, input.current, DT)) {
            if (e === "jump") play("jump");
            else if (e === "coin" || e === "stamp") { play(e === "coin" ? "coin" : "stamp"); sparkle.current.push({ x: s.x, y: s.y - 30, t: s.t }); }
            else if (e === "hurt" || e === "fall") play("hurt");
            else if (e === "clear" || e === "over") {
              play(e === "clear" ? "clear" : "fail");
              setResult({ done: s.done, reward: runReward(s) });
              setPhase("ended");
            }
          }
        }
        sparkle.current = sparkle.current.filter((p) => s.t - p.t < 0.5);
        setHud((h) => (h.hearts === s.hearts && h.coins === s.coins.size && h.stamps === s.stamps.size && Math.abs(h.progress - s.x / s.level.gateX) < 0.01
          ? h : { hearts: s.hearts, coins: s.coins.size, stamps: s.stamps.size, progress: Math.min(1, s.x / s.level.gateX) }));
      } else acc = 0;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawFrame(ctx, s, viewW, av, sparkle.current);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, play, av]);

  const hold = (k: keyof Input) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); (e.target as Element).setPointerCapture?.(e.pointerId); input.current[k] = true; },
    onPointerUp: () => { input.current[k] = false; },
    onPointerCancel: () => { input.current[k] = false; },
    onPointerLeave: () => { input.current[k] = false; },
  });
  const pad = "flex h-14 w-14 select-none items-center justify-center rounded-2xl border border-white/20 bg-black/45 text-white backdrop-blur active:scale-95 active:bg-amber-300/30 touch-none";
  const retry = () => { state.current = newRunner(level); sparkle.current = []; setResult(null); setPhase("playing"); };
  const done = result?.done ?? false;
  const reward = result?.reward ?? runReward({ coins: new Set(), stamps: new Set(), hearts: 3, done: false });

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={`${level.title}: runner`}>
      <div className="relative w-full max-w-4xl overflow-hidden rounded-[1.6rem] border border-white/15 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
          <div className="flex items-center gap-3 font-bold text-white">
            <span aria-label={`${hud.hearts} hearts left`}>{"❤️".repeat(Math.max(0, hud.hearts))}{"🖤".repeat(Math.max(0, 3 - hud.hearts))}</span>
            <span className="text-amber-200">₦ {hud.coins}</span>
            <span className="text-emerald-300">🛂 {hud.stamps}</span>
          </div>
          <div className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-white/10 sm:block" aria-hidden>
            <div className="h-full bg-gradient-to-r from-amber-300 to-emerald-400" style={{ width: `${hud.progress * 100}%` }} />
          </div>
          <div className="flex items-center gap-1.5">
            {phase === "playing" || phase === "paused" ? (
              <button type="button" onClick={() => setPhase(phase === "playing" ? "paused" : "playing")} aria-label={phase === "playing" ? "Pause" : "Resume"}
                className="rounded-full p-1.5 text-zinc-300 hover:bg-white/10">{phase === "playing" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
            ) : null}
            <button type="button" onClick={onClose} aria-label="Skip the run" className="rounded-full p-1.5 text-zinc-300 hover:bg-white/10"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div ref={wrap} className="relative h-[min(56vh,320px)] w-full">
          <canvas ref={canvas} className="block h-full w-full" />
          {phase === "intro" || phase === "paused" || phase === "ended" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 p-4">
              <div className="max-w-sm rounded-2xl border border-white/15 bg-zinc-950/95 p-5 text-center">
                {phase === "intro" ? (
                  <>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">Optional run</p>
                    <h2 className="mt-1 text-xl font-black text-white">{level.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">
                      Race through Yaba to the {level.gateLabel}. Jump the sparking NEPA cables, dodge or slide under the Village People,
                      grab ₦ coins and passport stamps. They turn into Japa Points and calm, not money.
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">A/D or ← → to run · Space/W to jump · S/↓ to slide · Esc to pause</p>
                    <div className="mt-4 flex justify-center gap-2">
                      <button type="button" onClick={onClose} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-zinc-200">Skip</button>
                      <button type="button" autoFocus onClick={() => setPhase("playing")} className="rounded-xl bg-amber-300 px-5 py-2 text-sm font-black text-zinc-950">Run!</button>
                    </div>
                  </>
                ) : phase === "paused" ? (
                  <>
                    <h2 className="text-xl font-black text-white">Paused</h2>
                    <div className="mt-4 flex justify-center gap-2">
                      <button type="button" onClick={onClose} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-zinc-200">Skip</button>
                      <button type="button" autoFocus onClick={() => setPhase("playing")} className="rounded-xl bg-amber-300 px-5 py-2 text-sm font-black text-zinc-950">Resume</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">{done ? "Checkpoint!" : "Out of hearts"}</p>
                    <h2 className="mt-1 text-xl font-black text-white">{done ? `You made it to the ${level.gateLabel}` : "The Village People won this round"}</h2>
                    <p className="mt-2 text-sm text-zinc-300">₦ {reward.coins} coins · 🛂 {reward.stamps} stamps</p>
                    <p className="mt-1 text-sm font-bold text-emerald-300">+{reward.jp} JP · Village People −{-reward.effects.desperation}{reward.effects.energy ? ` · Energy +${reward.effects.energy}` : ""}</p>
                    <div className="mt-4 flex justify-center gap-2">
                      {!done ? <button type="button" onClick={retry}
                        className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-zinc-200">Try again</button> : null}
                      <button type="button" autoFocus onClick={finish} className="rounded-xl bg-amber-300 px-5 py-2 text-sm font-black text-zinc-950">Continue to the story</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
        {/* Touch controls in their own bar, so thumbs never cover the street. */}
        <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-2 sm:hidden pointer-coarse:flex">
          <div className="flex gap-2">
            <button type="button" aria-label="Run left" className={pad} {...hold("left")}><ArrowLeft className="h-6 w-6" /></button>
            <button type="button" aria-label="Run right" className={pad} {...hold("right")}><ArrowRight className="h-6 w-6" /></button>
          </div>
          <div className="flex gap-2">
            <button type="button" aria-label="Slide" className={pad} {...hold("slide")}><ArrowDown className="h-6 w-6" /></button>
            <button type="button" aria-label="Jump" className={`${pad} h-16 w-16 bg-amber-300/30`} {...hold("jump")}><ArrowUp className="h-7 w-7" /></button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
