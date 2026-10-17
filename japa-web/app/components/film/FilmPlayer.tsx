"use client";
// Plays one shot of the after-choice film: a drawn set, actors, a camera move, subtitles and inserts.
// The shot list and the words come from game/film.ts; this file only decides how each shot looks.
import { Fragment, type ReactNode } from "react";
import type { CinematicSpec, Delta } from "@/game/cinematic";
import { DEFAULT_AVATAR, familyFor, type Avatar } from "@/game/profile";
import type { FilmScript, ShotKind } from "@/game/film";
import type { StageKind } from "@/game/types";
import { relativeAvatar, type PersonWho } from "../Person";
import { usePlayer } from "../Player";
import { Actor, type ActorFace, type ActorPose, type Look } from "./Actor";
import { NOTES } from "@/game/moments";
import { BoardInsert, DialInsert, ItemInsert, NotesInsert, PropSvg, ScreenInsert } from "./Props";
import { setLayers, type SetKind } from "./Sets";

// --- Casting ---------------------------------------------------------------------------------------------------

const toLook = (a: Avatar): Look => ({
  skin: a.skin, hair: a.hair, hairColor: a.hairColor, outfit: a.outfit, outfitColor: a.outfitColor,
  headwear: a.headwear, headwearColor: a.headwearColor, glasses: a.glasses, body: a.body,
});

const CAST: Record<FilmScript["circle"], Look> = {
  family: toLook(DEFAULT_AVATAR), // replaced by the player's own relative
  friend: { skin: "#a16207", hair: "afro", hairColor: "#1c1917", outfit: "tee-jeans", outfitColor: "#2563eb" },
  official: { skin: "#c68863", hair: "low-cut", hairColor: "#1c1917", outfit: "uniform", outfitColor: "#1e3a8a", glasses: true },
  boss: { skin: "#e5b48f", hair: "low-cut", hairColor: "#57534e", outfit: "suit", outfitColor: "#334155", tie: "#a16207", beard: true, body: "plus" },
  hustler: { skin: "#92400e", hair: "low-cut", hairColor: "#0f172a", outfit: "senator", outfitColor: "#e2e8f0", glasses: true },
  faith: { skin: "#5b3410", hair: "bald", hairColor: "#0b0b0b", outfit: "cassock", outfitColor: "#111827", body: "plus" },
  stranger: { skin: "#7c3a12", hair: "low-cut", hairColor: "#1c1917", outfit: "tee-jeans", outfitColor: "#f59e0b", headwear: "fila", headwearColor: "#b45309" },
};
const ROOMMATE: Look = CAST.friend;

/** Where you are, drawn: from the game's stage for this scene. */
export function yourSet(stage: StageKind): SetKind {
  if (stage === "cafe") return "cafe";
  if (stage === "agent") return "agent-office";
  if (stage === "warehouse") return "warehouse";
  if (stage === "boardroom" || stage === "pitch-room" || stage === "video-job") return "boardroom";
  if (/airport|pearson|pr-landing/.test(stage)) return "airport";
  if (/room-night|call-sister|whatsapp|phone-text|ircc-portal|stay|basement/.test(stage)) return "bedroom";
  if (/annex|embassy|bank|registry|ielts|french|service-canada|cbsa|irb|legal|lecture|library/.test(stage)) return "office";
  if (/toronto|campus|tim-hortons|job-fair|graduation|shelter/.test(stage)) return "toronto-street";
  return "lagos-street";
}

/** Their side: where the other person is when your choice reaches them. */
export function theirSet(circle: FilmScript["circle"], stage: StageKind): SetKind {
  switch (circle) {
    case "family": return "living-room";
    case "friend": return "bedroom";
    case "official": return "office";
    case "boss": return stage === "warehouse" ? "warehouse" : "boardroom";
    case "hustler": return "agent-office";
    case "faith": return "church";
    default: return yourSet(stage);
  }
}

// --- Camera ----------------------------------------------------------------------------------------------------

