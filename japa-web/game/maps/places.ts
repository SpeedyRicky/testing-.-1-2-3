// Where each scene happens: which city map, which hotspot, and how far along the Lagos-to-Canada journey a run is.
// Pure, so it's unit-tested without any map data.
import type { GameState, RouteId, ScenarioDatabase, Scene } from "../types";
import { placeFor, vacCityFor } from "../nigeria";
import { levelIndexOf, levelsFor } from "../levels";
import { FAR_PLACES, type SpotId } from "./cities";
import { projector, type BBox, type MapSpot } from "./geo";

/** Stages that only exist on one side of the Atlantic, and the hotspot they belong to. */
const NG_STAGE: Record<string, SpotId> = {
  "yaba-dawn": "home", "yaba-street": "market", cafe: "cafe", "call-sister": "home", agent: "agent", annex: "passport",
  gig: "market", embassy: "vac", outside: "buspark", airport: "airport", stay: "home", "ielts-centre": "testcentre",
  "bank-hall": "bank", "university-registry": "university", "french-class": "testcentre",
};
const CA_STAGE: Record<string, SpotId> = {
  "pearson-arrivals": "airport", "toronto-street": "downtown", campus: "university", "lecture-hall": "university",
  library: "university", graduation: "university", "tim-hortons": "coffee", basement: "home", "job-fair": "downtown",
  warehouse: "work", boardroom: "work", "pr-landing": "airport", "cbsa-secondary": "airport", "irb-hearing": "tribunal",
  "legal-clinic": "legal", shelter: "shelter", "service-canada": "servicecanada",
};
/** Stages that could be either side (a phone, a laptop, your room): decided by where the run is. */
const EITHER: Record<string, SpotId> = {
  "room-night": "home", whatsapp: "home", "phone-text": "home", "video-job": "home", "ircc-portal": "home",
};

/** Routes that are lived in Canada (after the opening scene). */
const CANADA_ROUTES = new Set<RouteId>(["FIRST_YEAR", "CAREGIVER_LMIA", "SPLIT_FAMILY"]);

export interface Where { country: "NG" | "CA"; spot: SpotId }

function inCanada(db: ScenarioDatabase, scene: Scene, run: GameState): boolean {
  if (CANADA_ROUTES.has(run.activeRoute)) return true;
  if (run.activeRoute === "TOURIST_GAMBLE") return scene.id !== "TOURIST_WHY";
  if ((run.routeStats.arrived ?? 0) >= 1) return true;
  // Once a run has passed through a Canada-only place, a phone call or a laptop scene happens in Canada too.
  return run.history.some((h) => {
    const st = db.scenes[h.sceneId]?.stage;
    return !!st && st in CA_STAGE;
  });
}

/** Where a scene takes place, or null for scenes with no place on a map (dashboards, routers, pitches). */
export function whereIs(db: ScenarioDatabase, sceneId: string, run: GameState): Where | null {
  const scene = db.scenes[sceneId];
  if (!scene) return null;
  if (scene.branch) {
    // A router: the place is wherever all its branches lead, if they agree.
    const targets = scene.branch.map((b) => whereIs(db, b.nextSceneId, run)).filter((w): w is Where => !!w);
    return targets.length && targets.every((t) => t.spot === targets[0].spot && t.country === targets[0].country) ? targets[0] : null;
  }
  const stage = scene.stage;
  if (!stage) return null;
  if (stage in CA_STAGE) return { country: "CA", spot: CA_STAGE[stage] };
  if (stage in NG_STAGE) return { country: "NG", spot: NG_STAGE[stage] };
  if (stage in EITHER) return { country: inCanada(db, scene, run) ? "CA" : "NG", spot: EITHER[stage] };
  return null;
}

/** Which Canadian city a run lives in. */
export function canadaCity(run: GameState): string {
  const s = run.routeStats;
  if (run.activeRoute === "ATLANTIC_AIP") return ["ca-halifax", "ca-halifax", "ca-moncton", "ca-stjohns", "ca-charlottetown"][s.aipProvince ?? 0] ?? "ca-halifax";
  if (run.activeRoute === "PNP_RURAL") return ["ca-winnipeg", "ca-saskatoon", "ca-winnipeg", "ca-halifax"][s.pnpProvince ?? 0] ?? "ca-winnipeg";
  if (run.activeRoute === "TARGETED_TRADE") return "ca-edmonton";
  return "ca-gta";
}

export function mapIdFor(where: Where, run: GameState, stateCode: string | undefined): string {
  return where.country === "NG" ? `ng-${stateCode ?? "LA"}` : canadaCity(run);
}

/** The visa centre and the international airport for a state: in the map if they're inside it, else an edge arrow. */
export function farSpots(stateCode: string | undefined, bbox: BBox, width: number): Partial<Record<SpotId, MapSpot>> {
  const lagos = vacCityFor(placeFor(stateCode ?? "LA")) === "Lagos";
  const { height, project } = projector(bbox, width);
  const place = (p: { lat: number; lon: number; label: string }): MapSpot => {
    const [x, y] = project(p.lat, p.lon);
    if (x >= 0 && y >= 0 && x <= width && y <= height) return { x: Math.round(x), y: Math.round(y), label: p.label, real: false };
    // Clamp to the edge along the line from the centre, with room for the arrow.
    const cx = width / 2, cy = height / 2, dx = x - cx, dy = y - cy;
    const k = Math.min((width / 2 - 40) / Math.abs(dx || 1e-9), (height / 2 - 40) / Math.abs(dy || 1e-9));
    return { x: Math.round(cx + dx * k), y: Math.round(cy + dy * k), label: p.label, real: false, offMap: p.label };
  };
  return {
    vac: place(lagos ? FAR_PLACES.vacLagos : FAR_PLACES.vacAbuja),
    airport: place(lagos ? FAR_PLACES.airportLagos : FAR_PLACES.airportAbuja),
  };
}

// --- The journey map ----------------------------------------------------------------------------------------------

/** Where each route ends up in Canada, as a place on the journey map. */
export function journeyDestination(run: GameState): string {
  const id = canadaCity(run).replace("ca-", "");
  return id === "gta" ? "pearson" : id;
}

/** 0 at home, 1 landed: the share of the route's levels reached so far. */
export function journeyProgress(db: ScenarioDatabase, run: GameState): number {
  const levels = levelsFor(db, run.activeRoute);
  if (!levels.length) return 0;
  if (run.outcome?.result === "win") return 1;
  const reached = Math.max(levelIndexOf(db, run.activeRoute, run.currentSceneId),
    ...run.history.map((h) => levelIndexOf(db, run.activeRoute, h.sceneId)), 0);
  return Math.min(0.95, (reached + 0.5) / levels.length);
}
