// Every choice is a big moment in the after-choice film. Getting your SIN shows the officer handing it over, the
// letter itself and you reading it; a danfo ride shows you in the bus window; a pitch shows them writing their
// verdict on a notepad. Pure: which moment a choice is, and what the item says.
import type { Mood } from "./film";

export type MomentKind =
  // Named moments
  | "sin" | "ita" | "portal" | "passport" | "landing" | "agent-cash" | "transcript" | "offer" | "paycheque"
  | "payment" | "shopping" | "call"
  // Kinds of action, so every other choice gets its own scene too
  | "shady" | "test" | "customs" | "housing" | "sell" | "transfer" | "post" | "verify" | "resign" | "write" | "apply"
  | "study" | "choose" | "gathering" | "work" | "travel" | "rest" | "talk" | "decide";

/** The thing in your hands. */
export type PropKind =
  | "letter" | "passport" | "laptop" | "phone" | "cash" | "envelope" | "payslip" | "receipt" | "bag"
  | "notebook" | "notepad" | "box" | "keys" | "document";

/**
 * How the moment is filmed:
 * handover (across a counter or desk), screen (a laptop or phone loading, then the answer), landing (wheels down,
 * then the entry stamp), call (phone ringing, then split screen), desk (you at work on it, the clock racing),
 * talk (you speak, they listen and write their verdict), work (a shift montage), ride (danfo, keke or streetcar),
 * rest (asleep while the calendar flips), board (your pick pinned on the map), crowd (the owambe, the church hall).
 */
export type MomentStyle = "handover" | "screen" | "landing" | "call" | "desk" | "talk" | "work" | "ride" | "rest" | "board" | "crowd";

export type MomentSet = "office" | "agent-office" | "boardroom" | "warehouse" | "toronto-street" | "bedroom" | "airport"
  | "lagos-street" | "cafe" | "living-room" | "church";

export interface Moment {
  kind: MomentKind;
  style: MomentStyle;
  prop: PropKind;
  /** Who hands it over or sits across from you, as a circle; null when you're on your own. */
  giver: "official" | "boss" | "hustler" | "stranger" | null;
  /** The set the moment happens in; null means wherever you are. */
  set: MomentSet | null;
  /** True when the item goes from you to them (your cash to the agent, your keys to the buyer). */
  toThem?: boolean;
  caption: string;
  /** What to call the person behind the counter or desk, when the moment knows (the Service Canada officer). */
  giverName?: string;
  /** The item, close up: its heading and what's written on it. "{choice}" is the choice itself; "{amount}" the money. */
  title: string;
  lines: string[];
  /** What you say as you read it, and as you show it off (null: no showing off, it went badly). */
  look: string;
  showoff: string | null;
}

/** Who stands behind the counter for each giver, as the film's cast. */
export const GIVER_WHO: Record<NonNullable<Moment["giver"]>, string> = { official: "officer", boss: "kovacs", hustler: "agent", stranger: "npc" };

/** Scenes where the choice is picking a place or a programme. */
const CHOOSE_SCENES = /^(PN_START|AIP_START|ST_START|TT_START|NURSE_NCLEX|SF_START|SP_STREAM|NURSE_UK_OR_CANADA)$/;

