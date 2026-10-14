"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { LogOut, Pencil, Plane, RotateCcw } from "lucide-react";
import { DB } from "@/game/engine";
import { activeRun, initialState, reducer } from "@/game/machine";
import type { RouteId } from "@/game/types";
import { LayoutContainer } from "./LayoutContainer";
import { LagosBackdrop } from "./layouts/LagosStageLayout";
import { Person, YouFaceProvider } from "./Person";
import { faceFor } from "@/game/face";
import { useAnalytics } from "../launch/useAnalytics";
import { track, visitSource } from "../launch/analytics";
import { InstallButton, useServiceWorker } from "../launch/Install";
import { LanguageToggle } from "./Language";
import { CinematicProvider, SpeedToggle, useCinematic } from "./Cinematic";
import { EndingsButton, RealityCheck } from "./Endings";
import { AwardToast, MetaChip, RunModsChip, useRunRewards } from "./Meta";
import { HelpButton, Tutorial } from "./Tutorial";
import { LevelBanner, LevelStrip, useLevelTracking } from "./Levels";
import { SoundToggle, useSound } from "./Sound";
import { endingKey } from "@/game/endings";
import { moodFor } from "@/game/music";
import { Onboarding } from "./Onboarding";
import { PlayerProvider } from "./Player";
import type { PlayerProfile } from "@/game/profile";
import { makeSave, readSave } from "@/game/save";

const PROFILE_KEY = "japa.profile.v1";
const SAVE_KEY = "japa.save.v1";

function loadSave(username: string) {
  try {
    return readSave(DB, JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? "null"), username);
  } catch {
    return null;
  }
}

function loadProfile(): PlayerProfile | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PlayerProfile;
    return p?.version === 1 && typeof p.username === "string" && p.avatar ? p : null;
  } catch {
    return null;
  }
}

function saveProfile(p: PlayerProfile | null) {
  try {
    if (p) window.localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    else window.localStorage.removeItem(PROFILE_KEY);
  } catch { /* storage blocked: the profile lasts for this visit only */ }
}

const ROUTES = Object.keys(DB.routes) as RouteId[];

type Screen = "loading" | "signup" | "edit" | "playing";

export function Game() {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState());
  const [screen, setScreen] = useState<Screen>("loading");
  useServiceWorker();

  // Read the saved profile after mount (storage is browser-only).
  useEffect(() => {
    const t = window.setTimeout(() => {
      const saved = loadProfile();
      if (saved) {
        dispatch({ type: "SET_PROFILE", profile: saved });
        const progress = loadSave(saved.username);
        if (progress) dispatch({ type: "RESTORE_RUNS", ...progress });
      }
      setScreen(saved ? "playing" : "signup");
      track("app_open", { source: visitSource(), returning: Boolean(saved) });
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  // Save every run as it changes, so a refresh continues where the player was.
  useEffect(() => {
    if (screen !== "playing" || !state.profile) return;
    const t = window.setTimeout(() => {
      try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(makeSave(DB, state))); } catch { /* storage full or blocked */ }
    }, 250);
    return () => window.clearTimeout(t);
  }, [state, screen]);

  function finish(p: PlayerProfile) {
    if (screen === "signup") track("signup_complete", { role: p.role });
    saveProfile(p);
    dispatch({ type: "SET_PROFILE", profile: p });
    setScreen("playing");
    window.scrollTo({ top: 0 });
  }

  function signOut() {
    saveProfile(null);
    try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    dispatch({ type: "SET_PROFILE", profile: null });
    setScreen("signup");
  }

  if (screen === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-amber-100/80">
        <Plane className="h-8 w-8 animate-[bounce-soft_0.9s_ease-in-out_infinite] text-amber-300" />
        <p className="text-sm tracking-wide">Taxiing to the runway…</p>
      </div>
    );
  }

  if (screen === "signup" || screen === "edit") {
    return (
      <div className="relative min-h-screen w-full">
        <LagosBackdrop />
        <Onboarding
          initial={screen === "edit" ? state.profile : null}
          onDone={finish}
          onCancel={screen === "edit" ? () => setScreen("playing") : undefined}
        />
      </div>
    );
  }

  return (
    <PlayerProvider profile={state.profile}>
      <CinematicProvider>
        <GameScreen state={state} dispatch={dispatch} onEdit={() => setScreen("edit")} onSignOut={signOut} />
      </CinematicProvider>
    </PlayerProvider>
  );
}

