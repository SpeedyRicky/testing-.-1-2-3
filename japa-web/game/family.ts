// The relative in Canada the player keeps calling: a sister, brother or aunty whose name matches
// the player's heritage (guessed from the username), living in a randomly chosen province.
// Pure: randomness comes in as a function, so the rules are unit-tested.

export type Heritage = "igbo" | "yoruba" | "hausa" | "other";
export type Relation = "sister" | "brother" | "aunty";

export interface Relative {
  heritage: Heritage;
  relation: Relation;
  /** First name only; aunties get "Aunty" added when shown. */
  name: string;
  provinceCode: string;
  city: string;
}

export const HERITAGES: { id: Heritage; label: string }[] = [
  { id: "igbo", label: "Igbo" }, { id: "yoruba", label: "Yoruba" }, { id: "hausa", label: "Hausa" },
  { id: "other", label: "Other Nigerian" },
];
export const RELATIONS: { id: Relation; label: string }[] = [
  { id: "sister", label: "Sister" }, { id: "brother", label: "Brother" }, { id: "aunty", label: "Aunty" },
];

// --- Heritage from a name ---------------------------------------------------------

const NAMES: Record<Exclude<Heritage, "other">, string[]> = {
  igbo: [
    "ada", "adaeze", "adanna", "adaora", "amaka", "azubuike", "chiamaka", "chibuzor", "chidi", "chidike", "chika",
    "chimamanda", "chinedu", "chinonso", "chioma", "chisom", "ebere", "ebuka", "emeka", "eze", "ezinne", "ifeanyi",
    "ifeoma", "ikechukwu", "ikenna", "kamsi", "kelechi", "kosi", "ngozi", "nkechi", "nkiru", "nnamdi", "nneka",
    "nnenna", "obi", "obinna", "obiora", "ogechi", "okafor", "okechukwu", "okonkwo", "oluchi", "onyeka", "somto",
    "tochukwu", "uche", "uchenna", "ugochi", "chukwudi", "chukwuma", "nonso", "ebube", "munachi", "chinwe",
  ],
  yoruba: [
    "adeola", "ayo", "ayomide", "bayo", "bimpe", "bisi", "bola", "busola", "damilola", "damola", "dapo", "dayo",
    "deji", "dupe", "ebun", "femi", "folake", "funke", "funmi", "gbenga", "idowu", "iyabo", "jide", "kayode",
    "kehinde", "kemi", "kunle", "lanre", "mayowa", "niyi", "ope", "remi", "ronke", "sade", "segun", "seun",
    "shola", "simi", "sola", "taiwo", "temi", "tobi", "tolu", "tomiwa", "tope", "toyin", "tunde", "wale", "wumi",
    "wunmi", "yemi", "yinka", "ifeoluwa", "titi", "lola", "bukola", "yetunde", "fola", "kola", "dotun", "tosin",
  ],
  hausa: [
    "abubakar", "adamu", "ahmed", "aisha", "aliyu", "amina", "aminu", "auwal", "bashir", "bello", "bilkisu",
    "danjuma", "fatima", "garba", "hadiza", "halima", "hassan", "hauwa", "hussain", "ibrahim", "idris", "jamila",
    "kabiru", "lawal", "maryam", "mohammed", "muhammad", "murtala", "musa", "mustapha", "nasir", "nuhu", "rabiu",
    "sadiq", "salisu", "sani", "shehu", "suleiman", "umar", "usman", "yakubu", "yusuf", "zainab", "zara", "lami",
  ],
};

// Checked in this order, after the exact names above.
const PREFIXES: [Heritage, RegExp][] = [
  ["hausa", /^(abdul|muham|moham|aminu|hauwa|dan(ju|la))/],
  ["yoruba", /^(ade|ola|olu(wa|se|mi|fe|ba|ka|de|ye|ro)|ayo|oye|ibuk|tolu|temi|tomi|tobi|funm|femi|dami|fola|kola|yemi|seun|bab[at])/],
  ["igbo", /^(chi|chukwu|nn|ng|ife(a|o[mc])|uche|ugo|obi|ike|ebu|nk|oke|onye|ezi|ada)/],
];
const SUFFIXES: [Heritage, RegExp][] = [
  ["yoruba", /(ola|wale|femi|luwa|mide|tunde|kunle|dele|funmi|lope|kemi|yinka|seun|bayo|ade)$/],
  ["igbo", /(chukwu|chi|nna|eze|nwa|amaka)$/],
];

/**
 * Guesses heritage from the first word of a username ("Chidike_01" → igbo). Names that do not match fall back
 * to the player's region: south-east → Igbo, south-west → Yoruba, north-west/north-east → Hausa.
 */
