// The game's data contract. Scenes, routes and actions live in scenarios.json;
// components only render what these types describe.

export type RouteId =
  | "LAGOS_LIFE"
  | "STARTUP_VISA"
  | "CAREGIVER_LMIA"
  | "TARGETED_TRADE"
  | "TOURIST_GAMBLE"
  | "PNP_RURAL";

export type LayoutType = "LAGOS_STAGE" | "ZOOM_GRID" | "CORPORATE_OFFICE" | "DASHBOARD" | "RESOLUTION";

/** Lagos Life: which 2D stage to draw, and how the player travels into a scene. */
export type StageKind =
  | "yaba-dawn" | "yaba-street" | "cafe" | "call-sister" | "room-night" | "agent" | "annex"
  | "whatsapp" | "gig" | "video-job" | "embassy" | "outside" | "phone-text" | "airport" | "stay";
export type Transit = "none" | "trek" | "danfo" | "okada" | "call" | "plane";

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
  /** A pop-up waiting to be dismissed (Village People trap, parallel-market shock). */
  popup: Popup | null;
  /** Counts CAD spends so the UI can float "-$1,500 CAD" once per spend. */
  cadFloat: { amount: number; tick: number };
}

export interface Popup {
  kind: "trap" | "market";
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
  /** "ngn" formats the value as naira. */
  format?: "ngn";
}

export interface TrapConfig {
  base: number;
  scale: number;
  exponent: number;
  items: { id: string; kicker: string; title: string; body: string; effects: Effects }[];
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
  /** Matches only when the run ended on this scene. */
  sceneId?: string;
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
  marketShock?: MarketShockConfig;
  /** End-of-run ranks, first match wins. */
  ranks?: Rank[];
  /** Routes offered as the next chapter after a win. */
  nextRoutes?: RouteId[];
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
