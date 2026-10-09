extends Node
## Autoload "Narrative": runs the data-driven dialogue graph in data/japa_nodes.json.
##
## Node fields:
##   speaker, text, choices[]                 normal dialogue node
##   on_enter: {mutations}                    applied once when the node is entered
##   auto_branch: [{when:{conditions}, next_node}, ...]   resolved instantly, never shown
##   terminal_condition, outcome, celebration ends the scenario ("win"/"fail"/"neutral")
## Choice fields:
##   text, next_node, mutations, requires:{conditions}, locked_hint,
##   tag + feedback (shown AFTER the choice, never before)
## Timed nodes: time_limit (seconds) + timeout (a hidden choice: next_node,
##   mutations, tag, feedback) taken when the clock runs out. The UI owns the
##   clock and calls time_out().
## Scenario fields: start_node, phase, setup, reset_stats:[keys], requires,
##   locked_hint, done_flag, replayable, event (hidden from the menu).
## The id "dashboard_home" returns to the menu.

signal dialogue_loaded(speaker: String, text: String, choices: Array)
signal choice_feedback(tag: String, text: String)
signal scenario_ended(outcome: String, reason: String, celebration: Dictionary)
signal returned_to_dashboard

const DATA_PATH := "res://data/japa_nodes.json"
const DASHBOARD_NODE := "dashboard_home"
const MAX_AUTO_HOPS := 16

## Injected so the logic can be tested without autoload singletons.
var state: Node
var loc: Node

var db: Dictionary = {}
var scenarios: Array = []
var current_node_id: String = ""
var active: bool = false


func _ready() -> void:
	state = get_node_or_null("/root/GameState")
	loc = get_node_or_null("/root/Localization")
	load_database()


func load_database(path: String = DATA_PATH) -> bool:
	if not FileAccess.file_exists(path):
		push_error("Narrative: data file not found: %s" % path)
		return false
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not (parsed is Dictionary):
		push_error("Narrative: JSON parse failure in %s" % path)
		return false
	db = parsed.get("dialogue_nodes", {})
	scenarios = parsed.get("scenarios", [])
	return true


func get_scenario(scenario_id: String) -> Dictionary:
	for s in scenarios:
		if s.get("id", "") == scenario_id:
			return s
	return {}


## Menu scenarios (not events) for the current phase, in data order.
func menu_scenarios() -> Array:
	var out: Array = []
	for s in scenarios:
		if s.get("event", false):
			continue
		if s.has("phase") and int(s["phase"]) != int(state.metrics["phase"]):
			continue
		out.append(s)
	return out


func is_done(scenario: Dictionary) -> bool:
	return bool(state.flags.get(str(scenario.get("done_flag", "")), false))


## True if the player may start this scenario now: phase matches (when given),
## its requirements hold, and it is not finished (unless replayable).
func is_available(scenario: Dictionary) -> bool:
	if scenario.has("phase") and int(scenario["phase"]) != int(state.metrics["phase"]):
		return false
	if is_done(scenario) and not scenario.get("replayable", false):
		return false
	if scenario.has("requires") and not state.evaluate(scenario["requires"]):
		return false
	return true


# --- Running ---------------------------------------------------------------

func start_scenario(scenario_id: String) -> bool:
	var scenario := get_scenario(scenario_id)
	if scenario.is_empty():
		push_error("Narrative: unknown scenario %s" % scenario_id)
		return false
	if scenario.get("fresh_route_stats", false):
		state.clear_route_stats()
	if scenario.has("reset_stats"):
		state.reset_route_stats(scenario["reset_stats"])
	if scenario.has("phase"):
		state.apply_mutations({"set_phase": scenario["phase"]})
	if scenario.has("setup"):
		state.apply_mutations(scenario["setup"])
	execute_node(str(scenario["start_node"]))
	return true


## Re-enters a node from a save without re-applying its on_enter mutations.
func resume(node_id: String) -> void:
	execute_node(node_id, false)


