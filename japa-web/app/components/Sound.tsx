"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Music, Volume2, VolumeX } from "lucide-react";
import { STYLES, STYLE_IDS, type Mood, type Sfx, type Style } from "@/game/music";
import type { AudioEngine } from "../audio/engine";

export type SoundMode = "all" | "sfx" | "off";
const STORAGE_KEY = "japa.sound.v1";
const VOLUME_KEY = "japa.volume.v1";
const STYLE_KEY = "japa.style.v1";
export interface Volumes { music: number; sfx: number; ambience: number }
const DEFAULT_VOLUMES: Volumes = { music: 0.8, sfx: 0.9, ambience: 0.6 };

interface SoundCtx {
  mode: SoundMode;
  setMode: (m: SoundMode) => void;
  play: (s: Sfx) => void;
  setMood: (m: Mood) => void;
  volumes: Volumes;
  setVolumes: (v: Volumes) => void;
  style: Style;
  setStyle: (s: Style) => void;
}

const SoundContext = createContext<SoundCtx>({
  mode: "off", setMode: () => {}, play: () => {}, setMood: () => {}, volumes: DEFAULT_VOLUMES, setVolumes: () => {},
  style: "afrobeat", setStyle: () => {},
});
export const useSound = () => useContext(SoundContext);

/**
 * Owns the audio engine. Browsers only allow sound after the player interacts, so the engine starts on the
 * first tap or key press, then follows the current mood.
 */
export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<SoundMode>("all");
  const engine = useRef<AudioEngine | null>(null);
  const mood = useRef<Mood>("lagos");
  const modeRef = useRef<SoundMode>("all");
  const [volumes, setVolumesState] = useState<Volumes>(DEFAULT_VOLUMES);
  const volRef = useRef<Volumes>(DEFAULT_VOLUMES);
  const [style, setStyleState] = useState<Style>("afrobeat");
  const styleRef = useRef<Style>("afrobeat");

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved === "all" || saved === "sfx" || saved === "off") { modeRef.current = saved; setModeState(saved); }
        const st = window.localStorage.getItem(STYLE_KEY) as Style | null;
        if (st && STYLE_IDS.includes(st)) { styleRef.current = st; setStyleState(st); }
        const v = JSON.parse(window.localStorage.getItem(VOLUME_KEY) ?? "null") as Partial<Volumes> | null;
        if (v && typeof v.music === "number" && typeof v.sfx === "number") {
          volRef.current = { music: v.music, sfx: v.sfx, ambience: typeof v.ambience === "number" ? v.ambience : DEFAULT_VOLUMES.ambience };
          setVolumesState(volRef.current);
        }
      } catch { /* storage blocked: keep the default */ }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const apply = useCallback((e: AudioEngine, m: SoundMode) => {
    e.setVolumes(volRef.current.music, volRef.current.sfx, volRef.current.ambience);
    e.setStyle(styleRef.current);
    e.setMusicOn(m === "all");
    e.setSfxOn(m !== "off");
  }, []);

  // Start the engine on the first gesture; give every button a soft click.
  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      if (modeRef.current === "off" || engine.current || cancelled) return;
      const { AudioEngine: Engine } = await import("../audio/engine");
      if (cancelled || engine.current) return;
      try {
        const e = new Engine();
        engine.current = e;
        apply(e, modeRef.current);
        e.setMood(mood.current);
        (window as unknown as { __japaAudio?: AudioEngine["stats"] }).__japaAudio = e.stats;
      } catch { /* no Web Audio: play silently */ }
    };
    const onGesture = (ev: Event) => {
      engine.current?.resume();
      void start();
      const el = ev.target as HTMLElement | null;
      if (ev.type === "pointerdown" && el?.closest?.("button, [role=tab], a")) engine.current?.play("click");
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [apply]);

  useEffect(() => () => { engine.current?.stop(); engine.current = null; }, []);

  const setMode = useCallback((m: SoundMode) => {
    modeRef.current = m;
    setModeState(m);
    try { window.localStorage.setItem(STORAGE_KEY, m); } catch { /* ignore */ }
    if (engine.current) apply(engine.current, m);
  }, [apply]);

  const play = useCallback((s: Sfx) => {
    if (modeRef.current !== "off") engine.current?.play(s);
  }, []);

  const setMood = useCallback((m: Mood) => {
    mood.current = m;
    engine.current?.setMood(m);
  }, []);

  const setVolumes = useCallback((v: Volumes) => {
    volRef.current = v;
    setVolumesState(v);
    try { window.localStorage.setItem(VOLUME_KEY, JSON.stringify(v)); } catch { /* ignore */ }
    engine.current?.setVolumes(v.music, v.sfx, v.ambience);
  }, []);

  const setStyle = useCallback((st: Style) => {
    styleRef.current = st;
    setStyleState(st);
    try { window.localStorage.setItem(STYLE_KEY, st); } catch { /* ignore */ }
    engine.current?.setStyle(st);
  }, []);

  const value = useMemo(() => ({ mode, setMode, play, setMood, volumes, setVolumes, style, setStyle }),
    [mode, setMode, play, setMood, volumes, setVolumes, style, setStyle]);
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

