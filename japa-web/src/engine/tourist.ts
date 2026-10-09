// The 180-Day Tourist Gamble: a visitor in Canada hunting for an employer
// willing to start an LMIA before their status runs out.
// Pure and deterministic: randomness comes in as `roll` values in [0, 1).
//
// All numbers are illustrative game values, not immigration or cost-of-living data.

export interface TouristState {
  day: number;
  daysLeft: number;
  energy: number;
  desperation: number;
  cad: number;
  network: number;
  resume: number;
  leads: number;
  location: string;
  status: "playing" | "won" | "lost";
  endReason: string;
  toast: Toast | null;
  log: LogEntry[];
}

export interface Toast {
  id: number;
  title: string;
  text: string;
  tone: "good" | "bad" | "neutral";
}

export interface LogEntry {
  day: number;
  action: string;
  text: string;
}

export interface TouristAction {
  id: string;
  label: string;
  blurb: string;
  days: number;
  energy: number; // negative = costs energy
  cad: number; // negative = costs money
  desperation: number;
  network?: number;
  resume?: number;
  /** Chance of an employer lead, before network and resume bonuses. */
  leadChance?: number;
  location: string;
  /** Ends the run on the spot: things a visitor must never do. */
  fatal?: string;
  quips: string[];
  leadQuips?: string[];
}

export const START_DAYS = 180;
export const LEADS_TO_WIN = 3;
export const DAILY_COST_CAD = 20;
/** Illustrative parallel-market rate; real rates move daily. */
export const NGN_PER_CAD = 1150;

export const ACTIONS: TouristAction[] = [
  {
    id: "job_fair",
    label: "Attend In-Person Tech/Job Fair",
    blurb: "Metro Toronto Convention Centre",
    days: 1, energy: -30, cad: -25, desperation: -3, network: 8, leadChance: 0.3,
    location: "Metro Toronto Convention Centre",
    quips: [
      "You collected 14 tote bags, 3 stress balls and one real business card. It belongs to a recruiter from your own village.",
      "A booth handed you a free hoodie. It is the warmest thing you own.",
      "You queued 40 minutes for the Shopify booth. They were out of stickers and jobs.",
    ],
    leadQuips: [
      "A logistics director asked for your CV, then your WhatsApp. Then actually replied. Lead acquired.",
    ],
  },
  {
    id: "cold_message",
    label: "Cold Message 10 Hiring Managers",
    blurb: "LinkedIn, from your cousin's couch",
    days: 1, energy: -15, cad: 0, desperation: 2, leadChance: 0.12,
    location: "Cousin's couch, Brampton",
    quips: [
      "9 left you on 'seen'. One replied: 'Wrong person, I sell insurance. Are you covered?'",
      "LinkedIn suggested you 'Open to Work' harder. You are already wearing the green banner like a cape.",
      "A recruiter replied with a thumbs-up emoji and nothing else. You have analysed it for three hours.",
    ],
    leadQuips: [
      "An operations manager in Mississauga wrote back: 'Can you talk Thursday?' You screamed into a cushion.",
    ],
  },
  {
    id: "mentor_coffee",
    label: "Coffee Chat with a Naija-Canadian Mentor",
    blurb: "Tim Hortons, double-double on you",
    days: 1, energy: -10, cad: -8, desperation: -6, network: 12, leadChance: 0.08,
    location: "Tim Hortons, Square One",
    quips: [
      "She has been here 11 years. Her first advice: 'Buy proper boots.' Her second: 'Stop saying sir.'",
      "He spent 40 minutes on Canadian work culture and 20 on why Jollof here is a scandal.",
    ],
    leadQuips: ["Your mentor forwarded your CV to her old manager. 'He owes me a favour.'"],
  },
  {
    id: "resume",
    label: "Canadianize Your Resume",
    blurb: "Delete the passport photo, add metrics",
    days: 1, energy: -20, cad: 0, desperation: -2, resume: 15,
    location: "Brampton Public Library",
    quips: [
      "You removed your photo, date of birth and state of origin. It already looks 40% more Canadian.",
      "Your 4-page CV is now 2 pages. You mourn the loss of 'Hobbies: Reading and Travelling'.",
    ],
  },
  {
    id: "rest",
    label: "Rest on Cousin's Couch",
    blurb: "Recover energy, absorb the side-eye",
    days: 1, energy: 40, cad: -15, desperation: 4,
    location: "Cousin's couch, Brampton",
    quips: [
      "Your cousin's wife asked, very politely, about 'your timeline'.",
      "You slept 11 hours. The kids have started calling you 'Uncle Couch'.",
    ],
  },
  {
    id: "cash_job",
    label: "Take a Cash Warehouse Shift (Under the Table)",
    blurb: "CAD 150, no questions asked",
    days: 1, energy: -40, cad: 150, desperation: 0,
    location: "Unmarked warehouse, Etobicoke",
    fatal: "Working without authorization on visitor status. It can lead to removal and a ban on returning. Game over.",
    quips: ["The 'no questions asked' part lasted until the inspection."],
  },
];

