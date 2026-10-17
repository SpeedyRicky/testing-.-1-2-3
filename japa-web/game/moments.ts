// Big moments get their own scenes in the after-choice film: getting your SIN shows the officer handing it over,
// the letter itself, and you reading it. Pure: which moment a choice is, and what the item says.
import type { Mood } from "./film";

export type MomentKind =
  | "sin" | "ita" | "portal" | "passport" | "landing" | "agent-cash" | "transcript" | "offer" | "paycheque"
  | "payment" | "shopping" | "call";

/** The thing in your hands. */
export type PropKind = "letter" | "passport" | "laptop" | "phone" | "cash" | "envelope" | "payslip" | "receipt" | "bag";

/** How the moment is filmed: handed over across a counter, read off a screen, landed into, or a phone call. */
export type MomentStyle = "handover" | "screen" | "landing" | "call";

export interface Moment {
  kind: MomentKind;
  style: MomentStyle;
  prop: PropKind;
  /** Who hands it over: the circle of the person behind the counter or desk. */
  giver: "official" | "boss" | "hustler" | "stranger" | null;
  /** The set the moment happens in. */
  set: "office" | "agent-office" | "boardroom" | "warehouse" | "toronto-street" | "bedroom" | "airport";
  caption: string;
  /** The item, close up: its heading and what's written on it. */
  title: string;
  lines: string[];
  /** What you say as you read it, and as you show it off (null: no showing off, it went badly). */
  look: string;
  showoff: string | null;
}

/** Who stands behind the counter for each giver, as the film's cast. */
export const GIVER_WHO: Record<NonNullable<Moment["giver"]>, string> = { official: "officer", boss: "kovacs", hustler: "agent", stranger: "npc" };