interface Cam { x: number; y: number; z: number }
const camT = (c: Cam) => `translate(${800 - c.x * c.z}px, ${450 - c.y * c.z}px) scale(${c.z})`;
const FLOOR = 800;
/** The centre of a face, for an actor standing at x with this scale. */
const face = (x: number, s = 1, y = FLOOR): Cam => ({ x, y: y - 395 * s, z: 1 });
const closeOn = (x: number, s: number, z0: number, z1: number): [Cam, Cam] => {
  const f = face(x, s);
  return [{ x: f.x, y: f.y + 40 * s, z: z0 / s }, { x: f.x, y: f.y + 30 * s, z: z1 / s }];
};
const mediumOn = (x: number, s: number, z0: number, z1: number): [Cam, Cam] =>
  [{ x, y: FLOOR - 290 * s, z: z0 / s }, { x, y: FLOOR - 300 * s, z: z1 / s }];

function fmt(d: Delta) {
  const sign = d.value > 0 ? "+" : "−";
  const abs = Math.abs(d.value);
  if (d.format === "ngn") return `${sign}₦${abs.toLocaleString("en-NG")}`;
  if (d.format === "cad") return `${sign}CAD $${abs.toLocaleString("en-CA")}`;
  return `${sign}${abs}`;
}

function Words({ text, from = 0.3, span = 1.4 }: { text: string; from?: number; span?: number }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span className="word" style={{ ["--delay" as string]: `${from + (i / words.length) * span}s` }}>{w}</span>{" "}
        </Fragment>
      ))}
    </>
  );
}

// --- Inserts: close shots of the thing at stake ------------------------------------------------------------------

function WalletInsert({ deltas }: { deltas: Delta[] }) {
  const money = deltas.filter((d) => d.key === "walletNgn" || d.key === "walletCad");
  const out = money.some((d) => d.value < 0);
  return (
    <div className={`ins ins-wallet ${out ? "out" : "in"}`}>
      <div className="ins-wallet-body">
        {Array.from({ length: 6 }, (_, i) => <i key={i} className="note" style={{ ["--i" as string]: i }} />)}
        <span className="ins-wallet-flap" />
      </div>
      <div className="ins-amount">{money.map((d) => <b key={d.key} className={d.good ? "up" : "down"}>{fmt(d)}</b>)}</div>
    </div>
  );
}

function DocumentsInsert() {
  const { t } = usePlayer();
  const docs = ["Passport", "Transcript", "Bank statement", "Reference letter"];
  return (
    <div className="ins ins-docs">
      {docs.map((d, i) => (
        <div key={d} className="paper" style={{ ["--i" as string]: i }}>
          <b>{t(d)}</b>
          {Array.from({ length: 5 }, (_, j) => <i key={j} style={{ width: `${60 + ((i + j) * 13) % 35}%` }} />)}
        </div>
      ))}
    </div>
  );
}

function ClockInsert({ deltas }: { deltas: Delta[] }) {
  const days = deltas.find((d) => d.key === "timeRemainingDays");
  return (
    <div className="ins ins-clock">
      <div className="clock-face"><i className="hand-h" /><i className="hand-m" />{Array.from({ length: 12 }, (_, i) => <b key={i} style={{ transform: `rotate(${i * 30}deg) translateY(-118px)` }} />)}</div>
      <div className="calendar">{[3, 2, 1].map((n) => <span key={n} style={{ ["--i" as string]: 3 - n }}>{days ? Math.abs(days.value) + n : n}</span>)}</div>
    </div>
  );
}

