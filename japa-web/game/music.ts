// Original "Naija-style" music as data: Afrobeat, amapiano, highlife and tension grooves, played by the Web Audio
// synth in app/audio/engine.ts. Pure: no audio here, so the mood rules and patterns are unit-tested.
import type { GameState, ScenarioDatabase } from "./types";

export type Mood = "lagos" | "hustle" | "tension" | "canada" | "pitch" | "triumph" | "somber";
export type Sfx =
  | "click" | "good" | "bad" | "danger" | "coin" | "cashOut" | "stamp" | "levelUp" | "win" | "fail"
  | "trap" | "phone" | "horn" | "okada" | "plane" | "wind" | "jump" | "hurt" | "clear";

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
  /** Cinematic strings: slow-swelling chords an octave up, with vibrato (Nollywood drama). */
  strings?: boolean;
  /** Low "boom" impacts, like a timpani or a dramatic film hit. */
  boom?: number[];
  /** A rising noise sweep into the next phrase, every this many bars. */
  riserEvery?: number;
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

// --- Soundtrack styles: the player picks the vibe; each style can restyle any mood ---------------------

export type Style = "afrobeat" | "amapiano" | "highlife" | "fuji" | "nollywood";

const R16 = (...hits: number[]) => Array.from({ length: 16 }, (_, i) => (hits.includes(i) ? 1 : 0));
const N16 = <T,>(entries: Record<number, T>): Step<T> => Array.from({ length: 16 }, (_, i) => (i in entries ? entries[i] : null));
const SILENT = Array<number>(16).fill(0);
const NONE = <T,>(): Step<T> => Array<T | null>(16).fill(null);
const SHEKERE = [0.9, 0.3, 0.6, 0.3, 0.9, 0.3, 0.6, 0.3, 0.9, 0.3, 0.6, 0.3, 0.9, 0.3, 0.6, 0.5];

/** Amapiano everywhere: log drums, off-beat keys and shakers, slowed down for tension and loss. */
const AMAPIANO: Partial<Record<Mood, Groove>> = {
  lagos: { ...GROOVES.hustle, bpm: 112, talk: N16({ 7: 2, 15: 4 }), log: N16({ 0: 0, 3: 0, 6: 7, 9: 0, 12: 5, 14: 3 }) },
  hustle: GROOVES.hustle,
  tension: {
    ...GROOVES.hustle, bpm: 92, swing: 0.04, chords: [[0, 3, 7, 10], [0, 3, 7, 10], [1, 4, 8, 11], [0, 3, 7, 10]],
    kick: R16(0, 8), clap: SILENT, keys: R16(6, 14), log: N16({ 0: 0, 10: 0 }), pad: true,
  },
  canada: { ...GROOVES.hustle, bpm: 108, chords: [[3, 7, 10, 14], [-2, 2, 5, 9], [0, 3, 7, 10], [-4, 0, 3, 7]], pad: true },
  pitch: { ...GROOVES.hustle, bpm: 115 },
  triumph: { ...GROOVES.hustle, bpm: 118, horns: R16(0, 3, 6, 10), hornBars: [0, 1, 2, 3], log: N16({ 0: 0, 3: 0, 6: 0, 8: 7, 10: 5, 12: 3, 14: 0 }) },
  somber: { ...GROOVES.hustle, bpm: 84, kick: SILENT, clap: SILENT, shaker: SILENT, keys: R16(0, 8), log: N16({ 0: 0 }), pad: true },
};

