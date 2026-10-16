"use client";

// The city map: a storybook drawing of the player's real city (from OpenStreetMap), with hotspots. Your character
// walks along real streets to wherever the scene happens, and the hotspots double as a menu: tap one to take the
// choice that goes there.
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Map as MapIcon } from "lucide-react";
import { DB, type PresentedChoice } from "@/game/engine";
import type { GameState } from "@/game/types";
import { along, pathD, pathLength, route, type CityMap as MapData, type MapSpot, type Pt } from "@/game/maps/geo";
import { dryLandSpots, farSpots, mapIdFor, whereIs, type Where } from "@/game/maps/places";
import type { SpotId } from "@/game/maps/cities";
import { homeFor } from "@/game/profile";
import { usePlayer } from "../Player";
import { Person } from "../Person";
import { useCinematic } from "../Cinematic";
import { graphFor, loadMap } from "./mapData";

const ICON: Record<SpotId, string> = {
  home: "🏠", market: "🛒", passport: "🛂", vac: "🏢", church: "⛪", mosque: "🕌", buspark: "🚌", airport: "✈️", cafe: "💻",
  agent: "🕴️", office: "💼", testcentre: "📝", bank: "🏦", university: "🎓", servicecanada: "🏛️", coffee: "☕", work: "🏭",
  settlement: "🤝", downtown: "🌆", legal: "⚖️", tribunal: "⚖️", shelter: "🛏️",
};
/** The width of map the camera shows, in map pixels. */
const VIEW_W = 430;
const OPEN_KEY = "japa.map.open.v1";

const THEME = {
  NG: { land: "#f3e6c4", grid: "#e9d8ad", water: "#86c5e6", waterEdge: "#4f9cc8", minor: "#fffaf0", minorEdge: "#d8c497", major: "#ffc857", majorEdge: "#c98a2a", rail: "#8b6f4e", air: "#e7d9b4" },
  CA: { land: "#eef3f6", grid: "#dde6ec", water: "#7fb8de", waterEdge: "#3f86b8", minor: "#ffffff", minorEdge: "#c3cfd8", major: "#f6a35b", majorEdge: "#b8642a", rail: "#6b7280", air: "#dfe7ec" },
};

/** The drawing itself; memoised because it can be thousands of paths. */
const MapDrawing = memo(function MapDrawing({ map, country }: { map: MapData; country: "NG" | "CA" }) {
  const t = THEME[country];
  const lines = (set: number[][], stroke: string, width: number, extra?: React.SVGProps<SVGPathElement>) =>
    set.map((l, i) => <path key={i} d={pathD(l)} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" {...extra} />);
  return (
    <svg width={map.width} height={map.height} viewBox={`0 0 ${map.width} ${map.height}`} className="absolute left-0 top-0" aria-hidden>
      <defs>
        <pattern id={`dots-${country}`} width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.4" fill={t.grid} />
        </pattern>
      </defs>
      <rect width={map.width} height={map.height} fill={t.land} />
      <rect width={map.width} height={map.height} fill={`url(#dots-${country})`} />
      {map.airfield.map((r, i) => <path key={`a${i}`} d={pathD(r, true)} fill={t.air} stroke={t.minorEdge} strokeDasharray="6 4" />)}
      {map.water.map((r, i) => <path key={`w${i}`} d={pathD(r, true)} fill={t.water} stroke={t.waterEdge} strokeWidth={2} />)}
      {lines(map.coast, t.waterEdge, 5)}
      {lines(map.river, t.water, 6)}
      {lines(map.rail, t.rail, 2, { strokeDasharray: "7 5" })}
      {lines(map.minor, t.minorEdge, 5)}
      {lines(map.minor, t.minor, 3)}
      {lines(map.major, t.majorEdge, 9)}
      {lines(map.major, t.major, 6)}
    </svg>
  );
});

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!q) return;
    const on = () => setReduced(q.matches);
    on();
    q.addEventListener?.("change", on);
    return () => q.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

