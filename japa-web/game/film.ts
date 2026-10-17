// The after-choice film: ten shots, about 36 seconds, cut like a short film, with a cut to the other person's
// side of the moment. Pure (no React, no timers): which shots play, how long each lasts, and what is said.
import type { Delta, Tone } from "./cinematic";

export type ShotKind =
  | "establish" // wide: the place, with its name as a title
  | "think" // medium on you, weighing it up
  | "insert" // close on the thing at stake: the wallet, the documents, the clock, the phone
  | "say" // close-up: you say what you'll do
  | "pov" // their side: their own place, and what they think of it
  | "react" // close on their face as the result lands
  | "verdict" // the paper gets stamped, or your face takes it in
  | "consequence" // pull back: what it cost and what it bought
  | "ripple" // meanwhile: the family group chat, or your roommate
  | "close"; // back on you, then black

export interface Shot {
  kind: ShotKind;
  ms: number;
}

export const FILM: Shot[] = [
  { kind: "establish", ms: 3500 },
  { kind: "think", ms: 3500 },
  { kind: "insert", ms: 3000 },
  { kind: "say", ms: 4000 },
  { kind: "pov", ms: 4500 },
  { kind: "react", ms: 3000 },
  { kind: "verdict", ms: 3000 },
  { kind: "consequence", ms: 4500 },
  { kind: "ripple", ms: 4500 },
  { kind: "close", ms: 3000 },
];
export const FILM_MS = FILM.reduce((n, s) => n + s.ms, 0);
/** The result (sound, stamp, numbers) lands on the reaction shot. */
export const DECISION_SHOT = FILM.findIndex((s) => s.kind === "react");

export function shotStart(i: number): number {
  return FILM.slice(0, i).reduce((n, s) => n + s.ms, 0);
}

/** Whose circle the other person belongs to: decides where their side is and how they see your choice. */
export type Circle = "family" | "friend" | "official" | "boss" | "hustler" | "faith" | "stranger";
const CIRCLE: Record<string, Circle> = {
  relative: "family", roommate: "friend", student: "friend", npc: "stranger", agent: "hustler", preacher: "faith",
  clerk: "official", officer: "official", member: "official", counsel: "official",
  vance: "boss", chen: "boss", ross: "boss", kovacs: "boss", prof: "boss", tutor: "boss", mentor: "boss",
};
/** The caption on the set wins over the costume: the warehouse "Supervisor" is a boss, whoever plays them. */
export function circleOf(who: string, caption?: string): Circle {
  if (caption && /supervisor|recruiter|manager|mr\.|mrs\.|ms\.|dean|professor|employer|chair|partner|boss/i.test(caption)) return "boss";
  if (caption && /officer|teller|registry|invigilator|clerk|counsellor|member|counsel|cbsa/i.test(caption)) return "official";
  return CIRCLE[who] ?? "stranger";
}

/**
 * Who a choice involves, from its words: "Call Aunty Bisi" goes to the family, "Pay the agent" to the agent.
 * `relName` is the player's relative in Canada, so a choice naming them goes to the family too.
 * Returns a cast id the film knows, or null to keep whoever is in the scene.
 */