/** Palmwine highlife: bright guitars, light percussion, everything swings. */
const HIGHLIFE: Partial<Record<Mood, Groove>> = {
  lagos: {
    bpm: 118, swing: 0.16, chords: [[3, 7, 10], [-2, 2, 5], [-4, 0, 3], [-2, 2, 5]],
    kick: R16(0, 7, 10), clap: R16(4, 12), shaker: SHEKERE, talk: N16({ 14: 2 }),
    bass: N16({ 0: 0, 3: 7, 6: 0, 8: 0, 11: 7, 14: 5 }), arp: N16({ 0: 2, 1: 1, 2: 0, 4: 1, 5: 2, 6: 1, 8: 0, 9: 1, 10: 2, 12: 1, 13: 0, 14: 1 }),
    arpVoice: "guitar",
  },
  canada: {
    bpm: 104, swing: 0.12, chords: [[3, 7, 10], [0, 3, 7], [-2, 2, 5], [-4, 0, 3]],
    kick: R16(0, 10), clap: R16(12), shaker: SHEKERE.map((v) => v * 0.5), talk: NONE(),
    bass: N16({ 0: 0, 6: 7, 8: 0 }), arp: N16({ 0: 0, 2: 1, 4: 2, 6: 1, 8: 0, 10: 2, 12: 1, 14: 2 }), arpVoice: "guitar", pad: true,
  },
  triumph: {
    bpm: 126, swing: 0.14, chords: [[3, 7, 10], [-2, 2, 5], [0, 3, 7], [-4, 0, 3]],
    kick: R16(0, 6, 8, 10), clap: R16(4, 12, 14), shaker: SHEKERE, talk: N16({ 2: 4, 7: 3, 13: 2 }),
    bass: N16({ 0: 0, 2: 0, 6: 7, 8: 0, 11: 10, 13: 7 }), arp: N16({ 0: 0, 1: 1, 2: 2, 3: 1, 4: 0, 5: 1, 6: 2, 8: 2, 9: 1, 10: 0, 12: 1, 14: 2 }),
    arpVoice: "guitar", horns: R16(0, 3, 6), hornBars: [1, 3],
  },
};

/** Fuji and apala energy: talking drums lead, shakers drive, the bass just grounds it. */
const FUJI: Partial<Record<Mood, Groove>> = {
  lagos: {
    bpm: 122, swing: 0.1, chords: [[0, 3, 7], [0, 3, 7], [-2, 2, 5], [0, 3, 7]],
    kick: R16(0, 3, 8, 11), clap: R16(6, 14), shaker: SHEKERE.map((v) => Math.min(1, v + 0.1)),
    talk: N16({ 0: 4, 2: 3, 3: 2, 6: 0, 8: 4, 9: 3, 11: 1, 12: 2, 14: 0, 15: 1 }),
    bass: N16({ 0: 0, 8: 0, 11: 7 }), arp: NONE(), arpVoice: "bell", boom: R16(0),
  },
  hustle: {
    bpm: 126, swing: 0.08, chords: [[0, 3, 7], [-2, 2, 5], [0, 3, 7], [3, 7, 10]],
    kick: R16(0, 4, 8, 12), clap: R16(4, 12), shaker: SHEKERE, talk: N16({ 1: 3, 2: 2, 5: 4, 7: 0, 9: 3, 10: 2, 13: 4, 15: 1 }),
    bass: N16({ 0: 0, 6: 0, 8: 7, 14: 5 }), arp: NONE(), arpVoice: "bell",
  },
  tension: {
    bpm: 88, swing: 0, chords: [[0, 3, 7], [0, 3, 7], [1, 4, 8], [0, 3, 7]],
    kick: R16(0, 3, 8), clap: SILENT, shaker: SILENT, talk: N16({ 4: 1, 6: 0, 12: 2, 13: 1, 14: 0 }),
    bass: N16({ 0: 0 }), arp: NONE(), arpVoice: "bell", pad: true, boom: R16(0, 8),
  },
  triumph: {
    bpm: 132, swing: 0.1, chords: [[3, 7, 10], [0, 3, 7], [-2, 2, 5], [0, 3, 7]],
    kick: R16(0, 3, 6, 8, 11, 14), clap: R16(4, 12, 15), shaker: SHEKERE,
    talk: N16({ 0: 5, 1: 4, 2: 3, 4: 4, 6: 2, 8: 5, 9: 4, 10: 3, 12: 2, 13: 1, 14: 0 }),
    bass: N16({ 0: 0, 8: 0, 11: 7 }), arp: NONE(), arpVoice: "bell", horns: R16(0, 6), hornBars: [0, 2],
  },
};