function GameScreen({ state, dispatch, onEdit, onSignOut }: {
  state: ReturnType<typeof initialState>;
  dispatch: React.Dispatch<Parameters<typeof reducer>[1]>;
  onEdit: () => void;
  onSignOut: () => void;
}) {
  const run = activeRun(state);
  const cfg = DB.routes[state.activeRoute];
  useRunRewards(run, dispatch);
  const [helpOpen, setHelpOpen] = useState(false);
  useLevelTracking(run);
  useAnalytics(run ?? null);
  const { setMood, play } = useSound();
  const mood = run ? moodFor(DB, run) : "lagos";
  useEffect(() => { setMood(mood); }, [mood, setMood]);
  // The ending's fanfare (or "dun dun DUN") waits for the choice cutscene to finish.
  const { playing } = useCinematic();
  const ending = run ? endingKey(DB, run) : null;
  const lost = run?.outcome?.result === "fail";
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (!ending) { announced.current = null; return; }
    if (playing || announced.current === ending) return;
    announced.current = ending;
    play(lost ? "fail" : "win");
  }, [ending, lost, playing, play]);
  const profile = state.profile;

  return (
    <YouFaceProvider value={faceFor(run)}>
    <div className="relative min-h-screen w-full">
      {/* Route backdrop sits behind everything, outside main's stacking context. */}
      {run && DB.scenes[run.currentSceneId]?.layoutType === "STORY_STAGE" && <LagosBackdrop route={state.activeRoute} />}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-bold text-zinc-950">J</div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Japa: The Great Escape</div>
              <div className="text-[11px] text-zinc-500">Nigeria → Canada simulator</div>
            </div>
          </div>

          <nav role="tablist" aria-label="Route" className="flex w-full gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1 sm:w-auto">
            {ROUTES.map((r) => {
              const route = DB.routes[r];
              const soon = route.status !== "playable";
              const active = state.activeRoute === r;
              return (
                <button
                  key={r}
                  role="tab"
                  aria-selected={active}
                  disabled={soon}
                  title={soon ? `${route.title}: coming soon` : route.title}
                  onClick={() => dispatch({ type: "SELECT_ROUTE", route: r })}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                    active ? "bg-white/10 text-white shadow-sm" : soon ? "cursor-not-allowed text-zinc-600" : "text-zinc-400 hover:text-zinc-200"}`}
                >
                  {route.short}
                  {soon && <span className="rounded bg-white/5 px-1 py-px text-[9px] uppercase tracking-wider text-zinc-500">Soon</span>}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">{cfg.title}</h1>
            {profile ? (
              <div className="flex items-center gap-1.5">
                <span className="relative h-9 w-9 overflow-hidden rounded-full border border-amber-300/40 bg-gradient-to-b from-sky-300 to-amber-200" aria-hidden>
                  <span className="relative block h-[78px] w-9"><Person who="you" x={50} /></span>
                </span>
                <span className="max-w-[8rem] truncate text-sm font-semibold text-white">{profile.username}</span>
                <button type="button" onClick={onEdit} aria-label="Edit profile" title="Edit profile"
                  className="rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={onSignOut} aria-label="Sign out" title="Sign out"
                  className="rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"><LogOut className="h-3.5 w-3.5" /></button>
              </div>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
          <InstallButton />
          <LanguageToggle />
          <HelpButton onClick={() => setHelpOpen(true)} />
          <MetaChip dispatch={dispatch} run={run} />
          <EndingsButton />
          <SoundToggle />
          <SpeedToggle />
          <button
            type="button"
            onClick={() => dispatch({ type: "RESTART" })}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:-translate-y-0.5 hover:border-amber-300/60 hover:text-white active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset run
          </button>
          </div>
        </div>
        {run && (
          <div key={state.activeRoute} className="animate-fade-in">
            <RunModsChip run={run} />
            <LevelStrip run={run} dispatch={dispatch} />
            <LayoutContainer run={run} dispatch={dispatch} toast={state.toast} />
            <RealityCheck run={run} className="mt-4" />
          </div>
        )}
      </main>

      <LevelBanner />
      <AwardToast />
      <Tutorial forceOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      <footer className="relative z-10 mx-auto max-w-6xl border-t border-white/10 px-4 py-6 text-[11px] leading-relaxed text-zinc-500 sm:px-6">
        A simulation for entertainment. It is not legal or immigration advice. Numbers are illustrative; rules, fees and
        cutoffs change often, so check IRCC (canada.ca) before you act. We count plays anonymously (routes and endings,
        never your name or profile) to improve the game.
      </footer>
    </div>
    </YouFaceProvider>
  );
}
