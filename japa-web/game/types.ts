// The game's data contract. Scenes, routes and actions live in scenarios.json;
// components only render what these types describe.

export type RouteId =
  | "NIGERIA_LIFE"
  | "STUDY_PERMIT"
  | "EXPRESS_ENTRY"
  | "STARTUP_VISA"
  | "CAREGIVER_LMIA"
  | "TARGETED_TRADE"
  | "TOURIST_GAMBLE"
  | "FIRST_YEAR"
  | "PNP_RURAL";

export type LayoutType = "STORY_STAGE" | "ZOOM_GRID" | "CORPORATE_OFFICE" | "DASHBOARD" | "RESOLUTION";

/** Which 2D stage to draw. The first group is Lagos Life's hand-built set (LagosStage);
 *  the rest come from the stage kit in app/components/stages.ts. */
export type LagosStageKind =
  | "yaba-dawn" | "yaba-street" | "cafe" | "call-sister" | "room-night" | "agent" | "annex"
  | "whatsapp" | "gig" | "video-job" | "embassy" | "outside" | "phone-text" | "airport" | "stay";
export type KitStageKind =
  | "ielts-centre" | "bank-hall" | "university-registry" | "french-class" | "ircc-portal"
  | "pearson-arrivals" | "toronto-street" | "campus" | "lecture-hall" | "tim-hortons" | "basement"
  | "job-fair" | "library" | "warehouse" | "boardroom" | "graduation" | "pr-landing" | "pitch-room"
  | "cbsa-secondary" | "irb-hearing" | "legal-clinic" | "shelter" | "service-canada";
export type StageKind = LagosStageKind | KitStageKind;
/** How the player travels into a scene (drawn by TravelRibbon). */
export type Transit = "none" | "trek" | "danfo" | "okada" | "call" | "plane" | "streetcar" | "snow-walk";

export interface RouteStats {
  investorInterest?: number; // Startup Visa
  technicalCredibility?: number; // Startup Visa
  scalabilityScore?: number; // Startup Visa
  employerTrust?: number; // Caregiver/LMIA
  lmiaProbability?: number; // Caregiver/LMIA
  vocationalHoursLogged?: number; // Targeted Trade
  languageScoreClb?: number; // Express Entry / IELTS mini-game
  provincialPoints?: number; // PNP Rural Stream
  papers?: number; // Lagos Life: document readiness, 0-100
  // Express Entry profile (feeds the CRS calculator):
  ageYears?: number;
  /** 0 none, 1 secondary, 2 one-year, 3 two-year, 4 bachelor's/3-year, 5 two+ credentials, 6 master's, 7 PhD */
  educationLevel?: number;
  /** Foreign education only counts once an ECA is done (1). */
  ecaComplete?: number;
  clbFirst?: number; // English, same CLB assumed in all four abilities
  nclcFrench?: number;
  foreignWorkYears?: number;
  canadianWorkYears?: number;
  /** 0 none, 1 one- or two-year credential, 2 three years or longer */
  canadianEducation?: number;
  pnpNomination?: number;
  siblingInCanada?: number;
  crsScore?: number; // derived, recalculated after every change
  // Student pathway:
  programType?: number; // 1 public college diploma, 2 master's, 3 private career college
  academicStanding?: number;
  officerConfidence?: number;
  scholarshipTried?: number;
  familyAsked?: number;
  landSold?: number;
  crowdfunded?: number;
  loanTaken?: number;
  hasDegree?: number; // from the player's profile: 1 if they hold a bachelor's or higher
  // Added for the Tourist Gamble dashboard:
  networkScore?: number;
  resumeScore?: number;
  employerLeads?: number;
  /** 1 if the player's state has insurgency, banditry or herder-farmer violence (from the profile). */
  conflictRegion?: number;
  // Kawosoke (asylum claim) inside the Tourist Gamble:
  /** 0 none, 1 sexual orientation, 2 gender-based violence, 3 conflict in the North, 4 bought story, 5 village people */
  kwBasis?: number;
  kwAtAirport?: number;
  kwCredibility?: number;
  kwEvidence?: number;
  // Express Entry 2026 categories, from the profile: 0 none, 1 healthcare, 2 STEM, 3 trades, 4 education
  eeCategory?: number;
  /** 1 if a reference letter copied the NOC duties word for word (invites a procedural fairness letter). */
  pflRisk?: number;
  // Year One in Canada:
  careerScore?: number;
  community?: number;
}

