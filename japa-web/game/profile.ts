// The player's profile: who they are, what they look like, where they live.
// Pure functions turn it into starting stats for each route and words for each scene.
import type { GameState, RouteId } from "./types";
import { placeFor, placeVars } from "./nigeria";
import { detectHeritage, isSibling, makeRelative, relativeVars, seededRandom, type Relative } from "./family";

export type BodySize = "slim" | "average" | "plus";
export type HairStyle = "low-cut" | "afro" | "braids" | "bun" | "bald";
export type Outfit = "tee-jeans" | "ankara-dress" | "buba-iro" | "agbada" | "senator" | "suit" | "hoodie";
export type Headwear = "none" | "gele" | "fila" | "headwrap" | "beanie";

export interface Avatar {
  skin: string;
  body: BodySize;
  hair: HairStyle;
  hairColor: string;
  outfit: Outfit;
  outfitColor: string;
  headwear: Headwear;
  headwearColor: string;
  glasses: boolean;
}

export type Institution = "university" | "polytechnic" | "college-of-education";
export type Level = "100" | "200" | "300" | "400" | "500" | "graduated";
export type Cgpa = "first" | "2-1" | "2-2" | "third";
export type Qualification = "ssce" | "ond" | "hnd" | "bachelors" | "masters" | "phd";
export type SalaryBand = "under-150k" | "150k-400k" | "400k-1m" | "over-1m";

export interface StudentDetails { institution: Institution; course: string; level: Level; cgpa: Cgpa }
export interface WorkerDetails { occupation: string; years: number; qualification: Qualification; salary: SalaryBand }

export interface PlayerProfile {
  version: 1;
  username: string;
  avatar: Avatar;
  role: "student" | "worker";
  age: number;
  stateCode: string;
  student?: StudentDetails;
  worker?: WorkerDetails;
  /** The relative in Canada; profiles saved before it existed get one from their username. */
  family?: Relative;
}

// --- Options shown in the sign-up flow -----------------------------------------------

export const SKIN_TONES = ["#5b3410", "#6d3416", "#7c3a12", "#8d4a24", "#a0613a", "#b07850"];
export const HAIR_COLORS = ["#111827", "#3f2a14", "#7c2d12", "#a8a29e"];
export const OUTFIT_COLORS = ["#16a34a", "#2563eb", "#dc2626", "#7c3aed", "#f59e0b", "#0f172a", "#db2777", "#0d9488"];
export const OUTFITS: { id: Outfit; label: string }[] = [
  { id: "tee-jeans", label: "T-shirt & jeans" },
  { id: "ankara-dress", label: "Ankara dress" },
  { id: "buba-iro", label: "Buba & iro" },
  { id: "agbada", label: "Agbada" },
  { id: "senator", label: "Senator" },
  { id: "suit", label: "Suit" },
  { id: "hoodie", label: "Hoodie" },
];
export const HAIRSTYLES: { id: HairStyle; label: string }[] = [
  { id: "low-cut", label: "Low cut" }, { id: "afro", label: "Afro" }, { id: "braids", label: "Braids" },
  { id: "bun", label: "Bun" }, { id: "bald", label: "Bald" },
];
export const HEADWEAR: { id: Headwear; label: string }[] = [
  { id: "none", label: "None" }, { id: "gele", label: "Gele" }, { id: "fila", label: "Fila" },
  { id: "headwrap", label: "Headwrap" }, { id: "beanie", label: "Beanie" },
];
export const BODY_SIZES: { id: BodySize; label: string }[] = [
  { id: "slim", label: "Slim" }, { id: "average", label: "Average" }, { id: "plus", label: "Plus" },
];

export const COURSES = [
  "Computer Science", "Software Engineering", "Nursing", "Medicine & Surgery", "Pharmacy", "Accounting",
  "Economics", "Business Administration", "Banking & Finance", "Mechanical Engineering", "Electrical Engineering",
  "Civil Engineering", "Chemical Engineering", "Microbiology", "Biochemistry", "Mass Communication", "Law",
  "Agriculture", "Architecture", "Estate Management", "Education", "Other",
];

export const OCCUPATIONS: { id: string; label: string; article: string }[] = [
  { id: "software", label: "software developer", article: "a" },
  { id: "data", label: "data analyst", article: "a" },
  { id: "nurse", label: "registered nurse", article: "a" },
  { id: "doctor", label: "medical doctor", article: "a" },
  { id: "pharmacist", label: "pharmacist", article: "a" },
  { id: "accountant", label: "accountant", article: "an" },
  { id: "banker", label: "banker", article: "a" },
  { id: "logistics", label: "logistics analyst", article: "a" },
  { id: "engineer", label: "engineer", article: "an" },
  { id: "teacher", label: "teacher", article: "a" },
  { id: "electrician", label: "electrician", article: "an" },
  { id: "marketing", label: "sales and marketing executive", article: "a" },
  { id: "civil-servant", label: "civil servant", article: "a" },
  { id: "entrepreneur", label: "small business owner", article: "a" },
  { id: "other", label: "professional", article: "a" },
];

