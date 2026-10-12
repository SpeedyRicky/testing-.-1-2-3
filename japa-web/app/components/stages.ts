// Stage specs for the 2D scenes outside Lagos Life's hand-built LagosStage.
// Each spec is plain data; Stage2D draws it. `mood` swaps poses for talk/win/fail moments.
import type { Accessory, PersonPose, PersonWho } from "./Person";
import type { KitStageKind } from "@/game/types";

export type Mood = "calm" | "talk" | "win" | "fail";

export interface StagePerson {
  who: PersonWho;
  x: number;
  pose?: PersonPose;
  caption?: string;
  scale?: number;
  flip?: boolean;
  delay?: string;
  shirt?: string;
  wear?: Accessory[];
  /** Pose overrides by mood. */
  moods?: Partial<Record<Mood, PersonPose>>;
}

export interface StageProp {
  kind:
    | "banner" | "screen" | "counter" | "menu-board" | "shelf" | "couch" | "boxes" | "table" | "desk2" | "laptop2"
    | "booth" | "podium" | "flag-ca" | "flag-ng" | "belt" | "suitcase" | "board" | "queue-rope" | "window";
  x: number;
  w?: number;
  label?: string;
  tone?: "blue" | "gold" | "green";
  color?: string;
  window?: "snow" | "night" | "city";
}

export interface StageSpec {
  sky?: "snow" | "dayca" | "nightca" | "lagos-day" | "lagos-dusk" | "lagos-night";
  skyline?: "toronto" | "lagos";
  wall?: string;
  panel?: boolean;
  ground: "snow" | "slush" | "floor" | "carpet" | "tiles" | "concrete" | "grass" | "road";
  snow?: boolean;
  streetcar?: boolean;
  props?: StageProp[];
  people: StagePerson[];
}

const SCARF: Accessory[] = ["scarf"];