export interface GameState {
  activeRoute: RouteId;
  currentLocation: string;
  timeRemainingDays: number;
  energy: number;

  // Dynamic Core Stat Bars
  walletCad: number;
  walletNgn: number;
  desperation: number; // Replaces the "Village People" stress bar
  streetCred: number; // Adaptability and professional networking weight

  // Route-Specific Evaluation Metrics
  routeStats: RouteStats;

  currentSceneId: string;

  // Added: story flags, the last choice's feedback, and how the run ended.
  flags: Record<string, boolean>;
  lastChoice: { label: string; feedback: string } | null;
  outcome: Outcome | null;
  /** Scenes visited, with the answer given, for transcripts. */
  history: { sceneId: string; answer?: string; label?: string }[];
  /** A pop-up waiting to be dismissed (Village People trap, parallel-market shock). */
  popup: Popup | null;
  /** Counts CAD spends so the UI can float "-$1,500 CAD" once per spend. */
  cadFloat: { amount: number; tick: number };
  /** Dashboard routes: where the last action took place (drawn as a 2D stage). */
  currentStage: StageKind | null;
  /** Perks and daily-challenge modifiers in force for this run. */
  mods?: RunMods;
}

export interface RunMods {
  /** Multiplies the chance of a Village People trap. */
  trapFactor?: number;
  /** Added to every risky choice's odds. */
  oddsBonus?: number;
  /** Set when this run is a daily challenge (the day, YYYY-MM-DD). */
  daily?: string;
  label?: string;
  moneyFactor?: number;
}

export interface Popup {
  kind: "trap" | "market" | "blessing";
  id: string;
  kicker: string;
  title: string;
  body: string;
  button?: string;
}

/** Numeric GameState fields an effect may change directly. */
export type CoreStat = "timeRemainingDays" | "energy" | "walletCad" | "walletNgn" | "desperation" | "streetCred";
export type StatKey = CoreStat | keyof RouteStats;

export type Op = ">=" | ">" | "<=" | "<" | "==" | "!=";
export type Conditions = Partial<Record<StatKey, [Op, number]>>;
export type Effects = Partial<Record<StatKey, number>>;

export interface Choice {
  text: string;
  label: string;
  nextSceneId: string;
  effects?: Effects;
  feedback?: string;
  requires?: Conditions;
  lockedHint?: string;
  /** Lagos Life: shows a floating "-$N CAD" when chosen. */
  floatCad?: number;
  /** Values to overwrite (e.g. an IELTS result), applied after effects. */
  set?: Effects;
  /** A risky move: its odds are shown on the button, and the dice decide which branch happens. */
  gamble?: Gamble;
  /** Only listed when these hold (e.g. the submit button for the program the player chose). */
  hideUnless?: Conditions;
}

export interface GambleBranch {
  effects?: Effects;
  set?: Effects;
  /** Where this branch goes; defaults to the choice's nextSceneId. */
  nextSceneId?: string;
  label?: string;
  feedback: string;
}

export interface Gamble {
  /** Base chance of success, 0 to 1. */
  odds: number;
  /** Preparation that shifts the odds: each point of `key` adds `per` (negative for stats that hurt). */
  bonus?: { key: StatKey; per: number }[];
  min?: number;
  max?: number;
  success: GambleBranch;
  fail: GambleBranch;
}

export interface Outcome {
  result: "win" | "fail" | "neutral";
  reason: string;
  title: string;
  subtitle?: string;
  /** For RESOLUTION-decided outcomes: the scene whose rule decided it. */
  decidedBy?: string;
  /** "Reality check": what this ending teaches about the real process. */
  lesson?: string;
}

export interface DashboardAction {
  id: string;
  label: string;
  blurb: string;
  effects: Effects;
  /** Chance of an employer lead before network and resume bonuses. */
  leadChance?: number;
  location: string;
  /** The 2D stage for this action's location, and how the player gets there. */
  stage?: StageKind;
  transit?: Transit;
  /** Ends the run on the spot: things a visitor must never do. */
  fatal?: string;
  /** Leaves the dashboard for a story scene (e.g. the Kawosoke claim). */
  goToSceneId?: string;
  consequences: string[];
  leadConsequences?: string[];
}

