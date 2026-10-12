"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Music, Volume2, VolumeX } from "lucide-react";
import type { Mood, Sfx } from "@/game/music";
import type { AudioEngine } from "../audio/engine";

export type SoundMode = "all" | "sfx" | "off";
const STORAGE_KEY = "japa.sound.v1";

interface SoundCtx {
  mode: SoundMode;
  setMode: (m: SoundMode) => void;
  play: (s: Sfx) => void;
  setMood: (m: Mood) => void;
}

const SoundContext = createContext<SoundCtx>({ mode: "off", setMode: () => {}, play: () => {}, setMood: () => {} });
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

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved === "all" || saved === "sfx" || saved === "off") { modeRef.current = saved; setModeState(saved); }
      } catch { /* storage blocked: keep the default */ }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const apply = useCallback((e: AudioEngine, m: SoundMode) => {
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

  const value = useMemo(() => ({ mode, setMode, play, setMood }), [mode, setMode, play, setMood]);
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

const NEXT: Record<SoundMode, SoundMode> = { all: "sfx", sfx: "off", off: "all" };
const LABEL: Record<SoundMode, string> = { all: "Music on", sfx: "Effects only", off: "Muted" };

/** Header chip: music and effects, effects only, or muted. */
export function SoundToggle() {
  const { mode, setMode } = useSound();
  const Icon = mode === "all" ? Music : mode === "sfx" ? Volume2 : VolumeX;
  return (
    <button
      type="button"
      onClick={() => setMode(NEXT[mode])}
      aria-label={`Sound: ${LABEL[mode]}. Switch to ${LABEL[NEXT[mode]]}`}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:border-amber-300/60 hover:text-white ${
        mode === "all" ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100" : "border-white/15 bg-white/5 text-zinc-300"}`}
    >
      <Icon className="h-3.5 w-3.5" /> {LABEL[mode]}
    </button>
  );
}

/** Plays a sound once when the component mounts (e.g. a pop-up or banner appearing). */
export function useSfxOnMount(s: Sfx | null) {
  const { play } = useSound();
  useEffect(() => { if (s) play(s); }, [s, play]);
}