export const LEVELS: { id: Level; label: string }[] = [
  { id: "100", label: "100 level" }, { id: "200", label: "200 level" }, { id: "300", label: "300 level" },
  { id: "400", label: "400 level" }, { id: "500", label: "500 level" }, { id: "graduated", label: "Graduated" },
];

export const QUALIFICATIONS: { id: Qualification; label: string }[] = [
  { id: "ssce", label: "SSCE / WAEC" }, { id: "ond", label: "OND" }, { id: "hnd", label: "HND" },
  { id: "bachelors", label: "Bachelor's degree" }, { id: "masters", label: "Master's degree" }, { id: "phd", label: "PhD" },
];

export const SALARY_BANDS: { id: SalaryBand; label: string; monthly: number }[] = [
  { id: "under-150k", label: "Under ₦150k a month", monthly: 100000 },
  { id: "150k-400k", label: "₦150k – ₦400k", monthly: 275000 },
  { id: "400k-1m", label: "₦400k – ₦1m", monthly: 700000 },
  { id: "over-1m", label: "Over ₦1m", monthly: 1500000 },
];

export const CGPAS: { id: Cgpa; label: string; standing: number }[] = [
  { id: "first", label: "First class", standing: 85 },
  { id: "2-1", label: "Second class upper", standing: 72 },
  { id: "2-2", label: "Second class lower", standing: 58 },
  { id: "third", label: "Third class / pass", standing: 45 },
];

/** Illustrative parallel-market rate, as used elsewhere in the game. */
export const NGN_PER_CAD = 1150;

export const DEFAULT_AVATAR: Avatar = {
  skin: "#8d4a24", body: "average", hair: "low-cut", hairColor: "#111827", outfit: "tee-jeans",
  outfitColor: "#16a34a", headwear: "none", headwearColor: "#f59e0b", glasses: false,
};

// --- Profile -> game ---------------------------------------------------------------

export interface GameProfile {
  /** CRS education code (see RouteStats.educationLevel). Simplified ECA equivalents. */
  educationLevel: number;
  hasDegree: boolean;
  foreignWorkYears: number;
  savingsNgn: number;
  savingsCad: number;
  academicStanding: number;
  educationPhrase: string;
  experiencePhrase: string;
  occupation: string;
  roleLine: string;
}

const QUAL_LEVEL: Record<Qualification, number> = { ssce: 1, ond: 3, hnd: 3, bachelors: 4, masters: 6, phd: 7 };
const QUAL_PHRASE: Record<Qualification, string> = {
  ssce: "your SSCE results", ond: "an OND", hnd: "an HND", bachelors: "a bachelor's degree",
  masters: "a master's degree", phd: "a PhD",
};

export function deriveGameProfile(p: PlayerProfile): GameProfile {
  if (p.role === "student" && p.student) {
    const s = p.student;
    const graduated = s.level === "graduated";
    // HND and NCE holders are usually assessed as diplomas rather than degrees.
    const level = !graduated ? 1 : s.institution === "university" ? 4 : 3;
    const credential = s.institution === "university" ? "a B.Sc." : s.institution === "polytechnic" ? "an HND" : "an NCE";
    const savingsNgn = graduated ? 600000 : 400000;
    return {
      educationLevel: level,
      hasDegree: level >= 4,
      foreignWorkYears: 0,
      savingsNgn,
      savingsCad: Math.round(savingsNgn / NGN_PER_CAD),
      academicStanding: CGPAS.find((c) => c.id === s.cgpa)?.standing ?? 60,
      educationPhrase: graduated ? `${credential} in ${s.course}` : `a ${s.level}-level transcript in ${s.course}`,
      experiencePhrase: "no full-time work experience yet (Federal Skilled Worker needs at least one year)",
      occupation: graduated ? `a ${s.course} graduate` : `a ${s.course} student`,
      roleLine: graduated ? `${s.course} graduate` : `${s.level}-level ${s.course} student`,
    };
  }
  const w = p.worker ?? { occupation: "other", years: 2, qualification: "bachelors" as Qualification, salary: "150k-400k" as SalaryBand };
  const occ = OCCUPATIONS.find((o) => o.id === w.occupation) ?? OCCUPATIONS[OCCUPATIONS.length - 1];
  const monthly = SALARY_BANDS.find((b) => b.id === w.salary)?.monthly ?? 275000;
  // Rough savings: a few months of pay plus a little more for each year worked.
  const savingsNgn = Math.round(monthly * (4 + Math.min(w.years, 10) * 1.2));
  const years = Math.max(0, Math.round(w.years));
  return {
    educationLevel: QUAL_LEVEL[w.qualification],
    hasDegree: QUAL_LEVEL[w.qualification] >= 4,
    foreignWorkYears: years,
    savingsNgn,
    savingsCad: Math.round(savingsNgn / NGN_PER_CAD),
    academicStanding: 60,
    educationPhrase: QUAL_PHRASE[w.qualification],
    experiencePhrase: years === 0 ? "less than a year of work experience" : `${years} year${years === 1 ? "" : "s"} as ${occ.article} ${occ.label}`,
    occupation: `${occ.article} ${occ.label}`,
    roleLine: `${occ.label}, ${years} yr${years === 1 ? "" : "s"}`,
  };
}