const LABEL: Record<SoundMode, string> = { all: "Music on", sfx: "Effects only", off: "Muted" };
const MODES: SoundMode[] = ["all", "sfx", "off"];

/** Header chip: opens a small mixer with the sound mode and music/effects volume. */
export function SoundToggle() {
  const { mode, setMode, volumes, setVolumes, play, style, setStyle } = useSound();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", close); };
  }, [open]);
  const Icon = mode === "all" ? Music : mode === "sfx" ? Volume2 : VolumeX;
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Sound: ${LABEL[mode]}. Open the mixer`}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:border-amber-300/60 hover:text-white ${
          mode === "all" ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100" : "border-white/15 bg-white/5 text-zinc-300"}`}
      >
        <Icon className="h-3.5 w-3.5" /> {LABEL[mode]}
      </button>
      {open ? (
        <div role="dialog" aria-label="Sound mixer"
          className="animate-scene-in absolute right-0 top-full z-30 mt-2 max-h-[75vh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-white/15 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1" role="radiogroup" aria-label="Sound mode">
            {MODES.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                className={`rounded-lg px-1.5 py-1.5 text-[11px] font-semibold ${mode === m ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200"}`}>
                {LABEL[m]}
              </button>
            ))}
          </div>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-200/80">Soundtrack</p>
          <div className="mt-2 space-y-1.5" role="radiogroup" aria-label="Soundtrack style">
            {STYLE_IDS.map((id) => (
              <button key={id} type="button" role="radio" aria-checked={style === id}
                onClick={() => { setStyle(id); if (mode !== "all") setMode("all"); }}
                className={`block w-full rounded-xl border px-3 py-2 text-left transition ${style === id
                  ? "border-amber-300/60 bg-amber-300/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}>
                <span className="block text-xs font-bold text-white">{STYLES[id].label}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-zinc-400">{STYLES[id].blurb}</span>
              </button>
            ))}
          </div>
          <Slider label="Music" value={volumes.music} disabled={mode !== "all"} onChange={(music) => setVolumes({ ...volumes, music })} />
          <Slider label="Ambience (Lagos / Canada)" value={volumes.ambience} disabled={mode !== "all"} onChange={(ambience) => setVolumes({ ...volumes, ambience })} />
          <Slider label="Effects" value={volumes.sfx} disabled={mode === "off"} onChange={(sfx) => setVolumes({ ...volumes, sfx })}
            onRelease={() => play("good")} />
        </div>
      ) : null}
    </div>
  );
}

function Slider({ label, value, disabled, onChange, onRelease }: {
  label: string; value: number; disabled: boolean; onChange: (v: number) => void; onRelease?: () => void;
}) {
  return (
    <label className={`mt-3 block text-xs ${disabled ? "opacity-40" : ""}`}>
      <span className="flex justify-between font-medium text-zinc-300"><span>{label}</span><span className="font-mono text-zinc-500">{Math.round(value * 100)}%</span></span>
      <input type="range" min={0} max={100} step={5} value={Math.round(value * 100)} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)} onPointerUp={onRelease} onKeyUp={onRelease}
        className="mt-1.5 w-full accent-amber-300" aria-label={`${label} volume`} />
    </label>
  );
}

/** Plays a sound once when the component mounts (e.g. a pop-up or banner appearing). */
export function useSfxOnMount(s: Sfx | null) {
  const { play } = useSound();
  useEffect(() => { if (s) play(s); }, [s, play]);
}
