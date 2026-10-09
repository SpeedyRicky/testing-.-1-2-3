// The app's state machine: three view modes, each keeping its own progress
// while you switch between them. One reducer, plain serializable events.
import { CONTENT, choose, startScenario, type DialogueState } from "./dialogue";
import { PITCH_SCENARIO } from "./pitch";
import { newTourist, takeAction, type TouristState } from "./tourist";

export const LMIA_SCENARIO = "lmia_interview";

export type Mode = "pitch" | "tourist" | "lmia";

export const MODES: { id: Mode; label: string; short: string }[] = [
  { id: "pitch", label: "The Startup Visa Pitch Route", short: "Startup Pitch" },
  { id: "tourist", label: "The 180-Day Tourist Gamble", short: "Tourist Gamble" },
  { id: "lmia", label: "The Hidden LMIA Interview", short: "LMIA Interview" },
];

export interface AppState {
  mode: Mode;
  pitch: DialogueState;
  tourist: TouristState;
  lmia: DialogueState;
}

export type AppEvent =
  | { type: "SWITCH_MODE"; mode: Mode }
  | { type: "PITCH_CHOOSE"; index: number }
  | { type: "PITCH_RESTART" }
  | { type: "TOURIST_ACTION"; actionId: string; rolls: [number, number] }
  | { type: "TOURIST_DISMISS_TOAST" }
  | { type: "TOURIST_RESTART" }
  | { type: "LMIA_CHOOSE"; index: number }
  | { type: "LMIA_RESTART" }
  | { type: "LMIA_FROM_TOURIST" };

export function initialState(): AppState {
  return {
    mode: "pitch",
    pitch: startScenario(CONTENT, PITCH_SCENARIO),
    tourist: newTourist(),
    lmia: startScenario(CONTENT, LMIA_SCENARIO),
  };
}

export function reducer(state: AppState, event: AppEvent): AppState {
  switch (event.type) {
    case "SWITCH_MODE":
      return state.mode === event.mode ? state : { ...state, mode: event.mode };
    case "PITCH_CHOOSE":
      return { ...state, pitch: choose(CONTENT, state.pitch, event.index) };
    case "PITCH_RESTART":
      return { ...state, pitch: startScenario(CONTENT, PITCH_SCENARIO) };
    case "TOURIST_ACTION":
      return { ...state, tourist: takeAction(state.tourist, event.actionId, event.rolls) };
    case "TOURIST_DISMISS_TOAST":
      return state.tourist.toast ? { ...state, tourist: { ...state.tourist, toast: null } } : state;
    case "TOURIST_RESTART":
      return { ...state, tourist: newTourist() };
    case "LMIA_CHOOSE":
      return { ...state, lmia: choose(CONTENT, state.lmia, event.index) };
    case "LMIA_RESTART":
      return { ...state, lmia: startScenario(CONTENT, LMIA_SCENARIO) };
    case "LMIA_FROM_TOURIST": {
      // Carry the tourist run into the boardroom: your desperation walks in with you.
      if (state.tourist.status !== "won") return state;
      const base = startScenario(CONTENT, LMIA_SCENARIO);
      const carried = state.tourist.desperation - (base.stats.desperation ?? 0);
      const lmia = startScenario(CONTENT, LMIA_SCENARIO, { desperation: carried, from_tourist_gamble: true });
      return { ...state, mode: "lmia", lmia };
    }
  }
}