/** The player's relative in Canada: the saved one, or a steady pick from the username and state. */
export function familyFor(p: Pick<PlayerProfile, "username" | "stateCode" | "family"> | null): Relative {
  if (p?.family) return p.family;
  const username = p?.username ?? "Tolu";
  const stateCode = p?.stateCode ?? "LA";
  const heritage = detectHeritage(username, placeFor(stateCode).region);
  return makeRelative(heritage, seededRandom(`${username.toLowerCase()}|${stateCode}`), undefined, username);
}

/** States with insurgency, banditry or herder-farmer violence: an asylum claim from here can be the player's own story. */
export const CONFLICT_STATES: ReadonlySet<string> = new Set(["BO", "YO", "AD", "ZA", "KT", "KD", "SO", "NI", "BE", "PL"]);

/** Express Entry 2026 category for the player's job: 1 healthcare, 2 STEM, 3 trades, 4 education. */
const EE_CATEGORY: Record<string, number> = {
  nurse: 1, doctor: 1, pharmacist: 1, software: 2, data: 2, engineer: 2, electrician: 3, teacher: 4,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Starting-state overrides per route, layered over each route's defaults. */
export function routePatches(p: PlayerProfile): Partial<Record<RouteId, Partial<GameState>>> {
  const g = deriveGameProfile(p);
  const place = placeVars(placeFor(p.stateCode));
  const where = `${place.area}, ${place.city}`;
  return {
    NIGERIA_LIFE: {
      currentLocation: where,
      walletNgn: clamp(g.savingsNgn, 200000, 2000000),
      routeStats: { papers: g.hasDegree ? 24 : 18 },
    },
    EXPRESS_ENTRY: {
      currentLocation: where,
      walletCad: clamp(g.savingsCad, 1500, 30000),
      routeStats: {
        ageYears: p.age, educationLevel: g.educationLevel, foreignWorkYears: g.foreignWorkYears,
        ecaComplete: 0, clbFirst: 0, nclcFrench: 0, canadianWorkYears: 0, canadianEducation: 0,
        pnpNomination: 0, siblingInCanada: isSibling(familyFor(p)) ? 1 : 0,
        eeCategory: p.role === "worker" && p.worker && p.worker.years >= 1 ? EE_CATEGORY[p.worker.occupation] ?? 0 : 0,
      },
    },
    STUDY_PERMIT: {
      currentLocation: where,
      walletCad: clamp(g.savingsCad, 1000, 40000),
      routeStats: { academicStanding: g.academicStanding, hasDegree: g.hasDegree ? 1 : 0 },
    },
    TOURIST_GAMBLE: {
      walletCad: clamp(g.savingsCad, 1500, 6000),
      routeStats: { conflictRegion: CONFLICT_STATES.has(p.stateCode) ? 1 : 0 },
    },
  };
}

/** All words a scene can fill in: place, person and profile. */
export function profileVars(p: PlayerProfile | null): Record<string, string> {
  const place = { ...placeVars(placeFor(p?.stateCode ?? "LA")), ...relativeVars(familyFor(p)) };
  if (!p) {
    return { ...place, name: "Tolu", age: "29", educationPhrase: "a B.Sc.", experiencePhrase: "three years as a logistics analyst", occupation: "a logistics analyst" };
  }
  const g = deriveGameProfile(p);
  return {
    ...place,
    name: p.username,
    age: String(p.age),
    educationPhrase: g.educationPhrase,
    experiencePhrase: g.experiencePhrase,
    occupation: g.occupation,
  };
}

/** Replaces {placeholders}; unknown names are left as they are so tests can catch them. */
export function fillText(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

// --- Validation --------------------------------------------------------------------

export function usernameProblem(name: string): string | null {
  const n = name.trim();
  if (n.length < 2) return "Use at least 2 characters.";
  if (n.length > 16) return "Use 16 characters or fewer.";
  if (!/^[A-Za-z][A-Za-z0-9_ ]*$/.test(n)) return "Start with a letter; use letters, numbers, spaces or _.";
  return null;
}

export function profileProblem(p: Partial<PlayerProfile>): string | null {
  if (!p.username || usernameProblem(p.username)) return "Choose a username.";
  if (!p.age || p.age < 16 || p.age > 60) return "Enter an age between 16 and 60.";
  if (!p.stateCode) return "Choose your state.";
  if (p.role === "student" && !p.student?.course) return "Choose your course.";
  if (p.role === "worker" && !p.worker?.occupation) return "Choose your job.";
  return null;
}