func execute_node(node_id: String, apply_enter: bool = true) -> void:
	var hops := 0
	while true:
		if node_id == DASHBOARD_NODE:
			active = false
			current_node_id = ""
			returned_to_dashboard.emit()
			return
		if not db.has(node_id):
			push_error("Narrative: missing node id: %s" % node_id)
			active = false
			current_node_id = ""
			scenario_ended.emit("error", "MISSING_NODE:" + node_id, {})
			return
		var node: Dictionary = db[node_id]
		if apply_enter and node.has("on_enter"):
			state.apply_mutations(node["on_enter"])
			if state.game_over_reason != "":
				active = false
				current_node_id = ""
				scenario_ended.emit("fail", state.game_over_reason, {})
				return
		apply_enter = true
		if node.has("auto_branch"):
			hops += 1
			if hops > MAX_AUTO_HOPS:
				push_error("Narrative: auto_branch loop at %s" % node_id)
				active = false
				scenario_ended.emit("error", "BRANCH_LOOP", {})
				return
			node_id = _resolve_branch(node["auto_branch"])
			continue
		current_node_id = node_id
		break

	var node_data: Dictionary = db[current_node_id]
	var text := str(node_data.get("text", ""))
	if loc != null:
		text = loc.text_for(current_node_id, text)
	var speaker := str(node_data.get("speaker", "System"))

	if node_data.has("terminal_condition"):
		active = false
		dialogue_loaded.emit(speaker, text, [])
		scenario_ended.emit(
			str(node_data.get("outcome", "fail")),
			str(node_data["terminal_condition"]),
			node_data.get("celebration", {}))
		return

	active = true
	dialogue_loaded.emit(speaker, text, _present_choices(node_data))


func _present_choices(node_data: Dictionary) -> Array:
	var out: Array = []
	var choices: Array = node_data.get("choices", [])
	for i in choices.size():
		var c: Dictionary = choices[i]
		var enabled := true
		if c.has("requires"):
			enabled = state.evaluate(c["requires"])
		out.append({
			"index": i,
			"text": str(c.get("text", "")),
			"enabled": enabled,
			"locked_hint": str(c.get("locked_hint", "")),
		})
	return out


## Seconds allowed on the current node, or 0 when it is untimed.
func time_limit() -> float:
	if not active or not db.has(current_node_id):
		return 0.0
	return float(db[current_node_id].get("time_limit", 0.0))


## Called by the UI when the clock runs out: takes the node's hidden `timeout`
## choice. Returns false when the current node is not timed.
func time_out() -> bool:
	if time_limit() <= 0.0:
		return false
	return _take_choice(db[current_node_id].get("timeout", {}))


func _resolve_branch(branches: Array) -> String:
	for b in branches:
		if not b.has("when") or state.evaluate(b["when"]):
			return str(b.get("next_node", DASHBOARD_NODE))
	return DASHBOARD_NODE


## Called by UI choice buttons. Returns false (and changes nothing) for an
## invalid index, a locked choice, or when no dialogue is active.
func select_choice(choice_index: int) -> bool:
	if not active or not db.has(current_node_id):
		return false
	var choices: Array = db[current_node_id].get("choices", [])
	if choice_index < 0 or choice_index >= choices.size():
		push_warning("Narrative: invalid choice index %d at %s" % [choice_index, current_node_id])
		return false
	var choice: Dictionary = choices[choice_index]
	if choice.has("requires") and not state.evaluate(choice["requires"]):
		return false
	return _take_choice(choice)


func _take_choice(choice: Dictionary) -> bool:
	state.apply_mutations(choice.get("mutations", {}))
	if choice.has("tag") or choice.has("feedback"):
		choice_feedback.emit(str(choice.get("tag", "")), str(choice.get("feedback", "")))

	if state.game_over_reason != "":
		active = false
		scenario_ended.emit("fail", state.game_over_reason, {})
		return true
	execute_node(str(choice.get("next_node", DASHBOARD_NODE)))
	return true
