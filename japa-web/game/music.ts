// Original "Naija-style" music as data: Afrobeat, amapiano, highlife and tension grooves, played by the Web Audio
// synth in app/audio/engine.ts. Pure: no audio here, so the mood rules and patterns are unit-tested.
import type { GameState, ScenarioDatabase } from "./types";

export type Mood = "lagos" | "hustle" | "tension" | "canada" | "pitch" | "triumph" | "somber";
export type Sfx =
  | "click" | "good" | "bad" | "danger" | "coin" | "cashOut" | "stamp" | "levelUp" | "win" | "fail"
  | "trap" | "phone" | "horn" | "okada" | "plane" | "wind";

type Step<T> = (T | null)[];

export interface Groove {
  bpm: number;
  /** Delay on off-beat 16ths, as a share of a 16th (Afrobeat sits a little behind). */
  swing: number;
  /** Chords for each bar, as semitones from A (220 Hz). The groove loops over them. */
  chords: number[][];
  kick: number[];
  clap: number[];
  shaker: number[];
  /** Talking drum: index into the A minor pentatonic, with a pitch glide down on every hit. */
  talk: Step<number>;
  /** Bass, as semitones above each bar's chord root. */
  bass: Step<number>;
  /** Plucked highlife guitar or bells: index into the bar's chord tones (an octave up). */
  arp: Step<number>;
  arpVoice: "guitar" | "bell";
  /** Amapiano log drum, semitones above the chord root. */
  log?: Step<number>;
  /** Piano/keys chord stabs. */
  keys?: number[];
  /** Horn stabs, and which bars of the loop they play in (bar index modulo chords.length). */
  horns?: number[];
  hornBars?: number[];
  /** Sustained pad chords. */
  pad?: boolean;
}

const _ = null;

export const PENTATONIC = [0, 3, 5, 7, 10, 12];