export function detectHeritage(username: string, region?: string): Heritage {
  const word = username.trim().toLowerCase().split(/[\s_0-9]+/)[0] ?? "";
  for (const h of ["igbo", "yoruba", "hausa"] as const) if (NAMES[h].includes(word)) return h;
  if (word.length >= 3) {
    for (const [h, re] of PREFIXES) if (re.test(word)) return h;
    for (const [h, re] of SUFFIXES) if (re.test(word)) return h;
  }
  if (region === "SE") return "igbo";
  if (region === "SW") return "yoruba";
  if (region === "NW" || region === "NE") return "hausa";
  return "other";
}

// --- Names for the relative ---------------------------------------------------------

export const RELATIVE_NAMES: Record<Heritage, Record<Relation, string[]>> = {
  igbo: {
    sister: ["Adaeze", "Chiamaka", "Ngozi", "Nkechi", "Chioma", "Ifeoma", "Amaka", "Ugochi", "Ezinne", "Adanna", "Nneka", "Chinwe"],
    brother: ["Chinedu", "Emeka", "Obinna", "Ikenna", "Ifeanyi", "Nnamdi", "Kelechi", "Uchenna", "Chukwudi", "Ebuka"],
    aunty: ["Ngozi", "Nkiru", "Uju", "Chinwe", "Obiageli", "Ifeyinwa", "Ebele"],
  },
  yoruba: {
    sister: ["Funmilayo", "Folake", "Bukola", "Yetunde", "Adeola", "Titilayo", "Omotola", "Damilola", "Bisola", "Morenike"],
    brother: ["Tunde", "Segun", "Femi", "Kunle", "Gbenga", "Dapo", "Kayode", "Babatunde", "Olumide", "Deji"],
    aunty: ["Bisi", "Funke", "Yemisi", "Kemi", "Ronke", "Sade", "Iyabo"],
  },
  hausa: {
    sister: ["Aisha", "Hauwa", "Zainab", "Hadiza", "Amina", "Halima", "Bilkisu", "Fatima"],
    brother: ["Musa", "Abubakar", "Aminu", "Sani", "Usman", "Yusuf", "Kabiru", "Nasir"],
    aunty: ["Hajara", "Lami", "Hadiza", "Rakiya", "Asabe", "Larai"],
  },
  other: {
    sister: ["Efe", "Ese", "Eno", "Ivie", "Tamara", "Ufuoma", "Ebiere", "Mfon"],
    brother: ["Osas", "Ebi", "Terver", "Ime", "Oghenero", "Tamuno", "Etim"],
    aunty: ["Ekaette", "Ivie", "Ese", "Doowuese", "Arit"],
  },
};

// --- Where in Canada ------------------------------------------------------------------

export interface Province {
  code: string;
  name: string;
  cities: string[];
  /** Hours behind Nigeria (WAT) in winter. */
  behind: number;
  /** What the call shows behind the relative. */
  scenery: "city" | "mountains" | "prairie" | "harbour";
  weather: string;
}

export const PROVINCES: Province[] = [
  { code: "ON", name: "Ontario", cities: ["Toronto", "Ottawa", "Brampton", "Mississauga", "Hamilton"], behind: 6, scenery: "city", weather: "grey slush" },
  { code: "QC", name: "Quebec", cities: ["Montreal", "Quebec City"], behind: 6, scenery: "city", weather: "snow on the outdoor stairs" },
  { code: "AB", name: "Alberta", cities: ["Calgary", "Edmonton"], behind: 8, scenery: "mountains", weather: "-25°C and bright sun" },
  { code: "BC", name: "British Columbia", cities: ["Vancouver", "Surrey", "Victoria"], behind: 9, scenery: "mountains", weather: "rain, again" },
  { code: "MB", name: "Manitoba", cities: ["Winnipeg", "Brandon"], behind: 7, scenery: "prairie", weather: "-30°C at the bus stop" },
  { code: "SK", name: "Saskatchewan", cities: ["Saskatoon", "Regina"], behind: 7, scenery: "prairie", weather: "flat white prairie" },
  { code: "NS", name: "Nova Scotia", cities: ["Halifax"], behind: 5, scenery: "harbour", weather: "harbour fog" },
  { code: "NB", name: "New Brunswick", cities: ["Moncton", "Fredericton", "Saint John"], behind: 5, scenery: "harbour", weather: "wet snow" },
  { code: "NL", name: "Newfoundland and Labrador", cities: ["St. John's"], behind: 4.5, scenery: "harbour", weather: "wind off the Atlantic" },
  { code: "PE", name: "Prince Edward Island", cities: ["Charlottetown"], behind: 5, scenery: "harbour", weather: "snow over red fields" },
];

export const provinceFor = (code: string) => PROVINCES.find((p) => p.code === code) ?? PROVINCES[0];

