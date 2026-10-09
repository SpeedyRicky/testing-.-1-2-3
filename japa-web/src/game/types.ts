// The game's data contract. Scenes, routes and actions live in scenarios.json;
// components only render what these types describe.

export type RouteId = "STARTUP_VISA" | "CAREGIVER_LMIA" | "TARGETED_TRADE" | "TOURIST_GAMBLE" | "PNP_RURAL";

export type LayoutType = "ZOOM_GRID" | "CORPORATE_OFFICE" | "DASHBOARD" | "RESOLUTION";

export interface RouteStats {
  investorInterest?: number; // Startup Visa
  technicalCredibility?: number; // Startup Visa
  scalabilityScore?: number; // Startup Visa
  employerTrust?: number; // Caregiver/LMIA
  lmiaProbability?: number; // Caregiver/LMIA
  vocationalHoursLogged?: number; // Targeted Trade
  languageScoreClb?: number; // Express Entry / IELTS mini-game
  provincialPoints?: number; // PNP Rural Stream
  // Added for the Tourist Gamble dashboard:
  networkScore?: number;
  resumeScore?: number;
  employerLeads?: number;
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
}

export interface Outcome {
  result: "win" | "fail" | "neutral";
  reason: string;
  title: string;
  subtitle?: string;
  /** For RESOLUTION-decided outcomes: the scene whose rule decided it. */
  decidedBy?: string;
}

export interface DashboardAction {
  id: string;
  label: string;
  blurb: string;
  effects: Effects;
  /** Chance of an employer lead before network and resume bonuses. */
  leadChance?: number;
  location: string;
  /** Ends the run on the spot: things a visitor must never do. */
  fatal?: string;
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
}

export interface BarSpec {
  key: StatKey;
  label: string;
  max?: number;
  suffix?: string;
  /** A rise is bad news (e.g. desperation). */
  invert?: boolean;
}

export interface RouteConfig {
  title: string;
  short: string;
  status: "playable" | "coming_soon";
  startSceneId?: string;
  initialState?: Partial<Omit<GameState, "routeStats">> & { routeStats?: RouteStats };
  bars: BarSpec[];
}

export interface ScenarioDatabase {
  meta: { version: string; note: string };
  routes: Record<RouteId, RouteConfig>;
  scenes: Record<string, Scene>;
}

export interface Toast {
  id: number;
  title: string;
  text: string;
  tone: "good" | "bad" | "neutral";
}
