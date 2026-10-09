// TypeScript port of the Godot dialogue runner (japa/scripts/global/narrative.gd).
// Pure functions over plain data: every call returns a new state.
import content from "../content/japa_nodes.json";

export type Op = ">=" | ">" | "<=" | "<" | "==" | "!=";
export type Conditions = Record<string, [Op, number | boolean]>;
export type Mutations = Record<string, number | boolean>;

export interface Choice {
  text: string;
  next_node: string;
  mutations?: Mutations;
  requires?: Conditions;
  locked_hint?: string;
  tag?: string;
  feedback?: string;
}

export interface DialogueNode {
  speaker?: string;
  text?: string;
  choices?: Choice[];
  on_enter?: Mutations;
  auto_branch?: { when?: Conditions; next_node: string }[];
  terminal_condition?: string;
  outcome?: "win" | "fail" | "neutral";
  celebration?: { title?: string; subtitle?: string; style?: string };
}

export interface Scenario {
  id: string;
  title: string;
  subtitle: string;
  start_node: string;
  setup?: Mutations;
}

export interface Content {
  scenarios: Scenario[];
  dialogue_nodes: Record<string, DialogueNode>;
}

export interface Outcome {
  result: "win" | "fail" | "neutral" | "error";
  reason: string;
  celebration?: DialogueNode["celebration"];
  /** The auto_branch node that decided the result, if any (used by resolution screens). */
  decidedBy?: string;
}

export interface TranscriptLine {
  speaker: string;
  text: string;
  answer?: string;
  tag?: string;
}

export interface DialogueState {
  scenarioId: string;
  nodeId: string;
  stats: Record<string, number>;
  flags: Record<string, boolean>;
  feedback: { tag: string; text: string } | null;
  outcome: Outcome | null;
  transcript: TranscriptLine[];
}

export const DASHBOARD = "dashboard_home";
const MAX_AUTO_HOPS = 16;

export const CONTENT = content as unknown as Content;

export function applyMutations(state: DialogueState, mutations: Mutations = {}): DialogueState {
  const stats = { ...state.stats };
  const flags = { ...state.flags };
  for (const [key, value] of Object.entries(mutations)) {
    if (typeof value === "boolean") flags[key] = value;
    else if (Number.isFinite(value)) stats[key] = (stats[key] ?? 0) + value;
  }
  return { ...state, stats, flags };
}

export function getValue(state: DialogueState, path: string): number | boolean {
  if (path.startsWith("flag.")) return state.flags[path.slice(5)] ?? false;
  if (path.startsWith("route.")) return state.stats[path.slice(6)] ?? 0;
  return state.stats[path] ?? 0;
}

export function check(current: number | boolean, op: Op, target: number | boolean): boolean {
  switch (op) {
    case ">=": return Number(current) >= Number(target);
    case ">": return Number(current) > Number(target);
    case "<=": return Number(current) <= Number(target);
    case "<": return Number(current) < Number(target);
    case "==": return current === target;
    case "!=": return current !== target;
    default: return false;
  }
}

export function evaluate(state: DialogueState, conditions: Conditions = {}): boolean {
  return Object.entries(conditions).every(([path, [op, target]]) => check(getValue(state, path), op, target));
}

/** Enters `nodeId`: applies on_enter, follows auto_branch hops, and stops on a
 *  dialogue node (waiting for a choice) or a terminal node (outcome set). */
export function enterNode(content: Content, state: DialogueState, nodeId: string): DialogueState {
  let s = state;
  let id = nodeId;
  let decidedBy: string | undefined;
  for (let hops = 0; ; hops++) {
    if (id === DASHBOARD) {
      return { ...s, nodeId: id, outcome: { result: "neutral", reason: "RETURNED_TO_DASHBOARD", decidedBy } };
    }
    const node = content.dialogue_nodes[id];
    if (!node) return { ...s, nodeId: id, outcome: { result: "error", reason: `MISSING_NODE:${id}` } };
    if (node.on_enter) s = applyMutations(s, node.on_enter);
    if (!node.auto_branch) break;
    if (hops >= MAX_AUTO_HOPS) return { ...s, outcome: { result: "error", reason: "BRANCH_LOOP" } };
    decidedBy = id;
    const hit = node.auto_branch.find((b) => !b.when || evaluate(s, b.when));
    id = hit?.next_node ?? DASHBOARD;
  }
  const node = content.dialogue_nodes[id];
  s = { ...s, nodeId: id };
  if (node.terminal_condition) {
    s = {
      ...s,
      transcript: [...s.transcript, { speaker: node.speaker ?? "System", text: node.text ?? "" }],
      outcome: { result: node.outcome ?? "fail", reason: node.terminal_condition, celebration: node.celebration, decidedBy },
    };
  }
  return s;
}

export function startScenario(content: Content, scenarioId: string, extraSetup: Mutations = {}): DialogueState {
  const scenario = content.scenarios.find((sc) => sc.id === scenarioId);
  const blank: DialogueState = {
    scenarioId, nodeId: "", stats: {}, flags: {}, feedback: null, outcome: null, transcript: [],
  };
  if (!scenario) return { ...blank, outcome: { result: "error", reason: `UNKNOWN_SCENARIO:${scenarioId}` } };
  const seeded = applyMutations(applyMutations(blank, scenario.setup), extraSetup);
  return enterNode(content, seeded, scenario.start_node);
}

export function currentNode(content: Content, state: DialogueState): DialogueNode | undefined {
  return content.dialogue_nodes[state.nodeId];
}

export interface PresentedChoice extends Choice {
  index: number;
  enabled: boolean;
}

export function presentChoices(content: Content, state: DialogueState): PresentedChoice[] {
  if (state.outcome) return [];
  const node = currentNode(content, state);
  return (node?.choices ?? []).map((c, index) => ({ ...c, index, enabled: !c.requires || evaluate(state, c.requires) }));
}

/** Takes choice `index`. Invalid or locked choices return the state unchanged. */
export function choose(content: Content, state: DialogueState, index: number): DialogueState {
  if (state.outcome) return state;
  const node = currentNode(content, state);
  const choice = node?.choices?.[index];
  if (!node || !choice) return state;
  if (choice.requires && !evaluate(state, choice.requires)) return state;
  let s = applyMutations(state, choice.mutations);
  s = {
    ...s,
    feedback: choice.tag || choice.feedback ? { tag: choice.tag ?? "", text: choice.feedback ?? "" } : null,
    transcript: [...s.transcript, { speaker: node.speaker ?? "System", text: node.text ?? "", answer: choice.text, tag: choice.tag }],
  };
  return enterNode(content, s, choice.next_node);
}

const ACRONYMS = new Set(["roi", "lmia", "ielts", "clb", "suv", "los", "ircc"]);

/** "HIGH_VALUE_MATCH" -> "High value match"; "STRONG_ROI_CASE" -> "Strong ROI case" */
export function formatTag(raw: string): string {
  if (!raw) return "";
  const words = raw.split("_").map((w) => w.toLowerCase());
  const s = words.map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w)).join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
