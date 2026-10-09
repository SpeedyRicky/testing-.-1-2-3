extends Node
## Autoload "GameState": the single source of truth for the player.
## Holds the shared metrics, pathway-specific route stats, and story flags.
## Contains no UI and no references to other autoloads, so it is unit-testable.

signal metrics_updated(metrics: Dictionary)
signal phase_changed(new_phase: int)
signal game_over_triggered(reason: String)

const PHASE_NIGERIA := 1
const PHASE_CANADA := 2

const DEFAULT_METRICS := {
	"phase": 1,                       # 1: Nigeria, 2: Canada
	"day": 0,
	"canada_days": 0,                 # days lived in Canada, for the Year One ending
	"naira_wallet": 4500000.0,
	"cad_wallet": 0.0,
	"stamina": 100.0,
	"mental_stress": 30.0,            # 0-100, 100 = burnout
	"family_strain_index": 40.0,      # 0-100, 100 = family breakdown
	"street_cred": 10.0,
	"village_people_multiplier": 1.0, # scales bad-luck events (set, not added)
}

const CLAMPED_0_100: Array[String] = ["stamina", "mental_stress", "family_strain_index"]
const NON_NEGATIVE: Array[String] = ["naira_wallet", "cad_wallet", "street_cred", "day", "canada_days"]
const SET_KEYS: Array[String] = ["village_people_multiplier"]

## Illustrative parallel-market rate and fee. Replace with remote config later;
## real rates move constantly and must never be treated as current.
var ngn_per_cad: float = 1400.0
var remittance_fee: float = 0.0

var metrics: Dictionary = {}
var route_stats: Dictionary = {}
var flags: Dictionary = {}
var game_over_reason: String = ""
## Seeds the Village People event rolls (see DayCycle). New per run, kept in saves.
var run_seed: int = 0


func _init() -> void:
	reset()


func reset() -> void:
	metrics = DEFAULT_METRICS.duplicate(true)
	route_stats = {}
	flags = {}
	game_over_reason = ""
	run_seed = 0
	metrics_updated.emit(metrics)
	phase_changed.emit(int(metrics["phase"]))


## Starts a fresh run with a new event seed. reset() alone keeps seed 0, which
## tests rely on for repeatable results.
func new_run(seed_value: int = -1) -> void:
	reset()
	run_seed = seed_value if seed_value >= 0 else int(Time.get_unix_time_from_system()) % 2147483647


# --- Mutations -------------------------------------------------------------

## Mutation semantics:
##   "set_phase": N          switch geography (emits phase_changed)
##   bool value              story flag
##   key in SET_KEYS         overwrite
##   key in metrics          add delta, then clamp
##   any other number        added into route_stats (pathway-specific stats)
func apply_mutations(mutations: Dictionary) -> void:
	var original_phase := int(metrics["phase"])
	for key in mutations.keys():
		var value: Variant = mutations[key]
		if key == "set_phase":
			if value is int or value is float:
				metrics["phase"] = int(value)
		elif value is bool:
			flags[key] = value
		elif not (value is int or value is float):
			push_warning("GameState: ignoring non-numeric mutation %s" % key)
		elif is_nan(float(value)) or is_inf(float(value)):
			push_warning("GameState: ignoring non-finite mutation %s" % key)
		elif key == "phase":
			push_warning("GameState: use set_phase, not phase")
		elif key in SET_KEYS:
			metrics[key] = float(value)
		elif metrics.has(key):
			metrics[key] = float(metrics[key]) + float(value)
		else:
			route_stats[key] = float(route_stats.get(key, 0.0)) + float(value)
	_clamp_all()
	metrics_updated.emit(metrics)
	if int(metrics["phase"]) != original_phase:
		phase_changed.emit(int(metrics["phase"]))
	_check_failure()


func _clamp_all() -> void:
	for key in CLAMPED_0_100:
		metrics[key] = clampf(float(metrics[key]), 0.0, 100.0)
	for key in NON_NEGATIVE:
		metrics[key] = maxf(float(metrics[key]), 0.0)


func _check_failure() -> void:
	if game_over_reason != "":
		return
	if float(metrics["mental_stress"]) >= 100.0:
		game_over_reason = "BURNOUT_FAILURE"
	elif float(metrics["family_strain_index"]) >= 100.0:
		game_over_reason = "FAMILY_BREAKDOWN"
	if game_over_reason != "":
		game_over_triggered.emit(game_over_reason)