export function CityMap({ run, choices, onPick, disabled }: {
  run: GameState;
  choices: PresentedChoice[];
  onPick: (index: number) => void;
  disabled: boolean;
}) {
  const { profile, t } = usePlayer();
  const { speed, playing } = useCinematic();
  const reduced = usePrefersReducedMotion();
  const where = whereIs(DB, run.currentSceneId, run);
  // Scenes with no place (a dashboard, a router) keep showing the last place you were.
  const [last, setLast] = useState<Where | null>(null);
  if (where && (last?.spot !== where.spot || last?.country !== where.country)) setLast(where);
  const shown = where ?? last;
  const mapId = shown ? mapIdFor(shown, run, profile?.stateCode) : null;

  // The game only renders after mount, so storage is safe to read on the first render.
  const [open, setOpen] = useState(() => {
    try { return window.localStorage.getItem(OPEN_KEY) !== "0"; } catch { return true; }
  });
  const toggle = () => setOpen((o) => {
    try { window.localStorage.setItem(OPEN_KEY, o ? "0" : "1"); } catch { /* ignore */ }
    return !o;
  });

  const [map, setMap] = useState<MapData | null>(null);
  useEffect(() => {
    let live = true;
    if (!mapId) return;
    loadMap(mapId).then((m) => { if (live) setMap(m && m.id === mapId ? m : null); });
    return () => { live = false; };
  }, [mapId]);

  // Hotspots: the map's own, the visa centre and airport for Nigerian maps, and only the player's place of worship.
  const spots = useMemo(() => {
    if (!map) return {} as Partial<Record<SpotId, MapSpot>>;
    const all: Partial<Record<SpotId, MapSpot>> = { ...dryLandSpots(map) };
    if (map.id.startsWith("ng-")) {
      const far = farSpots(profile?.stateCode, map.bbox, map.width);
      if (!all.vac?.real) all.vac = far.vac;
      if (!all.airport?.real) all.airport = far.airport;
    }
    const faith = homeFor(profile).faith === "masjid" ? "church" : "mosque";
    delete all[faith];
    return all;
  }, [map, profile]);

  // Which hotspot each choice leads to (for the tappable pins).
  const targets = useMemo(() => {
    const byspot = new Map<SpotId, PresentedChoice[]>();
    if (!map || !shown) return byspot;
    for (const c of choices) {
      if (!c.enabled) continue;
      const w = whereIs(DB, c.nextSceneId, run);
      if (!w || w.spot === shown.spot || mapIdFor(w, run, profile?.stateCode) !== map.id || !spots[w.spot]) continue;
      byspot.set(w.spot, [...(byspot.get(w.spot) ?? []), c]);
    }
    return byspot;
  }, [choices, map, shown, run, profile, spots]);

  // The walk: from the previous hotspot to this one, along real streets.
  const here = shown && spots[shown.spot] ? ([spots[shown.spot]!.x, spots[shown.spot]!.y] as Pt) : null;
  const [pos, setPos] = useState<Pt | null>(null);
  const [walking, setWalking] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);
  const [trail, setTrail] = useState<Pt[] | null>(null);
  const from = useRef<{ map: string; pt: Pt } | null>(null);
  useEffect(() => {
    // Wait for the choice's cutscene to finish, so the walk isn't hidden behind it.
    if (!map || !here || playing) return;
    const start = from.current && from.current.map === map.id ? from.current.pt : null;
    from.current = { map: map.id, pt: here };
    if (!start || (start[0] === here[0] && start[1] === here[1]) || reduced) { setPos(here); setTrail(null); return; }
    const path = route(graphFor(map), start, here);
    const ms = Math.min(2600, Math.max(900, pathLength(path) * (speed === "quick" ? 1.6 : 3.2)));
    setTrail(path);
    setWalking(true);
    let raf = 0;
    const t0 = performance.now();
    let prev = start;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const p = along(path, eased);
      if (Math.abs(p[0] - prev[0]) > 0.5) setFacingLeft(p[0] < prev[0]);
      prev = p;
      setPos(p);
      if (k < 1) raf = requestAnimationFrame(step);
      else { setWalking(false); window.setTimeout(() => setTrail(null), 900); }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, here?.[0], here?.[1], playing]);

  // Camera size follows the card.
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: 220 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, map]);

  // A pin's choice list belongs to the scene it was opened in.
  const [menuAt, setMenuAt] = useState<{ scene: string; spot: SpotId } | null>(null);
  const menu = menuAt?.scene === run.currentSceneId ? menuAt.spot : null;
  const setMenu = (spot: SpotId | null) => setMenuAt(spot ? { scene: run.currentSceneId, spot } : null);

  if (!shown || !map || !here) return null;
  const country = map.id.startsWith("ng-") ? "NG" : "CA";
  // Phones see about 430 map pixels across; wider screens see more of the city at a similar zoom.
  const s = size.w / Math.max(VIEW_W, Math.min(map.width, size.w * 0.7));
  const cam = pos ?? here;
  const cx = Math.min(map.width - size.w / s / 2, Math.max(size.w / s / 2, cam[0]));
  const cy = Math.min(map.height - size.h / s / 2, Math.max(size.h / s / 2, cam[1]));
  const tx = size.w / 2 - cx * s, ty = size.h / 2 - cy * s;
  const currentSpot = spots[shown.spot];

  return (
    <section aria-label="City map" className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-zinc-950/60">
      <button type="button" onClick={toggle} aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
        <span className="inline-flex min-w-0 items-center gap-2">
          <MapIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{map.name}{currentSpot ? ` · ${currentSpot.label}` : ""}</span>
        </span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>
      {open ? (
        <div ref={box} className="relative h-56 touch-pan-y overflow-hidden sm:h-72" data-map={map.id}>
          <div className="absolute left-0 top-0 origin-top-left will-change-transform"
            style={{ width: map.width, height: map.height, transform: `translate(${tx}px, ${ty}px) scale(${s})`, transition: walking ? "none" : "transform 600ms ease" }}>
            <MapDrawing map={map} country={country} />
            {trail ? (
              <svg width={map.width} height={map.height} className="pointer-events-none absolute left-0 top-0" aria-hidden>
                <path d={trail.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("")} fill="none"
                  stroke="#e11d48" strokeWidth={3 / s * 1.4} strokeDasharray={`${6 / s} ${5 / s}`} strokeLinecap="round" opacity={0.8} />
              </svg>
            ) : null}
            {(Object.entries(spots) as [SpotId, MapSpot][]).map(([id, sp]) => {
              const go = targets.get(id);
              const isHere = id === shown.spot;
              // Off screen: the edge badge is the button; this pin is just drawing.
              const off = !!go && (sp.x * s + tx < 26 || sp.y * s + ty < 26 || sp.x * s + tx > size.w - 26 || sp.y * s + ty > size.h - 26);
              return (
                <div key={id} className="absolute" style={{ left: sp.x, top: sp.y, transform: `translate(-50%, -50%) scale(${1 / s})`, zIndex: go ? 30 : isHere ? 20 : 10 }}>
                  <button type="button" disabled={!go || disabled || off} aria-hidden={off || undefined} tabIndex={off ? -1 : undefined}
                    onClick={() => (go!.length === 1 ? onPick(go![0].index) : setMenu(menu === id ? null : id))}
                    aria-label={go ? `Go to ${sp.label}: ${go.map((c) => t(c.text, run)).join(" or ")}` : sp.label}
                    className={`group flex flex-col items-center gap-0.5 ${go ? "cursor-pointer" : "cursor-default"}`}>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-base shadow-md transition ${
                      go ? "map-pin-go border-rose-500 bg-white" : isHere ? "border-amber-400 bg-amber-100" : "border-white/80 bg-white/90"}`}>
                      {sp.offMap ? "➜" : ICON[id]}
                    </span>
                    {go || isHere || sp.offMap ? (
                      <span className={`max-w-[9rem] truncate rounded-full px-2 py-0.5 text-[10px] font-bold shadow ${go ? "bg-rose-600 text-white" : "bg-zinc-900/85 text-white"}`}>
                        {go ? `${go.map((c) => choices.indexOf(c) + 1).join(", ")} · ` : ""}{sp.label}
                      </span>
                    ) : null}
                  </button>
                  {menu === id && go ? (
                    <div className="absolute left-1/2 top-full z-40 mt-1 w-56 -translate-x-1/2 rounded-xl border border-white/15 bg-zinc-950/95 p-1.5 shadow-xl">
                      {go.map((c) => (
                        <button key={c.index} type="button" onClick={() => onPick(c.index)} disabled={disabled}
                          className="block w-full rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold text-zinc-100 hover:bg-white/10">
                          {choices.indexOf(c) + 1}. {t(c.text, run)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <div className="pointer-events-none absolute" style={{ left: cam[0], top: cam[1], width: 44, height: 86, zIndex: 35,
              transform: `translate(-50%, -88%) scale(${0.62 / s})`, transformOrigin: "50% 88%" }}>
              <Person who="you" pose={walking ? "walk" : "idle"} x={50} flip={facingLeft} />
            </div>
            {!walking && DB.scenes[run.currentSceneId]?.title ? (
              <div key={run.currentSceneId} className="map-bubble pointer-events-none absolute" style={{ left: cam[0], top: cam[1], zIndex: 36,
                transform: `translate(14px, -150%) scale(${1 / s})`, transformOrigin: "0 100%" }}>
                <span className="block max-w-[11rem] rounded-2xl rounded-bl-sm bg-white px-2.5 py-1.5 text-[11px] font-bold leading-tight text-zinc-900 shadow-lg">
                  {t(DB.scenes[run.currentSceneId]!.title, run)}
                </span>
              </div>
            ) : null}
          </div>
          {/* Destinations outside the view: an arrow badge on the edge, pointing at the place. Tapping it still goes there. */}
          {(Object.entries(spots) as [SpotId, MapSpot][]).map(([id, sp]) => {
            const go = targets.get(id);
            if (!go) return null;
            const px = sp.x * s + tx, py = sp.y * s + ty, m = 26;
            if (px >= m && py >= m && px <= size.w - m && py <= size.h - m) return null;
            const ex = Math.min(size.w - m, Math.max(m, px)), ey = Math.min(size.h - m - 12, Math.max(m + 12, py));
            const angle = (Math.atan2(py - ey, px - ex) * 180) / Math.PI;
            return (
              <button key={`edge-${id}`} type="button" disabled={disabled}
                onClick={() => (go.length === 1 ? onPick(go[0].index) : setMenu(menu === id ? null : id))}
                aria-label={`Go to ${sp.label}: ${go.map((c) => t(c.text, run)).join(" or ")}`}
                className="map-pin-go absolute z-40 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border-2 border-rose-500 bg-white px-2 py-1 text-[10px] font-bold text-rose-700 shadow-lg"
                style={{ left: ex, top: ey }}>
                <span style={{ transform: `rotate(${angle}deg)` }} aria-hidden>➜</span>
                {ICON[id]} {go.map((c) => choices.indexOf(c) + 1).join(", ")}
              </button>
            );
          })}
          {targets.size ? (
            <p className="pointer-events-none absolute left-2 top-2 rounded-full bg-zinc-950/80 px-2.5 py-1 text-[10px] font-semibold text-amber-100">
              Tap a red pin to go there
            </p>
          ) : null}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer"
            className="absolute bottom-1 right-1 rounded bg-white/80 px-1.5 py-0.5 text-[9px] font-medium text-zinc-700">
            © OpenStreetMap contributors
          </a>
        </div>
      ) : null}
    </section>
  );
}
