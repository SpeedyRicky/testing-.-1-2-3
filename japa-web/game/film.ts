// The after-choice film: fourteen shots, just over a minute, cut like a short film, with the other person's
// side of the moment. Pure (no React, no timers): which shots play, how long each lasts, and what is said.
import type { Delta, Tone } from "./cinematic";
import { allMomentLines, momentFor, type Moment } from "./moments";

export type ShotKind =
  | "establish" // wide: the place, with its name as a title
  | "journey" // tracking shot: you on the way there
  | "think" // medium on you, weighing it up
  | "insert" // close on the thing at stake: the wallet, the documents, the clock, the phone
  | "say" // close-up: you say what you'll do
  | "hear" // their side: in their own place, they hear you out
  | "pov" // their side: what they make of it
  | "react" // close on their face as the result lands
  | "verdict" // the paper gets stamped, or your face takes it in
  | "reply" // close-up: what you say back
  | "consequence" // pull back: what it cost and what it bought
  | "ripple" // meanwhile: the family group chat, or your roommate
  | "night" // later that night: you, alone, thinking it over
  // Big moments (game/moments.ts) add their own shots:
  | "handover" // across the counter: the officer slides your SIN letter over, the agent takes your cash
  | "item" // the thing itself, close up: the letter, the passport, the pay stub
  | "look" // you, reading it; then your face changes
  | "showoff" // holding it up (only when it went well)
  | "screen" // the portal or your inbox loading, then the answer
  | "plane" // wheels down at Pearson
  | "dial" // the phone ringing out
  | "split" // split screen: you and them, both on the phone
  | "desk" // you at your desk, working on it, the clock racing
  | "listen" // they listen, and write on their notepad
  | "notes" // their notepad, close up: the verdict in their handwriting
  | "work" // on shift (three angles: v 0, 1, 2)
  | "clock" // the hours going by
  | "ride" // in the danfo, keke or streetcar window
  | "arrive" // stepping off, walking in
  | "sleep" // asleep, while the days go
  | "calendar" // the calendar pages flipping
  | "board" // your pick, pinned on the board
  | "crowd" // everybody's here: the owambe, the church hall
  | "close"; // back on you, then black

export interface Shot {
  kind: ShotKind;
  ms: number;
  /** Which angle, when the same kind of shot plays more than once. */
  v?: number;
}

export const FILM: Shot[] = [
  { kind: "establish", ms: 4500 },
  { kind: "journey", ms: 4500 },
  { kind: "think", ms: 4500 },
  { kind: "insert", ms: 4000 },
  { kind: "say", ms: 5000 },
  { kind: "hear", ms: 4500 },
  { kind: "pov", ms: 5000 },
  { kind: "react", ms: 4000 },
  { kind: "verdict", ms: 4000 },
  { kind: "reply", ms: 4500 },
  { kind: "consequence", ms: 5500 },
  { kind: "ripple", ms: 5500 },
  { kind: "night", ms: 4500 },
  { kind: "close", ms: 4000 },
];
export const FILM_MS = FILM.reduce((n, s) => n + s.ms, 0);
/** The result (sound, stamp, numbers) lands on the reaction shot. */
export const DECISION_SHOT = FILM.findIndex((s) => s.kind === "react");

export function shotStart(i: number, plan: Shot[] = FILM): number {
  return plan.slice(0, i).reduce((n, s) => n + s.ms, 0);
}
export const planMs = (plan: Shot[]) => plan.reduce((n, s) => n + s.ms, 0);