function PhoneInsert({ messages, title }: { messages: { from: string; text: string }[]; title: string }) {
  return (
    <div className="ins ins-phone">
      <div className="phone">
        <div className="phone-head">{title}</div>
        <div className="phone-body">
          {messages.map((m, i) => (
            <div key={i} className="bubble" style={{ ["--i" as string]: i }}>
              <b>{m.from}</b>{m.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const ADVICE = [
  { from: "Uncle Femi", text: "Why not try Germany instead?" },
  { from: "Pastor", text: "Have you prayed about it?" },
  { from: "Class of 2015", text: "Who has a good agent? Asking for a friend." },
];

function StampInsert({ word, tone }: { word: string; tone: CinematicSpec["tone"] }) {
  const { t } = usePlayer();
  return (
    <div className="ins ins-stamp">
      <div className="paper big">
        <b>{t("Decision")}</b>
        {Array.from({ length: 7 }, (_, j) => <i key={j} style={{ width: `${55 + (j * 17) % 40}%` }} />)}
        <span className={`stamp tone-${tone}`}>{word}</span>
      </div>
    </div>
  );
}

/** A danfo (or a streetcar in Canada) with you in the window. */
function BusSvg({ look, canada }: { look: Look; canada: boolean }) {
  const body = canada ? "#dc2626" : "#facc15";
  return (
    <g transform="translate(0 470)">
      <rect x="-20" y="0" width="520" height="290" rx="34" fill={body} />
      <rect x="10" y="30" width="460" height="120" rx="10" fill="#1f2937" />
      {/* you, seen through the window */}
      <g transform="translate(170 300)"><Actor look={look} pose="idle" face="neutral" x={0} y={0} scale={0.62} /></g>
      <rect x="-20" y="150" width="520" height="140" rx="20" fill={body} />
      <rect x="-20" y="180" width="520" height="16" fill="#111" />
      {[150, 310].map((x) => <rect key={x} x={x} y="30" width="10" height="120" fill={body} />)}
      <g fill="#111"><circle cx="80" cy="290" r="44" /><circle cx="400" cy="290" r="44" /></g>
      <g fill="#6b7280"><circle cx="80" cy="290" r="18" /><circle cx="400" cy="290" r="18" /></g>
    </g>
  );
}

/** A car with you at the wheel. */
function CarSvg({ look }: { look: Look }) {
  return (
    <g transform="translate(560 560)">
      <path d="M0 120 L40 40 Q60 10 110 10 L300 10 Q340 10 370 40 L430 120 Z" fill="#1f2937" />
      <path d="M70 110 L95 45 L190 45 L190 110 Z" fill="#93c5fd" />
      <g transform="translate(140 230)"><Actor look={look} pose="idle" face="neutral" x={0} y={0} scale={0.42} /></g>
      <rect x="-20" y="110" width="480" height="110" rx="26" fill="#334155" />
      <rect x="380" y="140" width="40" height="18" rx="6" fill="#fde68a" />
      <g fill="#111"><circle cx="80" cy="220" r="40" /><circle cx="360" cy="220" r="40" /></g>
    </g>
  );
}

/** A plane coming in to land, drawn side-on. */
function PlaneSvg() {
  return (
    <g>
      <rect x="-240" y="-34" width="480" height="68" rx="34" fill="#f8fafc" />
      <path d="M-40 -10 L80 -150 L130 -150 L60 -10 Z M-40 20 L80 150 L130 150 L60 20 Z" fill="#e2e8f0" />
      <path d="M-220 -20 L-280 -120 L-230 -120 L-170 -20 Z" fill="#dc2626" />
      {[-140, -100, -60, -20, 20, 60, 100, 140].map((x) => <rect key={x} x={x} y="-14" width="22" height="14" rx="4" fill="#1e3a8a" />)}
      <path d="M200 -30 Q250 -20 240 10 L200 10 Z" fill="#1e3a8a" />
      <g fill="#111"><circle cx="-60" cy="44" r="14" /><circle cx="120" cy="44" r="14" /></g>
    </g>
  );
}

/** Split screen: you and them, both on the phone, each in your own place. */
function SplitCall({ ms, you, them, mine, theirs, speaker, line, up, down }: {
  ms: number; you: Look; them: Look; mine: SetKind; theirs: SetKind; speaker: string; line: string; up: boolean; down: boolean;
}) {
  const half = (set: SetKind, look: Look, talking: boolean) => {
    const layers = setLayers(set);
    return (
      <svg className="film-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <g className="film-cam" style={{ ["--c0" as string]: camT({ x: 800, y: 470, z: 1.5 }), ["--c1" as string]: camT({ x: 800, y: 460, z: 1.62 }) }}>
          <g className="film-set">{layers.far}{layers.mid}{layers.near}</g>
          <Actor look={look} pose="phone" face={talking ? "neutral" : up ? "smile" : down ? "worried" : "neutral"} talking={talking} x={800} y={FLOOR} />
        </g>
      </svg>
    );
  };
  return (
    <div className="film-frame shot-split" style={{ ["--ms" as string]: `${ms}ms` }}>
      <div className="split-half left">{half(mine, you, false)}</div>
      <div className="split-half right">{half(theirs, them, true)}</div>
      <p className="film-sub"><b>{speaker}</b><Words text={line} from={0.5} span={1.8} /></p>
      <div className="film-bars" />
      <div className="film-grain" />
    </div>
  );
}

// --- The shot ----------------------------------------------------------------------------------------------------

export interface ShotProps {
  kind: ShotKind;
  ms: number;
  spec: CinematicSpec;
  stage: StageKind;
  location?: string;
  script: FilmScript;
  /** The other person's name on screen (from the set, or "The officer", "Sister Ada"...). */
  speaker: string;
  particles: ReactNode;
  /** Which angle, when the same kind of shot plays more than once. */
  v?: number;
}

export function FilmShot({ kind, ms, spec, stage, location, script, speaker, particles, v = 0 }: ShotProps) {
  const { t, profile } = usePlayer();
  const tone = spec.tone;
  const you = profile?.avatar ? toLook(profile.avatar) : toLook(DEFAULT_AVATAR);
  const them = script.circle === "family" ? toLook(relativeAvatar(familyFor(profile))) : CAST[script.circle];
  const mine = yourSet(stage);
  const theirs = theirSet(script.circle, stage);
  const together = mine === theirs; // they're in the same place as you, so they appear in your shots too
  const up = script.mood === "up";
  const down = script.mood === "down";
  const resultFace: ActorFace = up ? "grin" : down ? (tone === "danger" ? "shock" : "sad") : "neutral";
  const theirFace: ActorFace = up ? "smile" : down ? (script.circle === "hustler" ? "grin" : "angry") : "neutral";
  const resultPose: ActorPose = up ? "cheer" : down ? "slump" : "idle";
  const name = profile?.username ?? t("You");
  const line = spec.line.length > 140 ? `${spec.line.slice(0, 137)}…` : spec.line;
  const money = spec.deltas.find((d) => d.key === "walletNgn" || d.key === "walletCad");
  const amount = money ? fmt(money) : "";
  const m = script.moment;
  const here: SetKind = m?.set ?? mine; // where the moment happens

  let set: SetKind = mine;
  let cam: [Cam, Cam] = [{ x: 800, y: 450, z: 1 }, { x: 800, y: 450, z: 1 }];
  let actors: ReactNode = null;
  let overlay: ReactNode = null;
  let sub: { who?: string; text: string; thought?: boolean } | null = null;
  let slug: string | null = null;
  let title: string | null = null;
  let blurSet = false;

  switch (kind) {
    case "establish":
      cam = [{ x: 900, y: 540, z: 1.25 }, { x: 760, y: 520, z: 1.08 }];
      actors = <>
        <g className="walk-in"><Actor look={you} pose="walk" x={560} y={FLOOR} /></g>
        {together ? <Actor look={them} pose="idle" x={1120} y={FLOOR} scale={0.95} flip /> : null}
      </>;
      title = location ?? null;
      break;
    case "journey":
      // A tracking shot: the camera travels with you across the set.
      cam = [{ x: 420, y: 540, z: 1.45 }, { x: 980, y: 540, z: 1.45 }];
      actors = <g className="walk-across"><Actor look={you} pose="walk" x={420} y={FLOOR} /></g>;
      slug = t("On the way");
      break;
    case "think":
      cam = mediumOn(600, 1, 1.7, 1.9);
      actors = <>
        {together ? <g className="soft"><Actor look={them} pose="idle" x={1050} y={FLOOR} scale={0.95} flip /></g> : null}
        <Actor look={you} pose="listen" face="worried" x={600} y={FLOOR} />
      </>;
      sub = { who: name, text: t(script.think), thought: true };
      break;
    case "insert":
      blurSet = true;
      cam = [{ x: 800, y: 450, z: 1.3 }, { x: 760, y: 450, z: 1.4 }];
      overlay = script.insert === "wallet" ? <WalletInsert deltas={spec.deltas} />
        : script.insert === "documents" ? <DocumentsInsert />
        : script.insert === "clock" ? <ClockInsert deltas={spec.deltas} />
        : <PhoneInsert title={t("Everybody has an opinion")} messages={ADVICE.map((m) => ({ from: m.from, text: t(m.text) }))} />;
      slug = t(script.insertCaption);
      break;
    case "say":
      cam = closeOn(640, 1, 2.5, 2.75);
      actors = <Actor look={you} pose="talk" face="neutral" talking x={640} y={FLOOR} />;
      sub = { who: name, text: `“${line}”` };
      break;
    case "hear":
      // Their side, wide: they're in their own place when your choice reaches them.
      set = theirs;
      cam = [{ x: 860, y: 520, z: 1.12 }, { x: 940, y: 500, z: 1.3 }];
      actors = <>
        <Actor look={them} pose={script.circle === "family" ? "phone" : "listen"} face="worried" talking x={980} y={FLOOR} flip />
        {together ? <g className="soft"><Actor look={you} pose="talk" x={430} y={FLOOR + 260} scale={1.45} /></g> : null}
      </>;
      sub = { who: speaker, text: t(script.hear) };
      slug = `${t("Their side")} · ${speaker}`;
      break;
    case "pov":
      set = theirs;
      cam = mediumOn(980, 1, 1.55, 1.75);
      actors = <>
        <Actor look={them} pose="listen" face="neutral" talking x={980} y={FLOOR} flip />
        {together ? <g className="soft"><Actor look={you} pose="idle" x={430} y={FLOOR + 260} scale={1.45} /></g> : null}
      </>;
      sub = { who: speaker, text: t(script.pov) };
      slug = `${t("Their side")} · ${speaker}`;
      break;
    case "react":
      set = theirs;
      cam = closeOn(980, 1, 2.3, 2.9);
      actors = <Actor look={them} pose={up ? "cheer" : down ? "point" : "listen"} face={theirFace} x={980} y={FLOOR} flip />;
      overlay = <>{particles}{spec.label ? <div className="lower-third"><b>{spec.label.replace(/_/g, " ")}</b></div> : null}</>;
      break;
    case "verdict":
      if (script.verdict === "stamp") {
        blurSet = true;
        set = theirs;
        cam = [{ x: 800, y: 450, z: 1.3 }, { x: 800, y: 450, z: 1.36 }];
        overlay = <StampInsert word={t(script.stamp)} tone={tone} />;
      } else {
        cam = closeOn(640, 1, 2.6, 2.9);
        actors = <Actor look={you} pose={resultPose} face={resultFace} x={640} y={FLOOR} />;
      }
      break;
    case "reply":
      cam = closeOn(640, 1, 2.45, 2.65);
      actors = <Actor look={you} pose="talk" face={up ? "smile" : down ? "sad" : "neutral"} talking x={640} y={FLOOR} />;
      sub = { who: name, text: t(script.reply) };
      break;
    case "consequence":
      cam = [{ x: 700, y: 500, z: 1.6 }, { x: 800, y: 520, z: 1.08 }];
      actors = <>
        <Actor look={you} pose={resultPose} face={resultFace} x={620} y={FLOOR} />
        {together ? <Actor look={them} pose={up ? "idle" : "listen"} face={theirFace} x={1100} y={FLOOR} scale={0.95} flip /> : null}
      </>;
      overlay = (
        <div className="stat-thirds">
          {spec.deltas.slice(0, 4).map((d, i) => (
            <span key={d.key} className={d.good ? "up" : "down"} style={{ ["--i" as string]: i }}>{fmt(d)} <small>{d.label}</small></span>
          ))}
        </div>
      );
      if (spec.feedback) sub = { text: spec.feedback };
      break;
    case "ripple":
      if (script.ripple.kind === "chat") {
        blurSet = true;
        set = "living-room";
        cam = [{ x: 800, y: 450, z: 1.25 }, { x: 840, y: 450, z: 1.35 }];
        overlay = <PhoneInsert title={t("The family group chat")} messages={script.ripple.messages.map((m) => ({ from: t(m.from), text: t(m.text) }))} />;
        slug = t("Meanwhile");
      } else {
        set = "bedroom";
        cam = mediumOn(800, 1, 1.5, 1.62);
        actors = <Actor look={ROOMMATE} pose="phone" face={up ? "grin" : down ? "sad" : "neutral"} x={800} y={FLOOR} />;
        sub = { text: t(script.ripple.line) };
        slug = t("Meanwhile");
      }
      break;
    case "night":
      set = "bedroom";
      cam = mediumOn(820, 1, 1.35, 1.55);
      actors = <Actor look={you} pose="phone" face={up ? "smile" : down ? "sad" : "neutral"} x={820} y={FLOOR} />;
      sub = { text: t(script.night) };
      slug = t("Later that night");
      break;
    // --- Big moments (game/moments.ts) ---
    case "handover": {
      // Across the counter: the officer slides the letter over (or you hand the agent your cash).
      const mo = script.moment!;
      set = here;
      cam = [{ x: 800, y: 520, z: 1.4 }, { x: 800, y: 500, z: 1.6 }];
      const giver = CAST[mo.giver ?? "official"];
      const toThem = !!mo.toThem;
      actors = <>
        <Actor look={giver} pose="reach" face={toThem ? "grin" : "smile"} x={1100} y={FLOOR} flip />
        <Actor look={you} pose="reach" face={toThem ? "worried" : "smile"} x={500} y={FLOOR} />
        <g className={`pass-prop ${toThem ? "to-them" : "to-you"}`}><PropSvg kind={mo.prop} /></g>
      </>;
      slug = t(mo.caption);
      break;
    }
    case "item":
      blurSet = true;
      set = here;
      cam = [{ x: 800, y: 450, z: 1.3 }, { x: 800, y: 450, z: 1.38 }];
      overlay = <ItemInsert moment={script.moment!} mood={script.mood} choice={line} amount={amount} />;
      break;
    case "look": {
      // You, reading it; halfway through, your face changes.
      const m = script.moment!;
      set = here;
      cam = [{ x: 640, y: FLOOR - 250, z: 1.65 }, { x: 640, y: FLOOR - 262, z: 1.8 }];
      const after: ActorFace = up ? "grin" : down ? (tone === "danger" ? "shock" : "sad") : "worried";
      actors = <>
        <g className="phase-a"><Actor look={you} pose="hold" face="reading" x={640} y={FLOOR} prop={<PropSvg kind={m.prop} />} /></g>
        <g className="phase-b"><Actor look={you} pose={down ? "slump" : "hold"} face={after} x={640} y={FLOOR} prop={down ? undefined : <PropSvg kind={m.prop} />} /></g>
      </>;
      sub = { who: name, text: t(m.look) };
      break;
    }
    case "showoff": {
      const m = script.moment!;
      set = m.style === "handover" || m.style === "landing" ? mine : here;
      cam = mediumOn(640, 1, 1.35, 1.5);
      actors = <Actor look={you} pose="raise" face="grin" x={640} y={FLOOR} prop={<PropSvg kind={m.prop} />} />;
      overlay = <div className="camera-flash" />;
      sub = { text: t(m.showoff ?? "") };
      break;
    }
    case "screen":
      blurSet = true;
      set = here;
      cam = [{ x: 800, y: 450, z: 1.25 }, { x: 800, y: 450, z: 1.35 }];
      overlay = <ScreenInsert moment={script.moment!} mood={script.mood} choice={line} amount={amount} />;
      slug = t(script.moment!.caption);
      break;
    case "plane":
      set = "airport";
      cam = [{ x: 800, y: 380, z: 1.15 }, { x: 860, y: 420, z: 1.25 }];
      actors = <g className="landing-plane"><PlaneSvg /></g>;
      slug = t(script.moment!.caption);
      sub = { text: t("Wheels down.") };
      break;
    case "dial":
      blurSet = true;
      cam = [{ x: 800, y: 450, z: 1.25 }, { x: 800, y: 450, z: 1.3 }];
      overlay = <DialInsert name={speaker} />;
      break;
    case "desk": {
      // At it: you with the notebook, the laptop or the papers, and the clock racing in the corner.
      const mo = script.moment!;
      set = here;
      cam = [{ x: 640, y: FLOOR - 270, z: 1.5 }, { x: 640, y: FLOOR - 280, z: 1.7 }];
      actors = <Actor look={you} pose="hold" face="reading" x={640} y={FLOOR} prop={<PropSvg kind={mo.prop} />} />;
      overlay = <div className="mini-clock"><i /><i /></div>;
      slug = t(mo.caption);
      break;
    }
    case "listen":
      // Their side: they listen and write on their notepad.
      set = theirs;
      cam = mediumOn(980, 1, 1.5, 1.7);
      actors = <>
        <Actor look={them} pose="hold" face="reading" x={980} y={FLOOR} flip prop={<PropSvg kind="notepad" />} />
        {together ? <g className="soft"><Actor look={you} pose="talk" talking x={430} y={FLOOR + 260} scale={1.45} /></g> : null}
      </>;
      slug = `${t("Their side")} · ${speaker}`;
      break;
    case "notes":
      blurSet = true;
      set = theirs;
      cam = [{ x: 800, y: 450, z: 1.3 }, { x: 800, y: 450, z: 1.36 }];
      overlay = <NotesInsert who={speaker} note={t(NOTES[script.circle]?.[script.mood] ?? "")} />;
      break;
    case "work": {
      set = here;
      const driving = here === "toronto-street";
      if (driving) {
        cam = v === 1 ? closeOn(800, 0.8, 2.2, 2.4) : [{ x: 700, y: 560, z: 1.3 }, { x: 900, y: 560, z: 1.3 }];
        actors = <g className={v === 1 ? "" : "drive-across"}><CarSvg look={you} /></g>;
      } else {
        // Three angles of one shift: wide, close on the box, close on your face.
        cam = v === 0 ? [{ x: 700, y: 520, z: 1.2 }, { x: 760, y: 520, z: 1.3 }] : v === 1 ? [{ x: 640, y: FLOOR - 220, z: 2.2 }, { x: 640, y: FLOOR - 230, z: 2.4 }] : closeOn(640, 1, 2.3, 2.5);
        actors = <g className={v === 0 ? "walk-across short" : ""}><Actor look={you} pose="hold" face={v === 2 ? "worried" : "neutral"}
          x={v === 0 ? 420 : 640} y={FLOOR} prop={<PropSvg kind={here === "cafe" ? "receipt" : "box"} />} /></g>;
      }
      if (v === 2) overlay = <div className="sweat"><i /><i /></div>;
      slug = v === 0 ? t(script.moment!.caption) : null;
      break;
    }
    case "clock":
    case "calendar":
      blurSet = true;
      cam = [{ x: 800, y: 450, z: 1.25 }, { x: 800, y: 450, z: 1.3 }];
      overlay = <ClockInsert deltas={spec.deltas} />;
      slug = kind === "calendar" ? t("Days pass") : null;
      break;
    case "ride": {
      // In the danfo (or keke, or the streetcar in Canada), crossing town with your face in the window.
      set = mine;
      cam = [{ x: 500, y: 560, z: 1.25 }, { x: 1100, y: 560, z: 1.25 }];
      actors = <g className="ride-across"><BusSvg look={you} canada={mine === "toronto-street"} /></g>;
      slug = t(script.moment!.caption);
      break;
    }
    case "arrive":
      set = mine;
      cam = [{ x: 700, y: 540, z: 1.35 }, { x: 760, y: 530, z: 1.45 }];
      actors = <g className="walk-in"><Actor look={you} pose="walk" x={640} y={FLOOR} /></g>;
      slug = location ?? null;
      break;
    case "sleep":
      set = "bedroom";
      cam = [{ x: 560, y: 560, z: 1.45 }, { x: 540, y: 560, z: 1.55 }];
      actors = <>
        {/* Lying down: rotated so your head is on the pillow, at the left end of the bed. */}
        <g transform="translate(560 545) rotate(-90)"><Actor look={you} pose="idle" face="sleep" x={0} y={0} scale={0.9} /></g>
        <text className="zzz" x="200" y="420" fontSize="64" fontWeight="900" fill="#e0e7ff">Z z z</text>
      </>;
      break;
    case "board":
      blurSet = true;
      set = here;
      cam = [{ x: 800, y: 450, z: 1.25 }, { x: 800, y: 450, z: 1.32 }];
      overlay = <BoardInsert choice={line} caption={t(script.moment!.title)} />;
      slug = t(script.moment!.caption);
      break;
    case "crowd": {
      set = here;
      cam = [{ x: 820, y: 520, z: 1.12 }, { x: 760, y: 520, z: 1.3 }];
      const guests: Look[] = [CAST.family, CAST.friend, CAST.stranger, CAST.faith, { ...CAST.friend, outfitColor: "#db2777", hair: "braids" }];
      actors = <>
        {guests.map((g, i) => <Actor key={i} look={g} pose={up || i % 2 ? "cheer" : "idle"} face={down ? "neutral" : "grin"} x={180 + i * 300} y={FLOOR - (i % 2) * 20} scale={0.85} flip={i > 2} />)}
        <Actor look={you} pose={down ? "idle" : "cheer"} face={down ? "sad" : "grin"} x={800} y={FLOOR + 30} />
      </>;
      overlay = up ? particles : null;
      slug = t(script.moment!.caption);
      break;
    }
    case "split":
      return <SplitCall ms={ms} you={you} them={them} mine={mine} theirs={theirs} speaker={speaker} line={t(script.hear)} up={up} down={down} />;
    case "close":
      cam = closeOn(640, 1, 2.2, 2.45);
      actors = <Actor look={you} pose={resultPose} face={resultFace} x={640} y={FLOOR} />;
      sub = { text: t(script.close) };
      break;
  }

  const layers = setLayers(set);
  const pan = cam[1].x - cam[0].x;
  return (
    <div className={`film-frame shot-${kind} tone-${tone}`} style={{ ["--ms" as string]: `${ms}ms` }}>
      <svg className="film-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <g className="film-cam" style={{ ["--c0" as string]: camT(cam[0]), ["--c1" as string]: camT(cam[1]) }}>
          <g className={blurSet ? "film-set blurred" : "film-set"}>
            <g className="px-far" style={{ ["--p" as string]: `${pan * 0.35}px` }}>{layers.far}</g>
            <g className="px-mid">{layers.mid}</g>
            {layers.near ? <g className="px-near" style={{ ["--p" as string]: `${-pan * 0.25}px` }}>{layers.near}</g> : null}
          </g>
          {actors}
        </g>
      </svg>
      <div className="film-flash" />
      {overlay}
      {title ? <div className="film-title">{title}</div> : null}
      {slug ? <div className="film-slug">{slug}</div> : null}
      {sub ? (
        <p className={`film-sub ${sub.thought ? "thought" : ""}`}>
          {sub.who ? <b>{sub.who}</b> : null}
          <Words text={sub.text} from={0.35} span={Math.min(1.8, ms / 1000 / 2.4)} />
        </p>
      ) : null}
      <div className="film-bars" />
      <div className="film-grain" />
      {kind === "close" ? <div className="film-fadeout" /> : null}
    </div>
  );
}
