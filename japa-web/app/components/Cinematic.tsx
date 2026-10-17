"use client";

import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FastForward } from "lucide-react";
import type { CinematicSpec, Delta, Tone } from "@/game/cinematic";
import type { StageKind, Transit } from "@/game/types";
import { Person, type PersonPose, type PersonWho } from "./Person";
import { useSound } from "./Sound";
import { SceneStage } from "./Stage2D";
import { STAGES } from "./stages";

export type Speed = "full" | "quick";
const DURATION: Record<Speed, number> = { full: 3000, quick: 1300 };
const STORAGE_KEY = "japa.cinematic.speed";

export interface CinematicRequest {
  spec: CinematicSpec;
  /** The 2D location the choice happened in (drawn behind the actors). */
  stage: StageKind;
  /** Who reacts; defaults to the first other person in the stage. */
  reactor?: PersonWho;
  transit?: Transit;
  location?: string;
}

interface Ctx {
  play: (req: CinematicRequest, onDone?: () => void) => void;
  playing: boolean;
  speed: Speed;
  setSpeed: (s: Speed) => void;
}

const CinematicContext = createContext<Ctx>({ play: (_r, done) => done?.(), playing: false, speed: "full", setSpeed: () => {} });
export const useCinematic = () => useContext(CinematicContext);

// --- who reacts -------------------------------------------------------------------
const LAGOS_REACTOR: Record<string, PersonWho> = {
  "call-sister": "relative", whatsapp: "relative", "video-job": "relative", embassy: "clerk", annex: "clerk", airport: "clerk",
  agent: "agent", "yaba-street": "preacher", cafe: "clerk", gig: "npc", "phone-text": "relative", outside: "npc",
  "room-night": "roommate", "yaba-dawn": "roommate", stay: "roommate",
};
function reactorFor(stage: StageKind): PersonWho {
  const spec = (STAGES as Record<string, { people: { who: PersonWho }[] }>)[stage];
  return spec?.people.find((p) => p.who !== "you")?.who ?? LAGOS_REACTOR[stage] ?? "npc";
}

const ACTOR_POSE: Record<Tone, PersonPose> = { good: "cheer", triumph: "cheer", bad: "slump", danger: "slump", neutral: "idle" };
const REACTOR_POSE: Record<Tone, PersonPose> = { good: "wave", triumph: "cheer", bad: "talk", danger: "phone", neutral: "idle" };
const TRANSIT_LABEL: Partial<Record<Transit, string>> = {
  danfo: "By danfo", okada: "By okada", trek: "On foot", call: "On the phone", plane: "Flight",
  streetcar: "By streetcar", "snow-walk": "Through the snow",
};

// Deterministic "random" so renders stay pure: same id and index, same particle.
function rnd(seed: number, i: number) {
  const x = Math.sin(seed * 9301 + i * 49297) * 233280;
  return x - Math.floor(x);
}

