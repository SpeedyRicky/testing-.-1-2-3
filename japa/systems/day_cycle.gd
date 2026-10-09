class_name DayCycle
extends RefCounted
## Pure day-tick logic: daily living costs and seeded Village People events.
## No nodes, no autoloads: pass in the state and the event table, so headless
## balancing runs can call it directly.
##
## Determinism: the roll for a given day depends only on (run_seed, day), so a
## save/load never changes what happens next and a run can be replayed exactly.

const EVENTS_PATH := "res://data/events.json"

## Illustrative game numbers, not real cost-of-living data.
const LIVING_COST := {
	1: {"naira_wallet": -10000.0},   # Lagos: food, transport, data
	2: {"cad_wallet": -30.0, "family_strain_index": 1.0},  # Canada: groceries, transit; home misses you
}
const BROKE_STRESS := 6.0
const BASE_EVENT_CHANCE := 0.15
const MAX_EVENT_CHANCE := 0.6


static func load_events(path: String = EVENTS_PATH) -> Array:
	if not FileAccess.file_exists(path):
		push_error("DayCycle: events file not found: %s" % path)
		return []
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if parsed is Dictionary:
		return parsed.get("events", [])
	push_error("DayCycle: could not parse %s" % path)
	return []


static func event_chance(state: Node) -> float:
	var mult := float(state.metrics.get("village_people_multiplier", 1.0))
	return clampf(BASE_EVENT_CHANCE * mult, 0.0, MAX_EVENT_CHANCE)


## Applies the living cost for each day from `from_day` (exclusive) to `to_day`
## (inclusive) and rolls for an event on each. Returns the scenario id of the
## first event that fires, or "" if none did. At most one event per call, so a
## single action never chains several crises.
static func pass_days(state: Node, events: Array, from_day: int, to_day: int) -> String:
	var fired := ""
	for day in range(from_day + 1, to_day + 1):
		if state.game_over_reason != "":
			return ""
		var phase := int(state.metrics["phase"])
		var cost: Dictionary = LIVING_COST.get(phase, {})
		if not state.can_apply(cost):
			# Can't cover today's food and transport: it shows up as stress.
			state.apply_mutations({"mental_stress": BROKE_STRESS})
		state.apply_mutations(cost)
		if phase == 2:
			state.apply_mutations({"canada_days": 1})
		if fired == "":
			fired = roll_event(state, events, day)
	return fired


## The event (scenario id) that fires on `day`, or "". Marks it seen.
static func roll_event(state: Node, events: Array, day: int) -> String:
	var rng := RandomNumberGenerator.new()
	rng.seed = hash([int(state.run_seed), day])
	if rng.randf() >= event_chance(state):
		return ""
	var pool := eligible_events(state, events)
	if pool.is_empty():
		return ""
	var total := 0.0
	for e in pool:
		total += float(e.get("weight", 1.0))
	var pick := rng.randf() * total
	for e in pool:
		pick -= float(e.get("weight", 1.0))
		if pick < 0.0:
			state.apply_mutations({"seen_" + str(e["id"]): true})
			return str(e["scenario"])
	var last: Dictionary = pool[pool.size() - 1]
	state.apply_mutations({"seen_" + str(last["id"]): true})
	return str(last["scenario"])


static func eligible_events(state: Node, events: Array) -> Array:
	var out: Array = []
	var phase := int(state.metrics["phase"])
	for e in events:
		if int(e.get("phase", 0)) != phase:
			continue
		if e.get("once", false) and bool(state.flags.get("seen_" + str(e["id"]), false)):
			continue
		if e.has("when") and not state.evaluate(e["when"]):
			continue
		out.append(e)
	return out