export const STAGES = {
  // --- Lagos side (Express Entry and Student prep) ---
  "ielts-centre": {
    wall: "#e2e8f0", panel: true, ground: "tiles",
    props: [{ kind: "banner", x: 50, label: "IELTS Test Centre · Lagos", tone: "blue" },
      { kind: "desk2", x: 30, w: 90 }, { kind: "desk2", x: 66, w: 90 }],
    people: [{ who: "clerk", x: 14, pose: "idle", caption: "Invigilator" },
      { who: "you", x: 34, pose: "sit", caption: "You", moods: { win: "cheer", fail: "slump" } },
      { who: "npc", x: 58, pose: "sit" }, { who: "student", x: 76, pose: "sit" }],
  },
  "bank-hall": {
    wall: "#f1f5f9", panel: true, ground: "tiles",
    props: [{ kind: "banner", x: 50, label: "Bank · Statements & Reference Letters", tone: "green" },
      { kind: "counter", x: 30, w: 160 }, { kind: "queue-rope", x: 70, w: 120 }],
    people: [{ who: "clerk", x: 26, pose: "talk", caption: "Teller" },
      { who: "you", x: 52, pose: "queue", caption: "You", moods: { win: "cheer", fail: "slump" } },
      { who: "npc", x: 68, pose: "queue" }, { who: "agent", x: 82, pose: "phone" }],
  },
  "university-registry": {
    sky: "lagos-day", skyline: "lagos", ground: "road",
    props: [{ kind: "banner", x: 24, label: "Exams & Records", tone: "gold" }, { kind: "board", x: 74, w: 100, label: "Transcripts: 6-8 weeks" }],
    people: [{ who: "clerk", x: 14, pose: "talk", caption: "Registry officer" },
      { who: "you", x: 36, pose: "queue", caption: "You", moods: { fail: "slump" } },
      { who: "npc", x: 50, pose: "queue" }, { who: "student", x: 62, pose: "queue" }, { who: "npc", x: 86, pose: "walk", flip: true }],
  },
  "french-class": {
    wall: "#fef3c7", panel: true, ground: "floor",
    props: [{ kind: "board", x: 32, w: 150, label: "Bonjour! NCLC 7 = TEF Canada" }, { kind: "flag-ca", x: 82 }],
    people: [{ who: "tutor", x: 16, pose: "talk", caption: "Madame Leclerc" },
      { who: "you", x: 52, pose: "sit", caption: "You", moods: { win: "cheer" } }, { who: "student", x: 70, pose: "sit" }, { who: "npc", x: 86, pose: "sit" }],
  },
  "ircc-portal": {
    wall: "#1e1b4b", ground: "carpet",
    props: [{ kind: "screen", x: 50, w: 200, label: "IRCC · Express Entry · Rounds of invitations" },
      { kind: "desk2", x: 50, w: 140 }, { kind: "laptop2", x: 50 }, { kind: "window", x: 10, w: 60, window: "night" }],
    people: [{ who: "you", x: 50, pose: "sit", caption: "You", moods: { win: "cheer", fail: "slump", talk: "phone" } },
      { who: "roommate", x: 82, pose: "idle", scale: 0.85 }],
  },
  // --- Canada ---
  "pearson-arrivals": {
    wall: "#cbd5e1", panel: true, ground: "tiles",
    props: [{ kind: "banner", x: 50, label: "Toronto Pearson · Terminal 3 · Arrivals", tone: "blue" },
      { kind: "window", x: 80, w: 90, window: "snow" }, { kind: "belt", x: 72, w: 150 }, { kind: "suitcase", x: 44 }],
    people: [{ who: "officer", x: 16, pose: "talk", caption: "CBSA officer" },
      { who: "you", x: 36, pose: "queue", caption: "You", wear: SCARF, moods: { win: "cheer", fail: "slump" } },
      { who: "npc", x: 60, pose: "walk" }, { who: "student", x: 84, pose: "phone" }],
  },
  "toronto-street": {
    sky: "snow", skyline: "toronto", ground: "slush", snow: true, streetcar: true,
    props: [{ kind: "banner", x: 20, label: "Queen St W", tone: "green" }],
    people: [{ who: "you", x: 40, pose: "walk", caption: "You", wear: SCARF, moods: { win: "cheer", fail: "slump" } },
      { who: "npc", x: 66, pose: "walk", wear: SCARF, delay: "0.2s" }, { who: "student", x: 84, pose: "phone", wear: SCARF }],
  },
  campus: {
    sky: "dayca", skyline: "toronto", ground: "snow", snow: true,
    props: [{ kind: "banner", x: 30, label: "Welcome, international students", tone: "blue" }],
    people: [{ who: "you", x: 30, pose: "wave", caption: "You", wear: SCARF, moods: { fail: "slump", win: "cheer" } },
      { who: "student", x: 52, pose: "walk", wear: SCARF }, { who: "npc", x: 70, pose: "talk" }, { who: "student", x: 86, pose: "phone", flip: true }],
  },
  "lecture-hall": {
    wall: "#292524", ground: "carpet",
    props: [{ kind: "screen", x: 32, w: 170, label: "SCM 6010 · Global Logistics" }, { kind: "podium", x: 70 }],
    people: [{ who: "prof", x: 70, pose: "talk", caption: "Professor" },
      { who: "you", x: 20, pose: "sit", caption: "You", moods: { win: "cheer", fail: "slump" } },
      { who: "student", x: 38, pose: "sit" }, { who: "npc", x: 52, pose: "sit" }],
  },
  "tim-hortons": {
    wall: "#7f1d1d", panel: true, ground: "tiles",
    props: [{ kind: "menu-board", x: 26, label: "Double-double · Timbits" }, { kind: "counter", x: 26, w: 170 },
      { kind: "window", x: 80, w: 100, window: "snow" }, { kind: "table", x: 70, w: 110 }],
    people: [{ who: "clerk", x: 18, pose: "idle", caption: "Barista" },
      { who: "mentor", x: 62, pose: "talk", caption: "Mentor" },
      { who: "you", x: 80, pose: "sit", caption: "You", flip: true, moods: { win: "cheer" } }],
  },
  basement: {
    wall: "#57534e", ground: "carpet",
    props: [{ kind: "window", x: 76, w: 70, window: "snow" }, { kind: "couch", x: 40, w: 150 }],
    people: [{ who: "you", x: 40, pose: "phone", caption: "You", moods: { win: "cheer", fail: "slump", calm: "phone" } },
      { who: "roommate", x: 82, pose: "idle", caption: "Cousin", scale: 0.9 }],
  },
  "job-fair": {
    wall: "#1e293b", ground: "carpet",
    props: [{ kind: "banner", x: 50, label: "Toronto Tech & Logistics Job Fair", tone: "gold" },
      { kind: "booth", x: 20, w: 110, color: "#dc2626" }, { kind: "booth", x: 52, w: 110, color: "#2563eb" }, { kind: "booth", x: 84, w: 110, color: "#16a34a" }],
    people: [{ who: "clerk", x: 20, pose: "talk", caption: "Recruiter" },
      { who: "you", x: 36, pose: "queue", caption: "You", moods: { win: "cheer" } },
      { who: "student", x: 52, pose: "queue" }, { who: "npc", x: 68, pose: "walk" }, { who: "agent", x: 86, pose: "talk" }],
  },
  library: {
    wall: "#3f2a14", ground: "carpet",
    props: [{ kind: "shelf", x: 20, w: 120 }, { kind: "shelf", x: 82, w: 110 }, { kind: "desk2", x: 50, w: 120 }, { kind: "laptop2", x: 50 }],
    people: [{ who: "you", x: 50, pose: "sit", caption: "You", moods: { win: "cheer", fail: "slump" } },
      { who: "student", x: 70, pose: "sit", scale: 0.9 }],
  },
  warehouse: {
    wall: "#292524", ground: "concrete",
    props: [{ kind: "boxes", x: 20, w: 90 }, { kind: "boxes", x: 82, w: 100 }, { kind: "banner", x: 52, label: "Shift starts 6 PM", tone: "gold" }],
    people: [{ who: "npc", x: 34, pose: "walk" }, { who: "you", x: 56, pose: "idle", caption: "You", moods: { fail: "slump" } }, { who: "agent", x: 70, pose: "talk", caption: "Supervisor" }],
  },
  boardroom: {
    wall: "#0f172a", ground: "carpet",
    props: [{ kind: "window", x: 22, w: 140, window: "city" }, { kind: "window", x: 78, w: 140, window: "city" },
      { kind: "table", x: 50, w: 260 }],
    people: [{ who: "kovacs", x: 40, pose: "sit", caption: "Mr. Kovacs", moods: { talk: "talk", win: "wave", fail: "idle" } },
      { who: "you", x: 60, pose: "sit", caption: "You", flip: true, moods: { win: "cheer", fail: "slump" } }],
  },
  graduation: {
    sky: "dayca", skyline: "toronto", ground: "grass",
    props: [{ kind: "banner", x: 50, label: "Convocation", tone: "blue" }, { kind: "podium", x: 22 }],
    people: [{ who: "prof", x: 22, pose: "talk", caption: "Dean" },
      { who: "you", x: 46, pose: "cheer", caption: "You", wear: ["cap"], moods: { fail: "slump" } },
      { who: "student", x: 64, pose: "wave", wear: ["cap"] }, { who: "student", x: 80, pose: "cheer", wear: ["cap"], delay: "0.2s" }],
  },
  "pr-landing": {
    wall: "#e2e8f0", panel: true, ground: "tiles",
    props: [{ kind: "flag-ca", x: 50 }, { kind: "banner", x: 50, label: "Welcome to Canada · Permanent residents", tone: "blue" }, { kind: "window", x: 84, w: 90, window: "snow" }],
    people: [{ who: "officer", x: 26, pose: "wave", caption: "Officer" },
      { who: "you", x: 50, pose: "cheer", caption: "You", wear: SCARF, moods: { fail: "slump" } }, { who: "ada", x: 72, pose: "wave", caption: "Ada (video)", scale: 0.8 }],
  },
  "pitch-room": {
    wall: "#14532d", ground: "carpet",
    props: [{ kind: "window", x: 14, w: 80, window: "night" },
      { kind: "screen", x: 60, w: 210, label: "Zoom · Maple Venture Incubator · 4 participants" },
      { kind: "desk2", x: 60, w: 160 }, { kind: "laptop2", x: 60 }],
    people: [{ who: "you", x: 60, pose: "sit", caption: "You", moods: { win: "cheer", fail: "slump", talk: "talk" } }],
  },
} satisfies Record<KitStageKind, StageSpec>;