/** The running order for one choice: the ordinary film, or one built around a big moment. */
export function filmPlan(moment: Moment | null): Shot[] {
  const S = (kind: ShotKind, ms: number, v?: number): Shot => (v === undefined ? { kind, ms } : { kind, ms, v });
  if (!moment) return FILM;
  const head = FILM.slice(0, 3); // establish, journey, think
  const tail = FILM.slice(FILM.findIndex((s) => s.kind === "pov")); // their side, the result, the aftermath
  const show = moment.showoff ? [S("showoff", 4500)] : [];
  const middle: Record<Moment["style"], Shot[]> = {
    handover: [S("say", 5000), S("handover", 5500), S("item", 5000), S("look", 5500), ...show, S("hear", 4500)],
    screen: [S("say", 4500), S("screen", 6000), S("look", 5500), ...show, S("hear", 4500)],
    landing: [S("plane", 5500), S("say", 4500), S("handover", 5500), S("item", 5000), S("look", 5500), ...show, S("hear", 4500)],
    call: [S("say", 4500), S("dial", 4500), S("split", 6000)], // the split screen is how they hear it
    desk: [S("say", 5000), S("desk", 5500), S("item", 5000), S("look", 5500), ...show, S("hear", 4500)],
    talk: [S("say", 5000), S("listen", 5000), S("notes", 4500), S("hear", 4500)],
    work: [S("work", 4000, 0), S("work", 3500, 1), S("work", 3500, 2), S("clock", 4000), S("look", 4500), S("hear", 4500)],
    ride: [S("ride", 6000), S("arrive", 4500), S("say", 4500), S("hear", 4500)],
    rest: [S("sleep", 5500), S("calendar", 4500), S("look", 5000), S("hear", 4500)],
    board: [S("say", 4500), S("board", 5500), S("look", 5000), ...show, S("hear", 4500)],
    crowd: [S("crowd", 6000), S("say", 5000), S("look", 4500), S("hear", 4500)],
  };
  return [...head, ...middle[moment.style], ...tail];
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

/** Their first words as your choice reaches them, before they've made up their mind. */
export const HEAR_LINES: Record<Circle, string> = {
  family: "Hello? Hello? The network is bad… okay, I can hear you now.",
  friend: "Wait, wait. Say that again?",
  official: "Go on. I'm listening.",
  boss: "You have two minutes. Go.",
  hustler: "My friend, sit down, sit down. Talk to me.",
  faith: "Speak, my child. The Lord is listening.",
  stranger: "Hmm? Me?",
};

/** What you say back once you know how it went. */
export const REPLY_LINES: Record<Mood, string[]> = {
  up: ["Thank you. I won't let you down.", "I've been praying for this day."],
  down: ["I understand. I'll come back stronger.", "Okay. It's not over until it's over."],
  even: ["Okay. I'll wait and see.", "Fine. One step at a time."],
};

/** Later that night, alone. */
export const NIGHT_LINES: Record<Mood, string[]> = {
  up: ["Later that night, you can't sleep. For once, it's because of good news.", "Later that night, you check the portal three times. Just to be sure."],
  down: ["Later that night, NEPA takes light. You lie there, doing the maths again.", "Later that night, you scroll the japa groups. Everyone else seems to be landing."],
  even: ["Later that night, the generator hums. Tomorrow is another day.", "Later that night, you write tomorrow's to-do list. It's long."],
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
export const SLUGS = ["Their side", "Meanwhile", "On the way", "Later that night", "Wheels down.", "Loading…", "Calling…", "No receipt.", "You", "The family group chat", "Your roommate", "Mummy", "Daddy",
  "Approved", "Refused", "Noted", "Decision", ...Object.values(INSERT_CAPTION)];

function pick<T>(list: T[], seed: number): T {
  return list[Math.abs(Math.floor(seed)) % list.length];
}

export interface FilmScript {
  /** The shots for this film, in order. */
  plan: Shot[];
  /** The big moment this choice is, if any. */
  moment: Moment | null;
  circle: Circle;
  mood: Mood;
  think: string;
  hear: string;
  pov: string;
  reply: string;
  night: string;
  insert: InsertKind;
  insertCaption: string;
  /** "stamp": the paper gets stamped (officials, bosses, agents). "face": your face takes it in. */
  verdict: "stamp" | "face";
  stamp: string;
  /** The family group chat, or (when the family is already in the scene) your roommate. */
  ripple: { kind: "chat"; messages: ChatMessage[] } | { kind: "roommate"; line: string };
  close: string;
}

/** Moments that already put a document, a screen or a pinned card on screen. */
const PAPER_SHOWN: ReadonlySet<Moment["style"]> = new Set(["handover", "screen", "landing", "desk", "board"]);

/** Everything said and shown in this film. The seed keeps it stable while it plays and varies it between choices. */
export function filmScript(tone: Tone, reactor: string, seed: number, deltas: Pick<Delta, "key">[] = [], caption?: string,
  choiceText = "", sceneId = ""): FilmScript {
  const circle = circleOf(reactor, caption);
  const mood = moodOf(tone);
  const insert = insertFor(deltas);
  const moment = momentFor(choiceText, sceneId, mood);
  return {
    plan: filmPlan(moment),
    moment,
    circle,
    mood,
    think: pick(THINK_LINES, seed),
    hear: HEAR_LINES[circle],
    pov: pick(POV_LINES[circle][mood], seed + 1),
    reply: pick(REPLY_LINES[mood], seed + 3),
    night: pick(NIGHT_LINES[mood], seed + 4),
    insert,
    insertCaption: INSERT_CAPTION[insert],
    // Officials, bosses and agents stamp their decision, unless the moment already showed the paper.
    verdict: (circle === "official" || circle === "boss" || circle === "hustler") && !PAPER_SHOWN.has(moment.style) ? "stamp" : "face",
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
    ...Object.values(HEAR_LINES),
    ...Object.values(REPLY_LINES).flat(),
    ...Object.values(NIGHT_LINES).flat(),
    ...Object.values(POV_LINES).flatMap((m) => Object.values(m).flat()),
    ...Object.values(ROOMMATE_LINES).flat(),
    ...Object.values(CHAT).flat(2).map((m) => m.text),
    ...Object.values(CLOSE_LINES),
    ...Object.values(SPEAKER_DEFAULT),
    ...SLUGS,
    ...allMomentLines(),
  ];
}
