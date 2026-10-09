// Startup Visa pitch: stat labels and the Letter of Support resolution.
// The thresholds are read from the `suv_resolve` node in the shared content,
// so the web game and the Godot game can never disagree about who wins.
import { CONTENT, type Content, type DialogueState, type Op, check, getValue } from "./dialogue";

export const PITCH_SCENARIO = "suv_pitch";
const RESOLVE_NODE = "suv_resolve";

export const PITCH_STATS = [
  { key: "investor_interest", label: "Investor Interest" },
  { key: "technical_credibility", label: "Technical Credibility" },
  { key: "scalability", label: "Scalability Score" },
] as const;

export const PANEL = [
  { id: "vance", name: "Ms. Vance", role: "Committee Chair", initials: "EV", hue: "from-indigo-500/30 to-violet-500/10" },
  { id: "chen", name: "Mr. Chen", role: "Chief Technology Officer", initials: "DC", hue: "from-sky-500/30 to-cyan-500/10" },
  { id: "ross", name: "Mr. Ross", role: "Managing Partner", initials: "JR", hue: "from-amber-500/30 to-orange-500/10" },
] as const;

export interface Criterion {
  key: string;
  label: string;
  op: Op;
  threshold: number;
  value: number;
  passed: boolean;
}

export interface LetterOfSupportResult {
  issued: boolean;
  criteria: Criterion[];
  /** Stats that are tracked but not part of the committee's decision rule. */
  informational: { key: string; label: string; value: number }[];
  summary: string;
}

const labelFor = (key: string) => PITCH_STATS.find((s) => s.key === key)?.label ?? key;

/** The committee's decision rule: every condition on the first (winning)
 *  branch of suv_resolve must hold. Mirrors GameState.evaluate in Godot. */
export function resolveLetterOfSupport(state: DialogueState, content: Content = CONTENT): LetterOfSupportResult {
  const winning = content.dialogue_nodes[RESOLVE_NODE]?.auto_branch?.find((b) => b.when)?.when ?? {};
  const criteria: Criterion[] = Object.entries(winning).map(([path, [op, target]]) => {
    const key = path.replace(/^route\./, "");
    const value = Number(getValue(state, path));
    return { key, label: labelFor(key), op, threshold: Number(target), value, passed: check(value, op, target) };
  });
  const issued = criteria.length > 0 && criteria.every((c) => c.passed);
  const used = new Set(criteria.map((c) => c.key));
  const informational = PITCH_STATS.filter((s) => !used.has(s.key)).map((s) => ({
    key: s.key, label: s.label, value: state.stats[s.key] ?? 0,
  }));
  const failed = criteria.filter((c) => !c.passed);
  const summary = issued
    ? "The committee votes yes. A Letter of Support is required for the Startup Visa, but it does not by itself grant permanent residence."
    : `The committee passes. Short on: ${failed.map((c) => `${c.label} (${Math.round(c.value)} of ${c.threshold} needed)`).join(", ")}.`;
  return { issued, criteria, informational, summary };
}

/** Which panel tile is speaking, from a node's speaker string. */
export function activeSpeaker(speaker: string | undefined): string | null {
  if (!speaker) return null;
  const hit = PANEL.find((p) => speaker.startsWith(p.name));
  return hit ? hit.id : null;
}
