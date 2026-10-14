"use client";

import type { Dispatch } from "react";
import { DB, currentScene, dangerStats, thresholdsFor } from "@/game/engine";
import type { AppEvent } from "@/game/machine";
import type { BarSpec, GameState, LayoutType, RouteId, Toast } from "@/game/types";
import { StatBar, type Tone } from "./StatBar";
import { ZoomGridLayout } from "./layouts/ZoomGridLayout";
import { CorporateOfficeLayout } from "./layouts/CorporateOfficeLayout";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { LagosStageLayout } from "./layouts/LagosStageLayout";

/** Per-route look. Class names are written out in full so Tailwind keeps them. */
export const ROUTE_THEME: Record<RouteId, { backdrop: string; tones: Tone[]; accent: string }> = {
  NIGERIA_LIFE: { backdrop: "", tones: [], accent: "text-amber-300" },
  STUDY_PERMIT: { backdrop: "", tones: [], accent: "text-red-300" },
  EXPRESS_ENTRY: { backdrop: "", tones: [], accent: "text-sky-300" },
  FIRST_YEAR: { backdrop: "", tones: [], accent: "text-emerald-300" },
  STARTUP_VISA: {
    backdrop: "bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_60%)]",
    tones: ["emerald", "sky", "violet"],
    accent: "text-emerald-300",
  },
  TOURIST_GAMBLE: {
    backdrop: "bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.10),transparent_60%)]",
    tones: ["emerald", "sky", "rose"],
    accent: "text-amber-300",
  },
  CAREGIVER_LMIA: {
    backdrop: "bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.12),transparent_60%)]",
    tones: ["gold", "sky", "rose"],
    accent: "text-amber-200",
  },
  SPLIT_FAMILY: { backdrop: "", tones: [], accent: "text-rose-300" },
  TARGETED_TRADE: { backdrop: "", tones: [], accent: "text-orange-300" },
  PNP_RURAL: { backdrop: "", tones: [], accent: "text-sky-300" },
};

export interface LayoutProps {
  run: GameState;
  dispatch: Dispatch<AppEvent>;
  bars: React.ReactNode;
  toast: Toast | null;
}

const LAYOUTS: Record<Exclude<LayoutType, "RESOLUTION">, (p: LayoutProps) => React.JSX.Element> = {
  STORY_STAGE: LagosStageLayout,
  ZOOM_GRID: ZoomGridLayout,
  CORPORATE_OFFICE: CorporateOfficeLayout,
  DASHBOARD: DashboardLayout,
};

function barTone(spec: BarSpec, i: number, run: GameState, route: RouteId): Tone {
  if (spec.key === "timeRemainingDays") {
    const days = run.timeRemainingDays;
    return days > 90 ? "emerald" : days > 45 ? "amber" : "rose";
  }
  return ROUTE_THEME[route].tones[i] ?? "emerald";
}

/** Reads the current scene from scenarios.json, maps the route's stats onto animated
 *  bars, and picks the layout and background from the scene's route and layoutType. */
export function LayoutContainer({ run, dispatch, toast }: Omit<LayoutProps, "bars">) {
  const scene = currentScene(DB, run);
  const route = scene?.route ?? run.activeRoute;
  const cfg = DB.routes[route];
  const thresholds = thresholdsFor(DB, route);
  const danger = dangerStats(DB, run);

  const bars = (
    <div className="space-y-4">
      {cfg.bars.map((b, i) => (
        <StatBar
          key={b.key}
          label={b.label}
          value={b.key in run.routeStats ? run.routeStats[b.key as keyof typeof run.routeStats] ?? 0 : (run[b.key as keyof GameState] as number)}
          max={b.max ?? 100}
          suffix={b.suffix}
          invert={b.invert}
          threshold={thresholds[b.key]}
          tone={barTone(b, i, run, route)}
          danger={danger.has(b.key)}
        />
      ))}
    </div>
  );

  const layoutType = scene?.layoutType === "RESOLUTION" || !scene ? "ZOOM_GRID" : scene.layoutType;
  const Layout = LAYOUTS[layoutType];

  return (
    <>
      <div className={`relative z-10 -mx-4 rounded-none px-4 py-1 transition-[background] duration-700 sm:mx-0 sm:rounded-3xl sm:px-0 ${ROUTE_THEME[route].backdrop}`}>
        <Layout run={run} dispatch={dispatch} bars={bars} toast={toast} />
      </div>
    </>
  );
}
