"use client";

import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FastForward } from "lucide-react";
import type { CinematicSpec, Delta, Tone } from "@/game/cinematic";
import { FILM_MS, SPEAKER_DEFAULT, filmScript, moodOf, whoInChoice, type FilmScript } from "@/game/film";
import { GIVER_WHO, momentFor } from "@/game/moments";
import type { StageKind, Transit } from "@/game/types";
import { FilmShot } from "./film/FilmPlayer";
import { Person, type PersonPose, type PersonWho } from "./Person";
import { usePlayer } from "./Player";
import { useSound } from "./Sound";
import { SceneStage } from "./Stage2D";
import { STAGES } from "./stages";

export type Speed = "full" | "quick";
/** Full speed plays the film (game/film.ts, about 32 seconds); Quick plays a short two-beat cutscene. */
const DURATION: Record<Speed, number> = { full: FILM_MS, quick: 1300 };
/** Share of the quick cutscene spent on the say beat; the react beat gets the rest. */
const SAY_SHARE = 0.42;
const STORAGE_KEY = "japa.cinematic.speed";

export interface CinematicRequest {
  spec: CinematicSpec;
  /** The 2D location the choice happened in (drawn behind the actors). */
  stage: StageKind;
  /** Who reacts; defaults to the first other person in the stage. */
  reactor?: PersonWho;
  transit?: Transit;
  location?: string;
  /** The choice's own words in English, before translation and names (for the film's big moments). */
  choiceText?: string;
  /** The scene the choice was made in. */
  sceneId?: string;
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

/** Your words, revealed one after another over `span` seconds starting at `from`. */
function Words({ text, from, span }: { text: string; from: number; span: number }) {
  return (
    <>
      {text.split(" ").map((w, i, all) => (
        <Fragment key={i}>
          <span className="word" style={{ ["--delay" as string]: `${from + (i / all.length) * span}s` }}>{w}</span>{" "}
        </Fragment>
      ))}
    </>
  );
}

/** Who the other person is, as the scene's set names them ("Supervisor", "CBSA officer"), if it does. */
function captionFor(stage: StageKind, reactor: PersonWho): string | undefined {
  const spec = (STAGES as Record<string, { people: { who: PersonWho; caption?: string }[] }>)[stage];
  return spec?.people.find((p) => p.who === reactor)?.caption;
}

/** The film: one shot at a time, with the reel and the controls. */
function FilmView({ req, index, reactor, script, seed, onSkip, onNext }: {
  req: CinematicRequest; index: number; reactor: PersonWho; script: FilmScript; seed: number; onSkip: () => void; onNext: () => void;
}) {
  const { t } = usePlayer();
  const plan = script.plan;
  const shot = plan[index];
  const speaker = t(captionFor(req.stage, reactor) ?? SPEAKER_DEFAULT[script.circle]);
  return (
    // A stray tap does nothing: the film only moves on from its own buttons (or Enter / Escape).
    <div className="cine-backdrop film-backdrop" role="dialog" aria-modal="true" aria-label="Choice film">
      <div className={`film-card ${index === 0 ? "first" : ""}`}>
        {/* key: every shot is a cut, so the camera move and the animations start again. */}
        <FilmShot key={index} kind={shot.kind} ms={shot.ms} spec={req.spec} stage={req.stage} location={req.location} script={script}
          speaker={speaker} particles={<Particles tone={req.spec.tone} money={req.spec.money} seed={seed} />} />
        <div className="film-controls">
          <span>{index + 1} / {plan.length}</span>
          <span className="flex items-center gap-2">
            <button type="button" onClick={onNext}
              className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 font-semibold text-zinc-300 hover:text-white">
              Next shot ›
            </button>
            <button type="button" onClick={onSkip}
              className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 font-semibold text-zinc-300 hover:text-white">
              <FastForward className="h-3 w-3" /> Skip film
            </button>
          </span>
        </div>
        {/* One segment per shot, like a story reel. */}
        <div className="cine-reel" aria-hidden>
          {plan.map((s, i) => (
            <span key={i} className={i < index ? "done" : i === index ? "now" : ""}>
              {i === index ? <i key={`r${index}`} style={{ animationDuration: `${s.ms}ms` }} /> : null}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Quick mode: the short two-beat cutscene. */
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
      <div className={`cine-card tone-${tone} ${reacting ? "react" : ""} quick`} style={{ ["--cine-ms" as string]: `${ms}ms` }}>
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
          <div className="cine-bubble"><Words text={`“${line}”`} from={0.3} span={Math.max(0.3, (ms * SAY_SHARE - 500) / 1000)} /></div>
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
  const [current, setCurrent] = useState<{ req: CinematicRequest; id: number; film: boolean; script: FilmScript; reactor: PersonWho } | null>(null);
  const [beat, setBeat] = useState<"say" | "react">("say");
  const [shot, setShot] = useState(0);
  const [speed, setSpeedState] = useState<Speed>("full");
  const done = useRef<(() => void) | undefined>(undefined);
  const timers = useRef<number[]>([]);
  const seq = useRef(0);
  const reacted = useRef(false);
  const shotRef = useRef(0);
  const reqRef = useRef<CinematicRequest | null>(null);
  const script0 = useRef<FilmScript | null>(null);

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
  const { t: tr } = usePlayer();
  const relName = tr("{relName}");
  const react = useCallback((req: CinematicRequest) => {
    if (reacted.current) return;
    reacted.current = true;
    setBeat("react");
    const tone = req.spec.tone;
    sound.play(tone === "triumph" || tone === "good" ? "good" : tone === "danger" ? "danger" : tone === "bad" ? "bad" : "stamp");
    if (req.spec.money) timers.current.push(window.setTimeout(() => sound.play(req.spec.money === "gain" ? "coin" : "cashOut"), 350));
  }, [sound]);

  /** Film mode: show shot i, then cut to the next one when its time is up. */
  const runShot = useCallback(function run(i: number) {
    const req = reqRef.current;
    if (!req) return;
    clearTimers();
    const plan = script0.current?.plan ?? [];
    if (i >= plan.length) { finish(); return; }
    shotRef.current = i;
    setShot(i);
    if (i >= plan.findIndex((s) => s.kind === "react")) react(req);
    const kind = plan[i].kind;
    if (kind === "ripple" || (kind === "insert" && script0.current?.insert === "phone")) sound.play("phone");
    if (kind === "verdict" && script0.current?.verdict === "stamp") sound.play("stamp");
    if (kind === "establish") sound.play("wind");
    if (kind === "dial") sound.play("phone");
    if (kind === "plane") sound.play("plane");
    if (kind === "handover") timers.current.push(window.setTimeout(() => sound.play(req.spec.money === "loss" ? "cashOut" : "click"), 2600));
    if (kind === "screen") timers.current.push(window.setTimeout(() => sound.play(script0.current?.mood === "down" ? "bad" : "good"), 3400));
    if (kind === "showoff") sound.play("good");
    timers.current.push(window.setTimeout(() => run(i + 1), plan[i].ms));
  }, [finish, react, sound]);

  const next = useCallback(() => runShot(shotRef.current + 1), [runShot]);

  const play = useCallback((req: CinematicRequest, onDone?: () => void) => {
    clearTimers();
    done.current?.(); // a previous cutscene still running: let its caller continue
    done.current = onDone;
    seq.current += 1;
    reacted.current = false;
    reqRef.current = req;
    // The English choice text (before translation) tells the film who is involved and which big moment this is.
    const text = req.choiceText ?? req.spec.line;
    const moment = momentFor(text, req.sceneId ?? "", moodOf(req.spec.tone));
    const reactor = req.reactor
      ?? ((moment?.giver ? GIVER_WHO[moment.giver] : whoInChoice(text, relName)) as PersonWho | null)
      ?? reactorFor(req.stage);
    const script = filmScript(req.spec.tone, reactor, seq.current, req.spec.deltas, captionFor(req.stage, reactor), text, req.sceneId);
    script0.current = script;
    setBeat("say");
    if (speed === "full") {
      setCurrent({ req, id: seq.current, film: true, script, reactor });
      runShot(0);
      return;
    }
    const ms = DURATION.quick;
    setCurrent({ req, id: seq.current, film: false, script, reactor });
    timers.current.push(window.setTimeout(() => react(req), Math.round(ms * SAY_SHARE)));
    timers.current.push(window.setTimeout(finish, ms));
  }, [speed, finish, react, runShot, relName]);

  const setSpeed = useCallback((s: Speed) => {
    setSpeedState(s);
    try { window.localStorage.setItem(STORAGE_KEY, s); } catch { /* ignore */ }
  }, []);

  // Escape skips the film; Enter or Space cut to the next shot (or close the quick cutscene).
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); finish(); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (current.film) next(); else finish(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, finish, next]);

  const value = useMemo(() => ({ play, playing: !!current, speed, setSpeed }), [play, current, speed, setSpeed]);
  return (
    <CinematicContext.Provider value={value}>
      {children}
      {current && current.film ? (
        <FilmView key={current.id} req={current.req} index={shot} reactor={current.reactor} script={current.script} seed={current.id}
          onSkip={finish} onNext={next} />
      ) : null}
      {current && !current.film ? <CinematicView key={current.id} req={current.req} beat={beat} ms={DURATION.quick} seed={current.id} onSkip={finish} /> : null}
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