export function newTourist(): TouristState {
  return {
    day: 1, daysLeft: START_DAYS, energy: 100, desperation: 25, cad: 2500,
    network: 0, resume: 0, leads: 0, location: "Pearson Airport, Terminal 3",
    status: "playing", endReason: "", toast: null, log: [],
  };
}

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

export function leadChance(state: TouristState, action: TouristAction): number {
  if (!action.leadChance) return 0;
  const bonus = 1 + state.network / 60 + state.resume / 50;
  return Math.min(0.75, action.leadChance * bonus);
}

export function canTake(state: TouristState, action: TouristAction): boolean {
  if (state.status !== "playing") return false;
  if (action.energy < 0 && state.energy + action.energy < 0) return false;
  if (action.cad < 0 && state.cad + action.cad < 0) return false;
  return true;
}

export const ngn = (cad: number) => cad * NGN_PER_CAD;

/** Takes `actionId`. `rolls` = [lead roll, quip roll], each in [0, 1). */
export function takeAction(state: TouristState, actionId: string, rolls: [number, number]): TouristState {
  const action = ACTIONS.find((a) => a.id === actionId);
  if (!action || !canTake(state, action)) return state;
  const [leadRoll, quipRoll] = rolls;
  const toastId = (state.toast?.id ?? 0) + 1;

  if (action.fatal) {
    const text = action.quips[0];
    return {
      ...state, location: action.location, status: "lost", endReason: action.fatal,
      toast: { id: toastId, title: action.label, text, tone: "bad" },
      log: [{ day: state.day, action: action.label, text }, ...state.log],
    };
  }

  const gotLead = leadRoll < leadChance(state, action);
  const pool = gotLead && action.leadQuips?.length ? action.leadQuips : action.quips;
  const text = pool[Math.floor(quipRoll * pool.length) % pool.length];

  let next: TouristState = {
    ...state,
    day: state.day + action.days,
    daysLeft: Math.max(0, state.daysLeft - action.days),
    energy: clamp(state.energy + action.energy),
    desperation: clamp(state.desperation + action.desperation + (gotLead ? -10 : 0)),
    cad: Math.max(0, state.cad + action.cad - DAILY_COST_CAD * action.days),
    network: state.network + (action.network ?? 0),
    resume: Math.min(60, state.resume + (action.resume ?? 0)),
    leads: state.leads + (gotLead ? 1 : 0),
    location: action.location,
    toast: { id: toastId, title: gotLead ? "Employer lead!" : action.label, text, tone: gotLead ? "good" : action.desperation > 0 ? "bad" : "neutral" },
    log: [{ day: state.day, action: action.label, text }, ...state.log].slice(0, 30),
  };

  // Desperation creeps up as the clock runs down.
  if (next.daysLeft <= 60) next = { ...next, desperation: clamp(next.desperation + 2) };

  if (next.leads >= LEADS_TO_WIN) {
    next = { ...next, status: "won", endReason: "Mr. Kovacs at Northline Logistics wants to meet you. The LMIA interview is unlocked." };
  } else if (next.cad <= 0) {
    next = { ...next, status: "lost", endReason: "Out of money. You book the cheapest flight back to Lagos." };
  } else if (next.daysLeft <= 0) {
    next = { ...next, status: "lost", endReason: "Your authorized stay is over. Without an offer or an approved extension, it is time to leave." };
  } else if (next.desperation >= 100) {
    next = { ...next, status: "lost", endReason: "Desperation hit 100. You stop sleeping, stop eating, and stop making good decisions." };
  }
  return next;
}