## True if the wallet/stamina deltas in `mutations` can be paid right now.
func can_apply(mutations: Dictionary) -> bool:
	for key in mutations.keys():
		var value: Variant = mutations[key]
		if (value is int or value is float) and float(value) < 0.0:
			if key in ["naira_wallet", "cad_wallet", "stamina"] and metrics.has(key):
				if float(metrics[key]) + float(value) < 0.0:
					return false
	return true


func clear_route_stats() -> void:
	route_stats = {}


## Clears only the named route stats, so a scenario can restart its own
## counters without wiping progress from elsewhere (e.g. the IELTS best score).
func reset_route_stats(keys: Array) -> void:
	for k in keys:
		route_stats.erase(str(k))


func set_route_stat_max(key: String, value: float) -> void:
	route_stats[key] = maxf(float(route_stats.get(key, 0.0)), value)


# --- Cross-currency --------------------------------------------------------

## Converts CAD from the Canadian wallet to Naira in the Nigerian wallet.
## Returns false (and changes nothing) if the player cannot afford it.
func send_remittance(cad_amount: float, strain_relief: float = 20.0) -> bool:
	if cad_amount <= 0.0 or float(metrics["cad_wallet"]) < cad_amount:
		return false
	var naira := cad_amount * ngn_per_cad * (1.0 - remittance_fee)
	apply_mutations({
		"cad_wallet": -cad_amount,
		"naira_wallet": naira,
		"family_strain_index": -strain_relief,
	})
	return true


# --- Conditions (data-driven rules) ---------------------------------------

## Looks up a value by path: "route.x" (route stat), "flag.x" (bool), else a metric.
func get_value(path: String) -> Variant:
	if path.begins_with("route."):
		return float(route_stats.get(path.substr(6), 0.0))
	if path.begins_with("flag."):
		return bool(flags.get(path.substr(5), false))
	if metrics.has(path):
		return metrics[path]
	return 0.0


## conditions: { "route.investor_interest": [">=", 70], "flag.clb9": ["==", true] }
## All entries must hold.
func evaluate(conditions: Dictionary) -> bool:
	for path in conditions.keys():
		var rule: Variant = conditions[path]
		if not (rule is Array) or rule.size() != 2:
			push_warning("GameState: malformed condition for %s" % path)
			return false
		var current: Variant = get_value(path)
		var target: Variant = rule[1]
		match str(rule[0]):
			">=": if not (float(current) >= float(target)): return false
			">": if not (float(current) > float(target)): return false
			"<=": if not (float(current) <= float(target)): return false
			"<": if not (float(current) < float(target)): return false
			"==": if current != target: return false
			"!=": if current == target: return false
			_:
				push_warning("GameState: unknown operator %s" % str(rule[0]))
				return false
	return true


# --- Persistence -----------------------------------------------------------

func to_dict() -> Dictionary:
	return {
		"metrics": metrics.duplicate(true),
		"route_stats": route_stats.duplicate(true),
		"flags": flags.duplicate(true),
		"game_over_reason": game_over_reason,
		"run_seed": run_seed,
	}


## Restores only known keys with numeric values, so a damaged or edited save
## cannot inject unexpected types.
func from_dict(data: Dictionary) -> void:
	reset()
	var saved_metrics: Dictionary = data.get("metrics", {})
	for key in DEFAULT_METRICS.keys():
		var v: Variant = saved_metrics.get(key)
		if v is int or v is float:
			metrics[key] = float(v)
	metrics["phase"] = int(metrics["phase"])
	var saved_route: Dictionary = data.get("route_stats", {})
	for key in saved_route.keys():
		var v: Variant = saved_route[key]
		if v is int or v is float:
			route_stats[str(key)] = float(v)
	var saved_flags: Dictionary = data.get("flags", {})
	for key in saved_flags.keys():
		if saved_flags[key] is bool:
			flags[str(key)] = saved_flags[key]
	game_over_reason = str(data.get("game_over_reason", ""))
	var saved_seed: Variant = data.get("run_seed", 0)
	if saved_seed is int or saved_seed is float:
		run_seed = clampi(int(saved_seed), 0, 2147483647)
	_clamp_all()
	metrics_updated.emit(metrics)
	phase_changed.emit(int(metrics["phase"]))