export function whoInChoice(text: string, relName?: string): string | null {
  const t = text.toLowerCase();
  if ((relName && t.includes(relName.toLowerCase())) || /\b(aunty|auntie|sister|brother|mum|mummy|mother|dad|daddy|father|family|relative|uncle)\b/.test(t)) return "relative";
  if (/\b(agent|travel agency|consultant|tout)\b/.test(t)) return "agent";
  if (/\b(pastor|church|vigil|prayer|imam|mosque|jumu'?ah)\b/.test(t)) return "preacher";
  if (/\b(boss|oga|manager|supervisor|employer|hr|interviewer|recruiter)\b/.test(t)) return "kovacs";
  if (/\b(officer|cbsa|embassy|visa officer|vfs|immigration|irb|board member)\b/.test(t)) return "officer";
  if (/\b(roommate|flatmate|friend)\b/.test(t)) return "roommate";
  // A call with no one named is usually home.
  if (/\bcall\b/.test(t)) return "relative";
  return null;
}

export type Mood = "up" | "down" | "even";
export const moodOf = (tone: Tone): Mood => (tone === "good" || tone === "triumph" ? "up" : tone === "neutral" ? "even" : "down");

/** What the other person thinks, from their side of the table. */
export const POV_LINES: Record<Circle, Record<Mood, string[]>> = {
  family: {
    up: ["Now this one makes sense. I'm telling the whole family group.", "Look at this child trying! Let me call Mummy right now."],
    down: ["Ah. I didn't send all those voice notes for this.", "I'm not angry. I'm just going to pray louder."],
    even: ["Hmm. Let's see how it goes. Keep me posted.", "As long as you're eating well, we'll manage the rest."],
  },
  friend: {
    up: ["You're actually doing it. Don't forget me when you land.", "I'm screenshotting this for when you're famous."],
    down: ["I told you. But I'll still share my jollof with you tonight.", "Omo. Sorry. Tomorrow we try again."],
    even: ["I'm just watching. This japa thing is a whole series.", "Wake me up when something happens."],
  },
  official: {
    up: ["Documents in order. Story consistent. Next.", "Credible. I can work with this file."],
    down: ["That doesn't line up with what's on the file.", "I've heard this story before. Many times."],
    even: ["Noted. The file will speak for itself.", "Have a seat, please. We will call you."],
  },
  boss: {
    up: ["Reliable, on time, no drama. I could use more people like this.", "Okay. That's the kind of answer I was hoping for."],
    down: ["I need someone I can count on. Not this.", "That's going on the record, unfortunately."],
    even: ["Let me think about it over the weekend.", "Fine. Show me, don't tell me."],
  },
  hustler: {
    up: ["This one is sharp. Hard to sell them anything.", "They did their research. No money for me today."],
    down: ["Another one believed the brochure. Next customer!", "Their money is my money now."],
    even: ["Let them think about it. They always come back.", "Patience. The client always calls back."],
  },
  faith: {
    up: ["Somebody shout Hallelujah! Canada is calling!", "I can see the visa in the spirit."],
    down: ["The enemy is at work. Seed of faith, five thousand naira only.", "Village people are strong this season."],
    even: ["Pray, and also fill the form correctly.", "God helps those who read the requirements."],
  },
  stranger: {
    up: ["Who is this person? They look like they're going somewhere.", "Respect. That was a smart move."],
    down: ["Eyah. Lagos is not easy.", "I've seen that face before. It gets better."],
    even: ["Just another day in the city.", "Everybody here is chasing something."],
  },
};

/** Your own thought before the result is known. */
export const THINK_LINES = [
  "Think it through. One wrong move costs months.",
  "Everybody has advice. Nobody is paying the fees.",
  "This is it. No going back after this.",
  "Breathe. You've come too far to panic now.",
];

/** What the insert shot is about, from what the choice changes. */
export type InsertKind = "wallet" | "documents" | "clock" | "phone";
const INSERT_CAPTION: Record<InsertKind, string> = {
  wallet: "What it costs",
  documents: "The paperwork",
  clock: "Time is money",
  phone: "Everybody has an opinion",
};
export function insertFor(deltas: Pick<Delta, "key">[]): InsertKind {
  const keys = new Set(deltas.map((d) => d.key as string));
  if (keys.has("walletNgn") || keys.has("walletCad")) return "wallet";
  if (["papers", "officerConfidence", "crsScore", "clbFirst", "nclcFrench", "employerTrust", "lmiaProbability", "kwEvidence"].some((k) => keys.has(k))) return "documents";
  if (keys.has("timeRemainingDays") || keys.has("energy")) return "clock";
  return "phone";
}

/** The family group chat, three messages at a time. {relName} is the relative in Canada. */
export interface ChatMessage { from: string; text: string }
export const CHAT: Record<Mood, ChatMessage[][]> = {
  up: [
    [{ from: "Mummy", text: "Glory be to God! 🙏🏾" }, { from: "{relName}", text: "I told you they can do it 🇨🇦" }, { from: "Daddy", text: "Well done. Don't spend it all." }],
    [{ from: "{relName}", text: "Send the screenshot!" }, { from: "Mummy", text: "I'm telling the whole church on Sunday." }, { from: "Daddy", text: "This one is my child." }],
  ],
  down: [
    [{ from: "Mummy", text: "We are praying for you." }, { from: "{relName}", text: "It's not the end. Call me tonight." }, { from: "Daddy", text: "Come home for Sunday rice." }],
    [{ from: "Daddy", text: "Hmm." }, { from: "Mummy", text: "Who did this to my child?" }, { from: "{relName}", text: "Don't mind them. We go again." }],
  ],
  even: [
    [{ from: "Mummy", text: "Have you eaten?" }, { from: "{relName}", text: "Any update?" }, { from: "Daddy", text: "Keep pushing." }],
    [{ from: "{relName}", text: "How far with the japa?" }, { from: "Mummy", text: "Light just came back here." }, { from: "Daddy", text: "Read the requirements well." }],
  ],
};

/** Meanwhile, when the family was already in the scene: your roommate back home. */
export const ROOMMATE_LINES: Record<Mood, string[]> = {
  up: ["Meanwhile, in {area}, your roommate is already planning your send-forth.", "Meanwhile, in {area}, your roommate tells the whole street."],
  down: ["Meanwhile, in {area}, your roommate saves you a plate of rice.", "Meanwhile, in {area}, nobody asks. They already know."],
  even: ["Meanwhile, in {area}, the generator coughs. Life goes on.", "Meanwhile, in {area}, the danfo conductors are still shouting."],
};

/** The last word over the close-up of your face. */
export const CLOSE_LINES: Record<Mood, string> = {
  up: "One step closer.",
  down: "Not today. But not never.",
  even: "The journey continues.",
};

/** What to call the other person when the place doesn't name them. */
export const SPEAKER_DEFAULT: Record<Circle, string> = {
  family: "{relTitle}", friend: "Your roommate", official: "The officer", boss: "The boss",
  hustler: "The agent", faith: "The pastor", stranger: "A stranger",
};
/** Small captions on the film. */
export const SLUGS = ["Their side", "Meanwhile", "You", "The family group chat", "Your roommate", "Mummy", "Daddy",
  "Approved", "Refused", "Noted", "Decision", ...Object.values(INSERT_CAPTION)];

function pick<T>(list: T[], seed: number): T {
  return list[Math.abs(Math.floor(seed)) % list.length];
}

export interface FilmScript {
  circle: Circle;
  mood: Mood;
  think: string;
  pov: string;
  insert: InsertKind;
  insertCaption: string;
  /** "stamp": the paper gets stamped (officials, bosses, agents). "face": your face takes it in. */
  verdict: "stamp" | "face";
  stamp: string;
  /** The family group chat, or (when the family is already in the scene) your roommate. */
  ripple: { kind: "chat"; messages: ChatMessage[] } | { kind: "roommate"; line: string };
  close: string;
}

/** Everything said and shown in this film. The seed keeps it stable while it plays and varies it between choices. */
export function filmScript(tone: Tone, reactor: string, seed: number, deltas: Pick<Delta, "key">[] = [], caption?: string): FilmScript {
  const circle = circleOf(reactor, caption);
  const mood = moodOf(tone);
  const insert = insertFor(deltas);
  return {
    circle,
    mood,
    think: pick(THINK_LINES, seed),
    pov: pick(POV_LINES[circle][mood], seed + 1),
    insert,
    insertCaption: INSERT_CAPTION[insert],
    verdict: circle === "official" || circle === "boss" || circle === "hustler" ? "stamp" : "face",
    stamp: mood === "up" ? "Approved" : mood === "down" ? "Refused" : "Noted",
    ripple: circle === "family"
      ? { kind: "roommate", line: pick(ROOMMATE_LINES[mood], seed + 2) }
      : { kind: "chat", messages: pick(CHAT[mood], seed + 2) },
    close: CLOSE_LINES[mood],
  };
}

/** Every line a film can show, for the translation check. */
export function allFilmLines(): string[] {
  return [
    ...THINK_LINES,
    ...Object.values(POV_LINES).flatMap((m) => Object.values(m).flat()),
    ...Object.values(ROOMMATE_LINES).flat(),
    ...Object.values(CHAT).flat(2).map((m) => m.text),
    ...Object.values(CLOSE_LINES),
    ...Object.values(SPEAKER_DEFAULT),
    ...SLUGS,
  ];
}
