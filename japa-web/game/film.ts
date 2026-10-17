// The after-choice film: about 32 seconds, eight shots, and a cut to the other person's side of the moment.
// Pure (no React, no timers): which shots play, how long each lasts, and what each person thinks.
import type { Tone } from "./cinematic";

export type ShotKind = "establish" | "think" | "say" | "pov" | "decision" | "consequence" | "ripple" | "close";

export interface Shot {
  kind: ShotKind;
  ms: number;
}

/** The running order. The react beat (sound, stamp, results) starts at "decision". */
export const FILM: Shot[] = [
  { kind: "establish", ms: 3500 }, // wide shot of the place, with its name as a title
  { kind: "think", ms: 4000 }, // close-up on you, weighing it up
  { kind: "say", ms: 4500 }, // over the shoulder: you say what you'll do
  { kind: "pov", ms: 5000 }, // their side: the reverse angle or their own place, and what they think
  { kind: "decision", ms: 3500 }, // the result lands
  { kind: "consequence", ms: 5000 }, // pull back: what it cost and what it bought
  { kind: "ripple", ms: 4000 }, // meanwhile, someone else hears about it
  { kind: "close", ms: 3000 }, // back on your face, then black
];
export const FILM_MS = FILM.reduce((n, s) => n + s.ms, 0);
export const DECISION_SHOT = FILM.findIndex((s) => s.kind === "decision");

/** When shot i starts, in ms from the beginning of the film. */
export function shotStart(i: number): number {
  return FILM.slice(0, i).reduce((n, s) => n + s.ms, 0);
}

/** Whose circle the other person belongs to: decides how they see your choice. */
export type Circle = "family" | "friend" | "official" | "boss" | "hustler" | "faith" | "stranger";
const CIRCLE: Record<string, Circle> = {
  relative: "family", roommate: "friend", student: "friend", npc: "stranger", agent: "hustler", preacher: "faith",
  clerk: "official", officer: "official", member: "official", counsel: "official",
  vance: "boss", chen: "boss", ross: "boss", kovacs: "boss", prof: "boss", tutor: "boss", mentor: "boss",
};
export const circleOf = (who: string): Circle => CIRCLE[who] ?? "stranger";

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

/** Meanwhile: the family hears about it, or (when the family was in the scene) your roommate back in your area. */
export const RIPPLE_LINES: Record<"family" | "friend", Record<Mood, string[]>> = {
  family: {
    up: ["Meanwhile, the family group chat is already celebrating. Three aunties typing.", "Meanwhile, back home, Mummy just told the whole church."],
    down: ["Meanwhile, back home, the family group chat has gone very quiet.", "Meanwhile, Mummy is fasting again. On your behalf."],
    even: ["Meanwhile, back home, life goes on. NEPA took light again.", "Meanwhile, the family group chat is arguing about something else entirely."],
  },
  friend: {
    up: ["Meanwhile, in {area}, your roommate is already planning your send-forth.", "Meanwhile, in {area}, your roommate tells the whole street."],
    down: ["Meanwhile, in {area}, your roommate saves you a plate of rice.", "Meanwhile, in {area}, nobody asks. They already know."],
    even: ["Meanwhile, in {area}, the generator coughs. Life goes on.", "Meanwhile, in {area}, the danfo conductors are still shouting."],
  },
};

/** The last word over the close-up of your face. */
export const CLOSE_LINES: Record<Mood, string> = {
  up: "One step closer.",
  down: "Not today. But not never.",
  even: "The journey continues.",
};

function pick<T>(list: T[], seed: number): T {
  return list[Math.abs(Math.floor(seed)) % list.length];
}

export interface FilmScript {
  circle: Circle;
  mood: Mood;
  think: string;
  pov: string;
  ripple: string;
  /** Whose "meanwhile" it is: never the same circle as the person already in the scene. */
  rippleCircle: "family" | "friend";
  close: string;
}

/** What everyone says in this film. The seed keeps it stable while it plays and varies it between choices. */
export function filmScript(tone: Tone, reactor: string, seed: number): FilmScript {
  const circle = circleOf(reactor);
  const mood = moodOf(tone);
  const rippleCircle = circle === "family" ? "friend" : "family";
  return {
    circle,
    mood,
    think: pick(THINK_LINES, seed),
    pov: pick(POV_LINES[circle][mood], seed + 1),
    ripple: pick(RIPPLE_LINES[rippleCircle][mood], seed + 2),
    rippleCircle,
    close: CLOSE_LINES[mood],
  };
}

/** Every line a film can show, for the translation check. */
export function allFilmLines(): string[] {
  return [
    ...THINK_LINES,
    ...Object.values(POV_LINES).flatMap((m) => Object.values(m).flat()),
    ...Object.values(RIPPLE_LINES).flatMap((m) => Object.values(m).flat()),
    ...Object.values(CLOSE_LINES),
    ...Object.values(SPEAKER_DEFAULT),
    ...SLUGS,
  ];
}

/** What to call the other person when the place doesn't name them. */
export const SPEAKER_DEFAULT: Record<Circle, string> = {
  family: "{relTitle}", friend: "Your roommate", official: "The officer", boss: "The boss",
  hustler: "The agent", faith: "The pastor", stranger: "A stranger",
};
/** Small captions on the film. */
export const SLUGS = ["Their side", "Meanwhile", "You", "The family group chat", "Your roommate"];