/** A number in [0, 1) for each call, from a seed: same username, same relative. */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(items: T[], rand: () => number) => items[Math.min(items.length - 1, Math.floor(rand() * items.length))];

/** A relative of the given heritage in a random province; the name never repeats the player's own. */
export function makeRelative(heritage: Heritage, rand: () => number, relation?: Relation, playerName = ""): Relative {
  const rel = relation ?? pick(["sister", "sister", "brother", "aunty"] as Relation[], rand);
  const own = playerName.trim().toLowerCase().split(/[\s_0-9]+/)[0];
  const pool = RELATIVE_NAMES[heritage][rel].filter((n) => n.toLowerCase() !== own);
  const province = pick(PROVINCES, rand);
  return { heritage, relation: rel, name: pick(pool, rand), provinceCode: province.code, city: pick(province.cities, rand) };
}

/** Siblings who are citizens or permanent residents earn Express Entry points; aunties do not. */
export const isSibling = (r: Relative) => r.relation === "sister" || r.relation === "brother";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const HOURS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** Words for scenes: {relName}, {RelWho}, {relCity}, {relSubj}... */
export function relativeVars(r: Relative): Record<string, string> {
  const p = provinceFor(r.provinceCode);
  const male = r.relation === "brother";
  const name = r.relation === "aunty" ? `Aunty ${r.name}` : r.name;
  const title = r.relation === "sister" ? `Sister ${r.name}` : r.relation === "brother" ? `Brother ${r.name}` : name;
  const who = r.relation === "aunty" ? `your ${name}` : `your ${r.relation} ${r.name}`;
  const gap = Number.isInteger(p.behind) ? `${HOURS[p.behind]} hours` : `${HOURS[Math.floor(p.behind)]} and a half hours`;
  const vars: Record<string, string> = {
    relName: name,
    relTitle: title,
    relWho: who,
    relKin: r.relation,
    relCity: r.city,
    relProvince: p.name,
    relPlace: `${r.city}, ${p.name}`,
    relWeather: p.weather,
    relGap: `${gap} behind`,
    relSubj: male ? "he" : "she",
    relObj: male ? "him" : "her",
    relPoss: male ? "his" : "her",
  };
  for (const k of ["relName", "relTitle", "relWho", "relSubj", "relPoss"]) vars[`R${k.slice(1)}`] = cap(vars[k]);
  return vars;
}

// --- Home life: faith community and the parent who calls ---------------------------

export type Faith = "church" | "masjid";

/** Church or masjid, by heritage: Hausa players pray at a masjid, Yoruba families split, others mostly church. */
export function faithFor(heritage: Heritage, rand: () => number): Faith {
  if (heritage === "hausa") return "masjid";
  if (heritage === "yoruba") return rand() < 0.45 ? "masjid" : "church";
  if (heritage === "other") return rand() < 0.3 ? "masjid" : "church";
  return "church";
}

const PARENT: Record<Heritage, string> = { hausa: "Umma", yoruba: "Mummy", igbo: "Mama", other: "Mummy" };

/** Words for home life: {faithHub}, {faithGroup}, {faithDay}, {parent}. */
export function homeVars(heritage: Heritage, faith: Faith): Record<string, string> {
  const masjid = faith === "masjid";
  return {
    faithHub: masjid ? "masjid" : "church",
    FaithHub: masjid ? "Masjid" : "Church",
    faithGroup: masjid ? "masjid youth circle" : "church choir",
    faithDay: masjid ? "Jumu'ah" : "Sunday service",
    faithLeader: masjid ? "the imam" : "the pastor",
    parent: PARENT[heritage],
  };
}

// --- The Kawosoke backstory: what actually happened at home ------------------------

/** 0 nothing (came for work), 1 outed as LGBTQ, 2 partner violence, 3 targeted by armed groups. */
export type KwTruth = 0 | 1 | 2 | 3;

/**
 * Each character has one true story, fixed by their profile, so an asylum claim is either theirs or invented.
 * Most visitors are not fleeing anything; people from conflict states often are.
 */
export function kwTruthFor(conflictState: boolean, rand: () => number): KwTruth {
  const r = rand();
  if (conflictState) return r < 0.6 ? 3 : r < 0.7 ? 1 : r < 0.8 ? 2 : 0;
  return r < 0.15 ? 1 : r < 0.3 ? 2 : 0;
}

const KW_STORY: Record<KwTruth, string> = {
  0: "Nobody at home wants to harm you. You came for work, and you know it.",
  1: "Last year you were outed in {area}. Your photo still circulates in a vigilante WhatsApp group.",
  2: "Your ex-partner's threats followed you to three addresses. The police said 'settle it at home'.",
  3: "Gunmen attacked your community in {state} last year. They know your family's name.",
};
export const kwStory = (t: KwTruth) => KW_STORY[t];