/** Which big moment a choice is, from its words (the English text, before translation) and its scene. Never null. */
export function momentKind(text: string, sceneId = ""): MomentKind {
  const t = text;
  if (/\bSIN\b|social insurance/i.test(t)) return "sin";
  if (/^EE_ITA/.test(sceneId) || /invitation to apply/i.test(t)) return "ita";
  if (/\bportal\b/i.test(t)) return "portal";
  if (/start packing|collect (the |your )?passport|passport request/i.test(t)) return "passport";
  if (/\bland(ing)?\b|pearson|board the (plane|flight)/i.test(t)) return "landing";
  if (/\bpay\b.*\b(agent|connect|facilitation)\b|\bagent\b.*₦|guaranteed visa|processing deposit|make the deposit|transfer the ₦/i.test(t)) return "agent-cash";
  // Shortcuts that are fraud or close to it: a shady handover, and the film doesn't show how.
  if (/'connect'|\bfake\b|backdated|'park'|friend's statement|something for the boys|marry you|cry on cue|tick no|new detail|word for word|claim expenses|someone else's details|fresh one|follow the man|ten thousand active|call it 'the live system'|holiday, when|never registered|cousin for a week/i.test(t)) return "shady";
  if (/transcript/i.test(t)) return "transcript";
  if (/take the offer|offer letter|accept the (job|offer)|^accept,/i.test(t)) return "offer";
  if (/paycheque|first pay\b/i.test(t)) return "paycheque";
  // Studying for a test (or for exams) is studying; booking or writing one is the test.
  if (/\blibrary\b|\bstudy\b|mock test/i.test(t) && !/^book\b/i.test(t)) return "study";
  if (/\bielts\b|celpip|\bpte\b|\btef\b|nclex|\bexam\b|retake|rebook|book (the test|a wednesday|the earliest)|write (it|both|only)/i.test(t)) return "test";
  if (/\bpay\b|biometrics|\bfees?\b/i.test(t)) return "payment";
  if (/\bbuy\b|winter coat|\bboots\b|thrift|parka|\bhoodie\b|lagos jacket/i.test(t)) return "shopping";
  if (/declare|customs|repack|stockfish/i.test(t)) return "customs";
  if (/basement|bunk|\broom\b|host family|lease|landlord|guarantor|co-sign|\bbed\b|light'|house rules/i.test(t)) return "housing";
  if (/\bsell\b|keys|jiji|bank app first|car park/i.test(t)) return "sell";
  if (/\bsend\b.*(cad|all|share|it|home)|transfer|remit|bank it|\bborrow|\blend\b|\bloan|crowdfund|convert|gift|\bsave\b|top up|data bundle|surprise/i.test(t)) return "transfer";
  if (/\bpost\b|status|tiktok|announce|boarding pass|video:|honest video|dramatic video/i.test(t)) return "post";
  if (/\bcheck\b|verify|report|warn|hang up|research|read the stream|look(ed)? (them )?up|legal name|refresh|rounds page/i.test(t)) return "verify";
  // Making or picking up a call; "leave the call" isn't one.
  if (/^call\b|\bpick\b.*\bcall\b|\bcall (home|your|my|aunty|auntie|sister|brother|mum|mummy|dad|daddy|\{rel)/i.test(t)) return "call";
  if (/\bhr\b|resign|notice|leave in writing|reference letter|remote months|schedule change|swap shifts|tell matron|on leave/i.test(t)) return "resign";
  if (CHOOSE_SCENES.test(sceneId) || /saskatchewan|manitoba|nova scotia|new brunswick|newfoundland|prince edward|nairobi|johannesburg|calgary|thunder bay|moncton|uk first|smaller towns|master's in canada|drop the atlantic/i.test(t)) return "choose";
  if (/\bwrite\b|rewrite|\bcv\b|essay|\bsop\b|template|e-?mail|questionnaire|\bforms?\b|\bfills?\b|upload|statements|budget sheet|gift deed|duties|honest file/i.test(t)) return "write";
  if (/\b(re)?apply\b|applying under|submit|register|application|update your profile|create your express entry|nomination|enrol|bridging|file it/i.test(t)) return "apply";
  if (/\bstudy|library|prepare|practice|mock test|memori[sz]e|go through it|course|certificat|storytime|programme|french institute|line by line/i.test(t)) return "study";
  if (/owambe|wedding|church|\{faith|association|meetup|games night|family meeting|naming|burial|\bgroup\b|newcomer family|black employee network|mentor/i.test(t)) return "gathering";
  if (/\{bus\}|danfo|\bkeke\b|\bwaka\b|okada|\bbus\b|go back|go home|walk (to|out)|fly home|move to|catch another|\bvisit\b|sneak out|settle in/i.test(t)) return "travel";
  if (/shift|warehouse|uber|\bdriv|overtime|\bjob\b|work (a|full|overtime)|volunteer|\bgig\b|hustle|deliver|show up early|report to the site|survival|\bwork\b/i.test(t)) return "work";
  if (/sleep|\brest\b|\bwait\b|stay inside|\bskip\b|ignore|pretend|go quiet|keep waiting|defer|delete the draft|give up|too tired|keep busy|hope it|week off/i.test(t)) return "rest";
  if (/^['‘"]|\btell\b|\bask\b|explain|\banswer\b|\bsay\b|present|be straight|be honest|recite|interview|pitch|live call|live demo|walkthrough|\bshow\b|truth|it really happened|kawosoke|queued|key-person|four paying|twelve months|we (register|use|don't|already|can)|we'll|our |^freeze|lawyer|legal aid|clinic|follow up|chase the|angel will|let's|give (him|me)|let him|i'm here|i work|friends from|could we|the job bank|accept a dollar|well above/i.test(t)) return "talk";
  return "decide";
}

const PORTAL: Record<Mood, { title: string; lines: string[]; look: string; showoff: string | null }> = {
  up: { title: "Application status: Approved", lines: ["We need your passport to finish processing.", "Submit it at the visa application centre."],
    look: "Passport request. Passport request! It's real.", showoff: "Screenshot. Send. Everybody wakes up." },
  down: { title: "Application status: Refused", lines: ["The officer was not satisfied you will leave Canada at the end of your stay.", "You may reapply."],
    look: "Read it again. Same words.", showoff: null },
  even: { title: "Application status: In progress", lines: ["No decision yet.", "Check again later."],
    look: "Still in progress. Again.", showoff: null },
};

/** Pick by mood: [went well, went badly, in between]. */
const by = <T,>(mood: Mood, up: T, down: T, even: T): T => (mood === "up" ? up : mood === "down" ? down : even);

/** The full moment for a choice. Every choice gets one. */
export function momentFor(text: string, sceneId: string, mood: Mood): Moment {
  const kind = momentKind(text, sceneId);
  const good = mood !== "down";
  const base = { kind, toThem: false };
  switch (kind) {
    case "sin":
      return { ...base, giverName: "Service Canada officer", style: "handover", prop: "letter", giver: "official", set: "office", caption: "Service Canada",
        title: "Social Insurance Number", lines: ["Name: {name}", "SIN: *** *** 274", "Keep this number private. You need it to work and to get paid."],
        look: "Nine digits. Now Canada knows I'm here to work.", showoff: "Snapping it for the family group chat. Number covered, of course." };
    case "ita":
      return { ...base, style: "screen", prop: "laptop", giver: null, set: "bedroom", caption: "Your inbox",
        title: "Invitation to Apply", lines: ["You have 60 days to submit your complete application.", "Upload your documents before the deadline."],
        look: "I got the ITA. Breathe. Sixty days.", showoff: "Screaming into a pillow so the neighbours don't hear." };
    case "portal":
      return { ...base, style: "screen", prop: "laptop", giver: null, set: "bedroom", caption: "The portal", ...PORTAL[mood] };
    case "passport":
      return { ...base, giverName: "Visa centre officer", style: "handover", prop: "passport", giver: "official", set: "office", caption: "Visa application centre",
        title: "Your passport is back", lines: ["A visa counterfoil is inside.", "Check every letter of your name."],
        look: "Every letter matches. It's real.", showoff: "Holding it like a trophy." };
    case "landing":
      return { ...base, giverName: "CBSA officer", style: "landing", prop: "passport", giver: "official", set: "office", caption: "Toronto Pearson",
        title: "Admitted", lines: ["Port of entry stamp", "Welcome to Canada."],
        look: good ? "Welcome to Canada. Those words hit different." : "Secondary inspection. My heart is pounding.",
        showoff: good ? "First selfie in the cold." : null };
    case "agent-cash":
      return { ...base, giverName: "The agent", toThem: true, style: "handover", prop: "cash", giver: "hustler", set: "agent-office", caption: "The agent's office",
        title: "Cash payment", lines: ["No receipt.", "No name.", "No refund."],
        look: "He didn't even count it in front of me…", showoff: null };
    case "shady":
      return { ...base, giverName: "The 'connect'", style: "handover", prop: "document", giver: "hustler", set: "agent-office", caption: "A quiet corner",
        title: "Too good to be true", lines: ["No name you can check.", "No receipt.", "Everything about this is a red flag."],
        look: "Something about this doesn't feel right…", showoff: null };
    case "transcript":
      return { ...base, giverName: "Registry officer", style: "handover", prop: "envelope", giver: "official", set: "office", caption: "The registry",
        title: "Official transcript", lines: ["Sealed and stamped by the registry.", "Do not open."],
        look: "Three months, four trips, one envelope.", showoff: good ? "Guarding it with my life." : null };
    case "offer":
      return { ...base, giverName: "The employer", style: "handover", prop: "letter", giver: "boss", set: "boardroom", caption: "The offer",
        title: "Offer of employment", lines: ["Start date: Monday.", "Please sign and return."],
        look: "A real offer. With my real name on it.", showoff: good ? "Framing this one." : null };
    case "paycheque":
      return { ...base, giverName: "Your supervisor", style: "handover", prop: "payslip", giver: "boss", set: "warehouse", caption: "Payday",
        title: "Pay stub", lines: ["Gross pay", "Deductions: CPP, EI, income tax", "Net pay"],
        look: "So this is what the deductions look like.", showoff: "First Canadian money. Half is going home." };
    case "payment":
      return { ...base, giverName: "The cashier", style: "handover", prop: "receipt", giver: "official", set: "office", caption: "The cashier",
        title: "Payment received", lines: ["{amount}", "Keep this receipt.", "Fees are non-refundable."],
        look: "Money gone. Receipt in hand. Let's go.", showoff: good ? "Filing this receipt with everything else." : null };
    case "shopping": {
      const phone = /phone|plan|sim\b/i.test(text);
      return { ...base, style: "handover", prop: phone ? "phone" : "bag", giver: "stranger", set: "toronto-street", caption: "The shop",
        title: "Receipt", lines: phone ? ["Phone plan", "SIM card"] : ["Winter coat", "Boots", "Gloves"],
        look: phone ? "Now I can call home properly." : "Expensive. But the cold doesn't negotiate.",
        showoff: phone ? "First Canadian number!" : "Dressed for the snow at last." };
    }
    case "call":
      return { ...base, style: "call", prop: "phone", giver: null, set: "bedroom", caption: "Calling…", title: "Calling…", lines: [], look: "", showoff: null };
    case "test":
      return { ...base, style: "desk", prop: "document", giver: null, set: "office", caption: "The test centre",
        title: by(mood, "Score report: target reached", "Score report: below target", "Booking confirmed"),
        lines: ["{choice}", by(mood, "Every band where it needs to be.", "One band short. It happens.", "Arrive 30 minutes early with your passport.")],
        look: by(mood, "I did it. I actually did it.", "One band. One band!", "Okay. It's on the calendar now."),
        showoff: good ? "Sending the score to everyone who doubted me." : null };
    case "customs":
      return { ...base, giverName: "Customs officer", style: "handover", prop: "document", giver: "official", set: "airport", caption: "Customs",
        title: "Declaration card", lines: ["Food, plants, animals?", "Currency over CAD 10,000?", "{choice}"],
        look: by(mood, "Declared. Nothing to hide, nothing to fear.", "That look on the officer's face…", "Next counter, please."),
        showoff: null };
    case "housing":
      return { ...base, giverName: "The landlord", style: "handover", prop: "keys", giver: "stranger", set: "toronto-street", caption: "Your new place",
        title: "Room agreement", lines: ["{choice}", by(mood, "Keys handed over. Lease signed.", "No lease. No receipt. Hmm.", "We'll see how it goes.")],
        look: by(mood, "Four walls and a lock. Mine.", "Three people, one bathroom. It's a start.", "It's a roof. For now."),
        showoff: good ? "First video tour for the family." : null };
    case "sell":
      return { ...base, giverName: "The buyer", toThem: true, style: "handover", prop: "keys", giver: "stranger", set: "lagos-street", caption: "The sale",
        title: "Bank alert", lines: ["{amount}", by(mood, "Credit confirmed in your bank app.", "The 'alert' was fake. No money arrived.", "Pending…")],
        look: by(mood, "The money is real. I checked twice.", "No credit. No car. No buyer.", "Pending. Why is it pending?"), showoff: null };
    case "transfer":
      return { ...base, style: "screen", prop: "phone", giver: null, set: null, caption: "Your bank app",
        title: by(mood, "Transfer successful", "Transfer failed", "Transfer pending"), lines: ["{amount}", "{choice}"],
        look: by(mood, "Sent. Now nobody can say I forgot them.", "Insufficient funds. Of course.", "Pending… pending… pending."),
        showoff: good ? "Screenshot of the receipt to the family group." : null };
    case "post":
      return { ...base, style: "screen", prop: "phone", giver: null, set: null, caption: "Your status",
        title: "Posted", lines: ["{choice}", by(mood, "❤️ 214  💬 38", "💬 'Who sent you?'", "👀 Seen by 42")],
        look: by(mood, "The comments are a whole celebration.", "Why did I post this?", "Everybody saw it. Nobody said anything."), showoff: null };
    case "verify":
      return { ...base, style: "screen", prop: "laptop", giver: null, set: null, caption: "Checking official sources",
        title: by(mood, "Verified ✓", "No record found", "Still checking"),
        lines: ["{choice}", by(mood, "It matches the official records.", "This name isn't on any official list.", "Compare it with the government's own page.")],
        look: by(mood, "Good. It's real.", "Glad I checked before I paid.", "Better ten minutes now than ten months later."),
        showoff: good ? "Warning the family group chat, with the link." : null };
    case "resign":
      return { ...base, giverName: "Your boss", toThem: true, style: "handover", prop: "letter", giver: "boss", set: "boardroom", caption: "The boss's office",
        title: "Letter", lines: ["{choice}", "Signed, {name}"],
        look: by(mood, "In writing. Signed. Done properly.", "He didn't even look up.", "He'll think about it, he says."), showoff: null };
    case "write":
      return { ...base, style: "desk", prop: "laptop", giver: null, set: "bedroom", caption: "Late night, typing",
        title: "Draft", lines: ["{choice}", "Read it once more. Then once more."],
        look: by(mood, "That's the one. That sounds like me.", "This isn't it. Delete. Again.", "Good enough for now."),
        showoff: good ? "Hitting send before I can change my mind." : null };
    case "apply":
      return { ...base, style: "screen", prop: "laptop", giver: null, set: null, caption: "Application",
        title: by(mood, "Application submitted", "Something went wrong", "Saved as draft"),
        lines: ["{choice}", by(mood, "Confirmation number issued. Keep it safe.", "Check your documents and try again.", "Finish it before the deadline.")],
        look: by(mood, "Submitted. No going back.", "Again? Fine. Again.", "Almost there."), showoff: good ? "Confirmation email, screenshotted." : null };
    case "study":
      return { ...base, style: "desk", prop: "notebook", giver: null, set: "bedroom", caption: "Study mode",
        title: "Study plan", lines: ["{choice}", "Day 1 ✓  Day 2 ✓  Day 3 …"],
        look: by(mood, "It's sticking. It's actually sticking.", "I've read this page five times.", "One more chapter, then sleep."), showoff: null };
    case "choose":
      return { ...base, style: "board", prop: "notebook", giver: null, set: "bedroom", caption: "The plan",
        title: "My pick", lines: ["{choice}"],
        look: by(mood, "That's where I'm going. I can see it.", "Was that the right one?", "Okay. That's the plan."),
        showoff: good ? "Pinned. Decided. Telling Mummy tonight." : null };
    case "gathering":
      return { ...base, style: "crowd", prop: "phone", giver: null, set: /church|faith/i.test(text) ? "church" : "living-room", caption: "Everybody's here",
        title: "", lines: [], look: by(mood, "These are my people.", "I should have stayed home.", "Small chops and small talk."), showoff: null };
    case "work":
      return { ...base, style: "work", prop: "box", giver: null, set: /uber|driv/i.test(text) ? "toronto-street" : /cafe/i.test(text) ? "cafe" : "warehouse",
        caption: "On shift", title: "", lines: [],
        look: by(mood, "Long shift. Good money.", "My back. My feet. My everything.", "Clock in. Clock out. Repeat."), showoff: null };
    case "travel":
      return { ...base, style: "ride", prop: "bag", giver: null, set: null, caption: "On the move",
        title: "", lines: [], look: by(mood, "Every trip gets me closer.", "Traffic. Again.", "Window seat, at least."), showoff: null };
    case "rest":
      return { ...base, style: "rest", prop: "phone", giver: null, set: "bedroom", caption: "Days pass",
        title: "", lines: [], look: by(mood, "I needed that.", "Days gone. Nothing done.", "Waiting is also a job."), showoff: null };
    case "talk":
      return { ...base, style: "talk", prop: "notepad", giver: null, set: null, caption: "Face to face",
        title: "", lines: [], look: "", showoff: null };
    default: // decide
      return { ...base, kind: "decide", style: "desk", prop: "notebook", giver: null, set: "bedroom", caption: "Decision time",
        title: "Decision", lines: ["{choice}"],
        look: by(mood, "Decided. No more overthinking.", "Maybe I should have thought longer.", "Okay. Let's see."), showoff: null };
  }
}

/** What they wrote on their notepad while you talked: their verdict, by who they are and how it went. */
export const NOTES: Record<string, Record<Mood, string>> = {
  official: { up: "Consistent. Credible.", down: "Story changed. Inconsistent.", even: "Needs more evidence." },
  boss: { up: "Strong fit. Follow up.", down: "Not ready.", even: "Maybe. Second interview?" },
  family: { up: "Proud of you 🙏🏾", down: "Pray about it", even: "Call me after" },
  friend: { up: "Legend.", down: "Omo…", even: "Hmm." },
  hustler: { up: "Too sharp. Next.", down: "Easy money.", even: "Call back tomorrow" },
  faith: { up: "Testimony loading!", down: "Seed of faith needed", even: "Pray and also plan" },
  stranger: { up: "Respect.", down: "Eyah.", even: "OK." },
};

/** A choice that triggers each moment, so every line a moment can show can be listed (for the translation check). */
const PROBES = ["Get your SIN", "invitation to apply", "Open the portal", "Start packing", "Land at Pearson", "Pay for a 'guaranteed visa'",
  "Ask a 'connect'", "Send the transcript", "Take the offer", "Spend your first paycheque", "Book IELTS", "Pay the fee", "Buy a winter coat",
  "Buy a phone plan", "Declare everything", "Take the basement bed", "Sell your car", "Send it home", "Post it on your status", "Check it",
  "Call home", "Ask HR", "Saskatchewan", "Rewrite the CV", "Apply for it", "Study tonight", "Go to the wedding", "Do the shift",
  "Catch another bus", "Sleep", "Tell the truth", "Hmm"];

export function allMomentLines(): string[] {
  const texts = new Set<string>();
  for (const probe of PROBES) {
    for (const mood of ["up", "down", "even"] as Mood[]) {
      const m = momentFor(probe, "", mood);
      [m.caption, m.giverName, m.title, ...m.lines, m.look, m.showoff].forEach((l) => l && !/^\{(choice|amount)\}$/.test(l) && texts.add(l));
    }
  }
  for (const n of Object.values(NOTES)) Object.values(n).forEach((l) => texts.add(l));
  return [...texts];
}
