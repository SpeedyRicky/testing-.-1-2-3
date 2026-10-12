"use client";

import { createContext, useContext, useMemo } from "react";
import type { GameState } from "@/game/types";
import { fillText, profileVars, type PlayerProfile } from "@/game/profile";
import { placeFor, transportFor, type LocalTransport } from "@/game/nigeria";

interface PlayerCtx {
  profile: PlayerProfile | null;
  transport: LocalTransport;
  /** Fills {placeholders} with the player's name, state and profile (and {crs} from the run). */
  t: (text: string | undefined, run?: GameState) => string;
}

const PlayerContext = createContext<PlayerCtx>({
  profile: null,
  transport: "danfo",
  t: (text) => fillText(text ?? "", profileVars(null)),
});

export const usePlayer = () => useContext(PlayerContext);

export function PlayerProvider({ profile, children }: { profile: PlayerProfile | null; children: React.ReactNode }) {
  const value = useMemo<PlayerCtx>(() => {
    const vars = profileVars(profile);
    return {
      profile,
      transport: profile ? transportFor(placeFor(profile.stateCode)) : "danfo",
      t: (text, run) => fillText(text ?? "", run?.routeStats.crsScore !== undefined
        ? { ...vars, crs: String(run.routeStats.crsScore) }
        : vars),
    };
  }, [profile]);
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