/** Which big moment a choice is, from its words (the English text, before translation) and its scene. */
export function momentKind(text: string, sceneId = ""): MomentKind | null {
  const t = text;
  if (/\bSIN\b|social insurance/i.test(t)) return "sin";
  if (/^EE_ITA/.test(sceneId) || /invitation to apply/i.test(t)) return "ita";
  if (/\bportal\b/i.test(t)) return "portal";
  if (/start packing|collect (the |your )?passport|passport request/i.test(t)) return "passport";
  if (/\bland(ing)?\b|pearson|board the (plane|flight)/i.test(t)) return "landing";
  if (/\bpay\b.*\b(agent|connect|facilitation)\b|\bagent\b.*₦|guaranteed visa/i.test(t)) return "agent-cash";
  if (/transcript/i.test(t)) return "transcript";
  if (/take the offer|offer letter|accept the (job|offer)/i.test(t)) return "offer";
  if (/paycheque|first pay\b/i.test(t)) return "paycheque";
  if (/\bpay\b|biometrics|\bfees?\b/i.test(t)) return "payment";
  if (/\bbuy\b|winter coat|\bboots\b/i.test(t)) return "shopping";
  // Making or picking up a call; "leave the call" isn't one.
  if (/^call\b|\bpick\b.*\bcall\b|\bcall (home|your|my|aunty|auntie|sister|brother|mum|mummy|dad|daddy|\{rel)/i.test(t)) return "call";
  return null;
}

const PORTAL: Record<Mood, { title: string; lines: string[]; look: string; showoff: string | null }> = {
  up: { title: "Application status: Approved", lines: ["We need your passport to finish processing.", "Submit it at the visa application centre."],
    look: "Passport request. Passport request! It's real.", showoff: "Screenshot. Send. Everybody wakes up." },
  down: { title: "Application status: Refused", lines: ["The officer was not satisfied you will leave Canada at the end of your stay.", "You may reapply."],
    look: "Read it again. Same words.", showoff: null },
  even: { title: "Application status: In progress", lines: ["No decision yet.", "Check again later."],
    look: "Still in progress. Again.", showoff: null },
};

/** The full moment for a choice, or null for an ordinary one. */
export function momentFor(text: string, sceneId: string, mood: Mood): Moment | null {
  const kind = momentKind(text, sceneId);
  if (!kind) return null;
  const good = mood !== "down";
  switch (kind) {
    case "sin":
      return { kind, style: "handover", prop: "letter", giver: "official", set: "office", caption: "Service Canada",
        title: "Social Insurance Number", lines: ["Name: {name}", "SIN: *** *** 274", "Keep this number private. You need it to work and to get paid."],
        look: "Nine digits. Now Canada knows I'm here to work.", showoff: "Snapping it for the family group chat. Number covered, of course." };
    case "ita":
      return { kind, style: "screen", prop: "laptop", giver: null, set: "bedroom", caption: "Your inbox",
        title: "Invitation to Apply", lines: ["You have 60 days to submit your complete application.", "Upload your documents before the deadline."],
        look: "I got the ITA. Breathe. Sixty days.", showoff: "Screaming into a pillow so the neighbours don't hear." };
    case "portal":
      return { kind, style: "screen", prop: "laptop", giver: null, set: "bedroom", caption: "The portal", ...PORTAL[mood] };
    case "passport":
      return { kind, style: "handover", prop: "passport", giver: "official", set: "office", caption: "Visa application centre",
        title: "Your passport is back", lines: ["A visa counterfoil is inside.", "Check every letter of your name."],
        look: "Every letter matches. It's real.", showoff: "Holding it like a trophy." };
    case "landing":
      return { kind, style: "landing", prop: "passport", giver: "official", set: "office", caption: "Toronto Pearson",
        title: "Admitted", lines: ["Port of entry stamp", "Welcome to Canada."],
        look: good ? "Welcome to Canada. Those words hit different." : "Secondary inspection. My heart is pounding.",
        showoff: good ? "First selfie in the cold." : null };
    case "agent-cash":
      return { kind, style: "handover", prop: "cash", giver: "hustler", set: "agent-office", caption: "The agent's office",
        title: "Cash payment", lines: ["No receipt.", "No name.", "No refund."],
        look: "He didn't even count it in front of me…", showoff: null };
    case "transcript":
      return { kind, style: "handover", prop: "envelope", giver: "official", set: "office", caption: "The registry",
        title: "Official transcript", lines: ["Sealed and stamped by the registry.", "Do not open."],
        look: "Three months, four trips, one envelope.", showoff: good ? "Guarding it with my life." : null };
    case "offer":
      return { kind, style: "handover", prop: "letter", giver: "boss", set: "boardroom", caption: "The offer",
        title: "Offer of employment", lines: ["Start date: Monday.", "Please sign and return."],
        look: "A real offer. With my real name on it.", showoff: good ? "Framing this one." : null };
    case "paycheque":
      return { kind, style: "handover", prop: "payslip", giver: "boss", set: "warehouse", caption: "Payday",
        title: "Pay stub", lines: ["Gross pay", "Deductions: CPP, EI, income tax", "Net pay"],
        look: "So this is what the deductions look like.", showoff: "First Canadian money. Half is going home." };
    case "payment":
      return { kind, style: "handover", prop: "receipt", giver: "official", set: "office", caption: "The cashier",
        title: "Payment received", lines: ["Keep this receipt.", "Fees are non-refundable."],
        look: "Money gone. Receipt in hand. Let's go.", showoff: good ? "Filing this receipt with everything else." : null };
    case "shopping": {
      const phone = /phone|plan|sim\b/i.test(text);
      return { kind, style: "handover", prop: phone ? "phone" : "bag", giver: "stranger", set: "toronto-street", caption: "The shop",
        title: "Receipt", lines: phone ? ["Phone plan", "SIM card"] : ["Winter coat", "Boots", "Gloves"],
        look: phone ? "Now I can call home properly." : "Expensive. But the cold doesn't negotiate.",
        showoff: phone ? "First Canadian number!" : "Dressed for the snow at last." };
    }
    case "call":
      return { kind, style: "call", prop: "phone", giver: null, set: "bedroom", caption: "Calling…",
        title: "Calling…", lines: [], look: "", showoff: null };
  }
}

/** A choice that triggers each moment, so every line a moment can show can be listed (for the translation check). */
const PROBES = ["Get your SIN", "invitation to apply", "Open the portal", "Start packing", "Land at Pearson", "Pay for a 'guaranteed visa'",
  "Send the transcript", "Take the offer", "Spend your first paycheque", "Pay the fee", "Buy a winter coat", "Buy a phone plan", "Call home"];

export function allMomentLines(): string[] {
  const texts = new Set<string>();
  for (const probe of PROBES) {
    for (const mood of ["up", "down", "even"] as Mood[]) {
      const m = momentFor(probe, "", mood);
      if (m) [m.caption, m.title, ...m.lines, m.look, m.showoff].forEach((l) => l && texts.add(l));
    }
  }
  return [...texts];
}