/** Nollywood drama: big strings, film hits and risers. Every scene feels like the climax of a home video. */
const NOLLYWOOD: Partial<Record<Mood, Groove>> = {
  lagos: {
    bpm: 92, swing: 0.04, chords: [[0, 3, 7], [-4, 0, 3], [-7, -3, 0], [-5, -1, 2]],
    kick: R16(0, 10), clap: R16(12), shaker: SILENT, talk: N16({ 7: 2, 14: 0 }),
    bass: N16({ 0: 0, 8: 0 }), arp: N16({ 4: 2, 12: 1 }), arpVoice: "bell", strings: true, boom: R16(0), riserEvery: 4,
  },
  hustle: {
    bpm: 104, swing: 0.06, chords: [[0, 3, 7], [3, 7, 10], [-2, 2, 5], [-4, 0, 3]],
    kick: R16(0, 6, 8), clap: R16(4, 12), shaker: SHEKERE.map((v) => v * 0.5), talk: N16({ 15: 2 }),
    bass: N16({ 0: 0, 6: 0, 8: 7 }), arp: NONE(), arpVoice: "bell", strings: true, horns: R16(0), hornBars: [3], riserEvery: 4,
  },
  tension: {
    bpm: 76, swing: 0, chords: [[0, 3, 7], [1, 4, 8], [0, 3, 7], [-1, 2, 6]],
    kick: R16(0, 3), clap: SILENT, shaker: SILENT, talk: N16({ 14: 0 }),
    bass: N16({ 0: 0 }), arp: N16({ 8: 2 }), arpVoice: "bell", strings: true, pad: true, boom: R16(0, 8), riserEvery: 2,
  },
  canada: {
    bpm: 84, swing: 0, chords: [[3, 7, 10], [-2, 2, 5], [0, 3, 7], [-4, 0, 3]],
    kick: R16(0), clap: SILENT, shaker: SILENT, talk: NONE(),
    bass: N16({ 0: 0, 8: 0 }), arp: N16({ 0: 0, 4: 1, 8: 2, 12: 1 }), arpVoice: "bell", strings: true,
  },
  pitch: {
    bpm: 96, swing: 0, chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],
    kick: R16(0, 8), clap: R16(12), shaker: SILENT, talk: NONE(),
    bass: N16({ 0: 0, 8: 0 }), arp: N16({ 0: 0, 2: 1, 4: 2, 6: 1, 8: 0, 10: 1, 12: 2, 14: 1 }), arpVoice: "bell", strings: true, riserEvery: 4,
  },
  triumph: {
    bpm: 110, swing: 0.05, chords: [[3, 7, 10], [-2, 2, 5], [0, 3, 7], [-4, 0, 3]],
    kick: R16(0, 8, 10), clap: R16(4, 12), shaker: SHEKERE, talk: N16({ 12: 4, 13: 3, 14: 2, 15: 1 }),
    bass: N16({ 0: 0, 8: 0, 11: 7 }), arp: N16({ 0: 2, 4: 1, 8: 2, 12: 0 }), arpVoice: "bell",
    strings: true, horns: R16(0, 3, 6), hornBars: [0, 1, 2, 3], boom: R16(0),
  },
  somber: {
    bpm: 64, swing: 0, chords: [[0, 3, 7], [-4, 0, 3], [-7, -3, 0], [-5, -1, 2]],
    kick: SILENT, clap: SILENT, shaker: SILENT, talk: N16({ 8: 1 }),
    bass: N16({ 0: 0 }), arp: N16({ 6: 2, 14: 1 }), arpVoice: "bell", strings: true, boom: R16(0),
  },
};

export const STYLES: Record<Style, { label: string; blurb: string; grooves: Partial<Record<Mood, Groove>> }> = {
  afrobeat: { label: "Afrobeats", blurb: "Lagos street groove, talking drum, highlife guitar and horns", grooves: GROOVES },
  amapiano: { label: "Amapiano Vibes", blurb: "Log drums and off-beat keys, from Lagos to Brampton", grooves: AMAPIANO },
  highlife: { label: "Highlife Gold", blurb: "Palmwine guitars that swing; Osadebe would nod", grooves: HIGHLIFE },
  fuji: { label: "Fuji Drums", blurb: "Talking drums lead, shekere drives, no dulling", grooves: FUJI },
  nollywood: { label: "Nollywood Drama", blurb: "Big strings, film hits and risers. Every choice is a climax", grooves: NOLLYWOOD },
};

export const STYLE_IDS = Object.keys(STYLES) as Style[];

/** The groove for a mood in the chosen style; moods a style doesn't restyle keep the Afrobeats groove. */
export const grooveFor = (style: Style, mood: Mood): Groove => STYLES[style]?.grooves[mood] ?? GROOVES[mood];