export interface DashboardConfig {
  dailyCostCad: number;
  ngnPerCad: number;
  leadsToWin: number;
  winSceneId: string;
  /** Desperation creeps up once time remaining drops to this. */
  lowTimeDays: number;
  actions: DashboardAction[];
}

export interface Scene {
  id: string;
  route: RouteId;
  layoutType: LayoutType;
  speaker?: string;
  dialogue?: string;
  choices?: Choice[];
  onEnter?: Effects;
  /** RESOLUTION scenes: first branch whose `when` holds wins; last has no `when`. */
  branch?: { when?: Conditions; nextSceneId: string }[];
  outcome?: Omit<Outcome, "decidedBy">;
  dashboard?: DashboardConfig;
  unlocksRoute?: RouteId;
  /** Where the unlocked route starts, and which stats travel with the player. */
  unlockStartSceneId?: string;
  carry?: { routeStats?: RouteStats; /** Years since the profile age (sets ageYears when a profile exists). */ ageOffset?: number };
  // Lagos Life stage scenes:
  title?: string;
  location?: string;
  stage?: StageKind;
  transitIn?: Transit;
}

export interface BarSpec {
  key: StatKey;
  label: string;
  max?: number;
  suffix?: string;
  /** A rise is bad news (e.g. desperation). */
  invert?: boolean;
  /** "ngn" / "cad" format the value as money. */
  format?: "ngn" | "cad";
}

export interface TrapConfig {
  base: number;
  scale: number;
  exponent: number;
  /** `when`: the event can only strike while these conditions hold (e.g. after an asylum claim is filed). */
  items: { id: string; kicker: string; title: string; body: string; effects: Effects; when?: Conditions }[];
}

export interface MarketShockConfig {
  intervalSeconds: number;
  chance: number;
  kicker: string;
  title: string;
  body: string;
  button: string;
  multiply: Effects;
}

export interface Rank {
  id: string;
  title: string;
  blurb: string;
  /** Matches only when the run ended on this scene, or with this outcome reason. */
  sceneId?: string;
  reason?: string;
  when?: Conditions;
}

export interface RouteConfig {
  title: string;
  short: string;
  status: "playable" | "coming_soon";
  startSceneId?: string;
  initialState?: Partial<Omit<GameState, "routeStats">> & { routeStats?: RouteStats };
  bars: BarSpec[];
  tagline?: string;
  /** If any condition holds after a move, the run jumps to sceneId. */
  collapse?: { any: Conditions; sceneId: string };
  traps?: TrapConfig;
  /** Good surprises: more likely the worse things are going ("God dey"). Same item shape as traps. */
  blessings?: { base: number; scale: number; items: TrapConfig["items"] };
  /** Reality-check lessons by outcome reason, for endings without their own `lesson`. */
  lessons?: Record<string, string>;
  marketShock?: MarketShockConfig;
  /** End-of-run ranks, first match wins. */
  ranks?: Rank[];
  /** Routes offered as the next chapter after a win. */
  nextRoutes?: RouteId[];
  /** The route split into levels, in order. */
  levels?: LevelSpec[];
}

/** One level of a route: the scenes it covers, what it asks of the player, and how to earn extra stars. */
export interface LevelSpec {
  id: string;
  title: string;
  goal: string;
  scenes: string[];
  /** Up to two bonus stars, checked when the level is completed (completing it is the first star). */
  stars?: { label: string; when: Conditions }[];
}

/** CRS points tables for a candidate without a spouse. */
export interface CrsTables {
  source: string;
  verifiedOn: string;
  age: Record<string, number>;
  education: number[];
  languagePerAbility: { minClb: number; points: number }[];
  secondLanguagePerAbility: { minClb: number; points: number }[];
  canadianWork: number[];
  transferability: { cap: number; groupCap: number };
  additional: { pnp: number; sibling: number; frenchWithWeakEnglish: number; frenchWithEnglish: number; canadianEducation: number[] };
}

export interface ScenarioDatabase {
  meta: { version: string; note: string };
  crs?: CrsTables;
  routes: Record<RouteId, RouteConfig>;
  scenes: Record<string, Scene>;
}

export interface Toast {
  id: number;
  title: string;
  text: string;
  tone: "good" | "bad" | "neutral";
}