function Particles({ tone, money, seed }: { tone: Tone; money: CinematicSpec["money"]; seed: number }) {
  const items: React.ReactNode[] = [];
  const colors = ["#fbbf24", "#fb7185", "#34d399", "#38bdf8", "#c084fc", "#facc15", "#f8fafc"];
  const add = (n: number, make: (i: number, r: (k: number) => number) => React.ReactNode) => {
    for (let i = 0; i < n; i++) items.push(make(items.length, (k) => rnd(seed + k, items.length)));
  };
  /** A particle falling from the top of the scene. */
  function falling(i: number, r: (k: number) => number, cls: string, content: React.ReactNode) {
    return (
      <span key={i} className={`cine-p ${cls}`} style={{
        ["--x" as string]: `${r(1) * 100}%`, ["--d" as string]: `${1.4 + r(2) * 1.2}s`, ["--delay" as string]: `${r(3) * 0.9}s`,
        ["--r" as string]: `${(r(4) - 0.5) * 720}deg`, ["--s" as string]: `${14 + r(5) * 14}px`,
        ["--c" as string]: colors[Math.floor(r(6) * colors.length)],
      }}>{content}</span>
    );
  }
  if (tone === "triumph") {
    add(42, (i, r) => falling(i, r, "confetti", null));
    add(10, (i, r) => falling(i, r, "", "🍁"));
  }
  if (tone === "good") add(26, (i, r) => falling(i, r, "confetti", null));
  if (tone === "neutral" || tone === "good") {
    add(10, (i, r) => (
      <span key={i} className="cine-p spark" style={{
        left: `${10 + r(1) * 80}%`, ["--y" as string]: `${20 + r(2) * 60}%`, ["--d" as string]: `${0.9 + r(3)}s`,
        ["--delay" as string]: `${r(4) * 1.2}s`, ["--c" as string]: "#fde68a",
      }} />
    ));
  }
  if (tone === "bad") add(10, (i, r) => falling(i, r, "", "💧"));
  if (tone === "danger") add(8, (i, r) => falling(i, r, "", "🚨"));
  if (money === "gain") add(16, (i, r) => falling(i, r, "", "🪙"));
  if (money === "loss") {
    add(14, (i, r) => (
      <span key={i} className="cine-p away" style={{
        ["--tx" as string]: `${(r(1) - 0.2) * 420}px`, ["--ty" as string]: `${-80 - r(2) * 180}px`,
        ["--d" as string]: `${0.9 + r(3) * 0.8}s`, ["--delay" as string]: `${r(4) * 0.5}s`, ["--r" as string]: `${r(5) * 540}deg`,
        ["--s" as string]: `${16 + r(6) * 10}px`,
      }}>💸</span>
    ));
  }
  return <div className="cine-particles" aria-hidden>{items}</div>;
}

function fmt(d: Delta) {
  const sign = d.value > 0 ? "+" : "−";
  const abs = Math.abs(d.value);
  if (d.format === "ngn") return `${sign}₦${abs.toLocaleString("en-NG")}`;
  if (d.format === "cad") return `${sign}CAD $${abs.toLocaleString("en-CA")}`;
  return `${sign}${abs}`;
}