export const GROOVES: Record<Mood, Groove> = {
  // Lagos street Afrobeat: off-beat kick, clap on 2 and 4, shekere 16ths, talking drum, highlife guitar, horn stabs.
  lagos: {
    bpm: 108, swing: 0.12,
    chords: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-2, 2, 5]],
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    shaker: [0.9, 0.3, 0.6, 0.3, 0.9, 0.3, 0.6, 0.3, 0.9, 0.3, 0.6, 0.3, 0.9, 0.3, 0.6, 0.5],
    talk: [_, _, 2, _, _, _, _, 0, _, _, 3, _, _, 1, _, _],
    bass: [0, _, _, 0, _, _, 7, _, 0, _, _, 10, _, 7, _, _],
    arp: [0, _, 1, 2, _, 1, 0, _, 2, _, 1, _, 0, 2, _, 1],
    arpVoice: "guitar",
    horns: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    hornBars: [3],
  },
  // Amapiano hustle: four-on-the-floor, the log drum, off-beat piano chords.
  hustle: {
    bpm: 113, swing: 0.08,
    chords: [[5, 8, 12, 15], [0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 9]],
    kick: [0.8, 0, 0, 0, 0.8, 0, 0, 0, 0.8, 0, 0, 0, 0.8, 0, 0, 0],
    clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    shaker: [0.2, 0.5, 0.8, 0.5, 0.2, 0.5, 0.8, 0.5, 0.2, 0.5, 0.8, 0.5, 0.2, 0.5, 0.8, 0.6],
    talk: [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 4],
    bass: [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    arp: [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    arpVoice: "bell",
    log: [0, _, _, 0, _, _, 0, _, _, 0, _, _, 5, _, 3, _],
    keys: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
  },
  // Embassy queues, border secondary, the hearing room: heartbeat kick, low drone, sparse talking drum.
  tension: {
    bpm: 84, swing: 0,
    chords: [[0, 3, 7], [0, 3, 7], [1, 4, 8], [0, 3, 7]],
    kick: [1, 0, 0, 0.7, 0, 0, 0, 0, 1, 0, 0, 0.7, 0, 0, 0, 0],
    clap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    shaker: [0, 0, 0.2, 0, 0, 0, 0.2, 0, 0, 0, 0.2, 0, 0, 0, 0.3, 0],
    talk: [_, _, _, _, _, _, 0, _, _, _, _, _, _, _, 1, _],
    bass: [0, _, _, _, _, _, _, _, 0, _, _, _, _, _, _, _],
    arp: [_, _, _, _, _, _, _, _, _, _, _, _, 2, _, _, _],
    arpVoice: "bell",
    pad: true,
  },
  // Canada: colder highlife with bells and a pad, still with a shekere.
  canada: {
    bpm: 96, swing: 0.06,
    chords: [[3, 7, 10], [-2, 2, 5], [0, 3, 7], [-4, 0, 3]],
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0],
    clap: [0, 0, 0, 0, 0.6, 0, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0],
    shaker: [0.4, 0.2, 0.4, 0.2, 0.4, 0.2, 0.4, 0.2, 0.4, 0.2, 0.4, 0.2, 0.4, 0.2, 0.4, 0.3],
    talk: [_, _, _, _, _, _, _, _, _, _, _, _, _, _, 2, _],
    bass: [0, _, _, _, _, _, 7, _, 0, _, _, _, _, _, _, _],
    arp: [0, _, 1, _, 2, _, 1, _, 0, _, 2, _, 1, _, _, _],
    arpVoice: "bell",
    pad: true,
  },
  // The Zoom pitch: light Afro-house.
  pitch: {
    bpm: 100, swing: 0.05,
    chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    clap: [0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 0],
    shaker: [0, 0, 0.7, 0, 0, 0, 0.7, 0, 0, 0, 0.7, 0, 0, 0, 0.7, 0],
    talk: [_, _, _, _, _, _, _, _, _, _, _, 2, _, _, _, _],
    bass: [0, _, _, 0, _, _, _, _, 0, _, _, 7, _, _, _, _],
    arp: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1],
    arpVoice: "guitar",
  },
  // A win: the Lagos groove, faster, horns every bar.
  triumph: {
    bpm: 120, swing: 0.1,
    chords: [[3, 7, 10], [-2, 2, 5], [0, 3, 7], [-4, 0, 3]],
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0],
    clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1],
    shaker: [0.9, 0.4, 0.7, 0.4, 0.9, 0.4, 0.7, 0.4, 0.9, 0.4, 0.7, 0.4, 0.9, 0.4, 0.7, 0.6],
    talk: [_, _, 4, _, _, 3, _, 2, _, _, 4, _, 3, 2, 1, 0],
    bass: [0, _, 0, _, _, _, 7, _, 0, _, _, 10, _, 7, _, 5],
    arp: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 2, 1, 0, 1],
    arpVoice: "guitar",
    horns: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    hornBars: [0, 1, 2, 3],
  },
  // A loss: slow pad, a lone talking drum asking "wahala?"
  somber: {
    bpm: 70, swing: 0,
    chords: [[0, 3, 7], [-4, 0, 3], [-7, -3, 0], [-5, -1, 2]],
    kick: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    clap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    shaker: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    talk: [_, _, _, _, _, _, _, _, 1, _, _, 0, _, _, _, _],
    bass: [0, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    arp: [_, _, _, _, 2, _, _, _, _, _, _, _, 1, _, _, _],
    arpVoice: "bell",
    pad: true,
  },
};

/** Stages where the music turns tense: queues, officers, hearings. */
const TENSE_STAGES = new Set([
  "embassy", "annex", "agent", "irb-hearing", "cbsa-secondary", "ircc-portal", "ielts-centre", "boardroom",
]);
/** Nigeria-side stages in the Canada kit. */
const NAIJA_KIT = new Set(["bank-hall", "university-registry", "french-class"]);
const LAGOS_STAGES = new Set([
  "yaba-dawn", "yaba-street", "cafe", "call-sister", "room-night", "whatsapp", "gig", "video-job", "outside",
  "phone-text", "airport", "stay",
]);

/** Which groove fits where the player is right now. */
export function moodFor(db: ScenarioDatabase, state: GameState): Mood {
  if (state.outcome) return state.outcome.result === "fail" ? "somber" : "triumph";
  const scene = db.scenes[state.currentSceneId];
  if (!scene) return "lagos";
  if (scene.layoutType === "DASHBOARD") return "hustle";
  if (scene.layoutType === "ZOOM_GRID") return "pitch";
  if (scene.layoutType === "CORPORATE_OFFICE") return "tension";
  const stage = scene.stage ?? "";
  if (TENSE_STAGES.has(stage)) return "tension";
  if (LAGOS_STAGES.has(stage) || NAIJA_KIT.has(stage) || state.activeRoute === "NIGERIA_LIFE") return "lagos";
  if (state.activeRoute === "FIRST_YEAR") return "hustle";
  return "canada";
}

/** The note for a semitone offset from A3 (220 Hz). */
export const hz = (semitones: number, base = 220) => base * Math.pow(2, semitones / 12);