/** The cutscene overlay: say beat, then react beat, then it closes itself. */
function CinematicView({ req, beat, ms, seed, onSkip }: {
  req: CinematicRequest; beat: "say" | "react"; ms: number; seed: number; onSkip: () => void;
}) {
  const { spec } = req;
  const tone = spec.tone;
  const reactor = req.reactor ?? reactorFor(req.stage);
  const reacting = beat === "react";
  const line = spec.line.length > 150 ? `${spec.line.slice(0, 147)}…` : spec.line;
  return (
    <div className="cine-backdrop" role="dialog" aria-modal="true" aria-label="Choice animation" onClick={onSkip}>
      <div className={`cine-card tone-${tone} ${reacting ? "react" : ""}`} style={{ ["--cine-ms" as string]: `${ms}ms` }}>
        <div className="cine-stage">
          {/* The camera: the set and the actors move together, so a push-in or a cut frames both. */}
          <div className="cine-camera">
            <div className="cine-scene"><SceneStage stage={req.stage} mood={reacting ? (tone === "bad" || tone === "danger" ? "fail" : tone === "neutral" ? "calm" : "win") : "calm"} /></div>
            <div className="cine-flash" />
            <div className="cine-actor enter-left">
              <Person who="you" x={20} scale={2.1} pose={reacting ? ACTOR_POSE[tone] : "talk"} face={reacting && tone === "danger" ? "shock" : undefined} caption="You" wear={req.stage.match(/toronto|pearson|campus|graduation/) ? ["scarf"] : []} />
            </div>
            <div className="cine-actor enter-right">
              <Person who={reactor} x={80} scale={1.8} flip pose={reacting ? REACTOR_POSE[tone] : "idle"} face={reacting ? (tone === "good" || tone === "triumph" ? "grin" : tone === "neutral" ? undefined : "shock") : undefined} />
            </div>
          </div>
          <div className="cine-grain" aria-hidden />
          <div className="cine-bars" aria-hidden />
          {req.transit && TRANSIT_LABEL[req.transit] ? (
            <span className="cine-transit">{TRANSIT_LABEL[req.transit]} · {req.location}</span>
          ) : null}
          <div className="cine-bubble">
            {`“${line}”`.split(" ").map((w, i, all) => (
              // Spread the words over the "say" beat.
              <Fragment key={i}>
                <span className="word" style={{ ["--delay" as string]: `${0.3 + (i / all.length) * ms * 0.0003}s` }}>{w}</span>{" "}
              </Fragment>
            ))}
          </div>
          {reacting && spec.label ? <div className="cine-stamp">{spec.label.replace(/_/g, " ")}</div> : null}
          {reacting ? <Particles tone={tone} money={spec.money} seed={seed} /> : null}
        </div>
        <div className="cine-results" aria-live="polite">
          {reacting && spec.deltas.map((d, i) => (
            <span key={d.key} className={`cine-chip ${d.good ? "up" : "down"}`} style={{ ["--delay" as string]: `${0.15 + i * 0.12}s` }}>
              {fmt(d)} <span className="font-semibold opacity-80">{d.label}</span>
            </span>
          ))}
        </div>
        {spec.feedback ? (
          <p className={`px-4 pb-3 text-sm leading-6 text-zinc-300 transition-opacity duration-300 ${reacting ? "opacity-100" : "opacity-0"}`}>
            {spec.feedback}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-2.5 text-[11px] text-zinc-500">
          <span>Tap anywhere to continue</span>
          <button type="button" onClick={(e) => { e.stopPropagation(); onSkip(); }}
            className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 font-semibold text-zinc-300 hover:text-white">
            <FastForward className="h-3 w-3" /> Skip
          </button>
        </div>
        <div className="cine-progress" />
        <div className="cine-fadeout" aria-hidden />
      </div>
    </div>
  );
}

export function CinematicProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<{ req: CinematicRequest; id: number } | null>(null);
  const [beat, setBeat] = useState<"say" | "react">("say");
  const [speed, setSpeedState] = useState<Speed>("full");
  const done = useRef<(() => void) | undefined>(undefined);
  const timers = useRef<number[]>([]);
  const seq = useRef(0);

  // Restore the saved preference after mount (storage may be unavailable).
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved === "quick" || saved === "full") setSpeedState(saved);
      } catch { /* private mode: keep the default */ }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const clearTimers = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
  useEffect(() => clearTimers, []);

  const finish = useCallback(() => {
    clearTimers();
    setCurrent(null);
    const cb = done.current;
    done.current = undefined;
    cb?.();
  }, []);

  const sound = useSound();
  const play = useCallback((req: CinematicRequest, onDone?: () => void) => {
    clearTimers();
    done.current?.(); // a previous cutscene still running: let its caller continue
    done.current = onDone;
    seq.current += 1;
    const ms = DURATION[speed];
    setCurrent({ req, id: seq.current });
    setBeat("say");
    timers.current.push(window.setTimeout(() => {
      setBeat("react");
      const tone = req.spec.tone;
      sound.play(tone === "triumph" || tone === "good" ? "good" : tone === "danger" ? "danger" : tone === "bad" ? "bad" : "stamp");
      if (req.spec.money) timers.current.push(window.setTimeout(() => sound.play(req.spec.money === "gain" ? "coin" : "cashOut"), 350));
    }, Math.round(ms * 0.38)));
    timers.current.push(window.setTimeout(finish, ms));
  }, [speed, finish, sound]);

  const setSpeed = useCallback((s: Speed) => {
    setSpeedState(s);
    try { window.localStorage.setItem(STORAGE_KEY, s); } catch { /* ignore */ }
  }, []);

  // Escape, Enter or Space skip the cutscene.
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") { e.preventDefault(); finish(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, finish]);

  const value = useMemo(() => ({ play, playing: !!current, speed, setSpeed }), [play, current, speed, setSpeed]);
  return (
    <CinematicContext.Provider value={value}>
      {children}
      {current ? <CinematicView key={current.id} req={current.req} beat={beat} ms={DURATION[speed]} seed={current.id} onSkip={finish} /> : null}
    </CinematicContext.Provider>
  );
}

/** Header switch between full and quick cutscenes. */
export function SpeedToggle() {
  const { speed, setSpeed } = useCinematic();
  return (
    <button
      type="button"
      onClick={() => setSpeed(speed === "full" ? "quick" : "full")}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-amber-300/60 hover:text-white"
      aria-label={`Animations: ${speed}. Switch to ${speed === "full" ? "quick" : "full"}`}
    >
      Animations: {speed === "full" ? "Full" : "Quick"}
    </button>
  );
}
