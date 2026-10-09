extends SceneTree
## Headless tests. Run:
##   godot --headless --path . -s res://tests/run_tests.gd

const GameStateScript := preload("res://scripts/global/game_state.gd")
const NarrativeScript := preload("res://scripts/global/narrative.gd")
const SaveStoreScript := preload("res://scripts/global/save_store.gd")
const LocalizationScript := preload("res://scripts/global/localization.gd")
const DayCycleScript := preload("res://systems/day_cycle.gd")

const TEST_SAVE := "user://test_save.json"

var _failures := 0
var _checks := 0


func _init() -> void:
	_test_parser()
	_test_scoring()
	_test_passages()
	_test_fmt()
	_test_game_state()
	_test_conditions()
	_test_state_roundtrip_hardening()
	_test_data_integrity()
	_test_narrative_paths()
	_test_on_enter_game_over()
	_test_campaign_rules()
	_test_embassy_and_funding()
	_test_day_cycle()
	_test_campaign_bot()
	_test_localization()
	_test_fuzz_playthroughs()
	_test_fuzz_mutations()
	_test_save_store()
	print("%d checks run" % _checks)
	if _failures == 0:
		print("ALL TESTS PASSED")
	else:
		printerr("%d TEST(S) FAILED" % _failures)
	quit(1 if _failures > 0 else 0)


func _check(cond: bool, msg: String) -> void:
	_checks += 1
	if not cond:
		_failures += 1
		printerr("FAIL: " + msg)


# --- Builders --------------------------------------------------------------

func _make_stack() -> Dictionary:
	var gs := GameStateScript.new()
	var loc := LocalizationScript.new()
	loc.load_data()
	var nar := NarrativeScript.new()
	nar.state = gs
	nar.loc = loc
	nar.load_database()
	return {"gs": gs, "loc": loc, "nar": nar}


func _free_stack(stack: Dictionary) -> void:
	for k in stack.keys():
		stack[k].free()


# --- M0: parser, scoring, passages ------------------------------------------

func _test_parser() -> void:
	var segs := PassageParser.parse("Dear Sir[/,] I write[./.] End")
	_check(PassageParser.slot_count(segs) == 2, "parser finds 2 slots")
	_check(segs[0].value == "Dear Sir", "first text segment")
	_check(segs[1].shown == "" and segs[1].correct == ",", "missing-comma slot")
	_check(segs[3].shown == "." and segs[3].correct == ".", "distractor slot")
	_check(segs[4].value == " End", "trailing text kept")


func _slot(shown: String, correct: String, current: String) -> Dictionary:
	return {"shown": shown, "correct": correct, "current": current}


func _test_scoring() -> void:
	_check(IeltsScoring.next_mark("") == ",", "cycle starts at comma")
	_check(IeltsScoring.next_mark("!") == "", "cycle wraps")
	var perfect := IeltsScoring.evaluate([_slot("", ",", ","), _slot(".", ".", ".")])
	_check(perfect.band == 7.5 and perfect.clb == 10, "perfect run is band 7.5 / CLB 10")
	var nine_of_ten: Array = []
	for i in 9:
		nine_of_ten.append(_slot("", ",", ","))
	nine_of_ten.append(_slot("", ",", ""))
	var one_missed := IeltsScoring.evaluate(nine_of_ten)
	_check(one_missed.accuracy == 0.9 and one_missed.band == 7.0, "9/10 fixed is band 7.0")
	_check(one_missed.meets_clb9, "band 7.0 meets CLB 9")
	var broke := IeltsScoring.evaluate([_slot("", ",", ","), _slot(".", ".", ",")])
	_check(broke.broken == 1 and broke.accuracy == 0.0, "breaking a correct mark cancels the fix")
	var none := IeltsScoring.evaluate([_slot("", ",", ""), _slot("", ",", "")])
	_check(none.band == 4.0 and not none.meets_clb9, "nothing fixed is band 4.0")


func _test_passages() -> void:
	var data: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/ielts_passages.json"))
	_check(data is Dictionary, "passages json parses")
	if not data is Dictionary:
		return
	for p in data["passages"]:
		var segs := PassageParser.parse(p["text"])
		_check(PassageParser.slot_count(segs) >= 10, "%s has enough slots" % p["id"])
		for s in segs:
			if s.type == "slot":
				_check(IeltsScoring.MARKS.has(s.shown) and IeltsScoring.MARKS.has(s.correct),
					"%s uses only supported marks" % p["id"])


func _test_fmt() -> void:
	_check(Fmt.money(1234567.4) == "1,234,567", "money groups thousands")
	_check(Fmt.money(0.0) == "0", "money zero")
	_check(Fmt.money(-1500.0) == "-1,500", "money negative")
	_check(Fmt.money(999.0) == "999", "money under 1000")
	_check(Fmt.tag("GOOD_INSTINCT") == "Good instinct", "tag humanised")


# --- GameState ---------------------------------------------------------------

func _test_game_state() -> void:
	var gs := GameStateScript.new()
	gs.apply_mutations({"stamina": -500, "mental_stress": 999})
	_check(gs.metrics["stamina"] == 0.0, "stamina clamps at 0")
	_check(gs.metrics["mental_stress"] == 100.0, "stress clamps at 100")
	_check(gs.game_over_reason == "BURNOUT_FAILURE", "stress 100 triggers burnout")

	gs.reset()
	var fired: Array = []
	gs.game_over_triggered.connect(func(r: String) -> void: fired.append(r))
	gs.apply_mutations({"family_strain_index": 120})
	gs.apply_mutations({"mental_stress": 999})
	_check(fired.size() == 1 and fired[0] == "FAMILY_BREAKDOWN", "game over fires once, first cause wins")

	gs.reset()
	gs.apply_mutations({"unlocked_shelter": true, "investor_interest": 25, "village_people_multiplier": 2.5})
	_check(gs.flags.get("unlocked_shelter") == true, "bool mutation becomes a flag")
	_check(gs.route_stats["investor_interest"] == 25.0, "unknown numeric goes to route_stats")
	gs.apply_mutations({"investor_interest": -5})
	_check(gs.route_stats["investor_interest"] == 20.0, "route stats accumulate")
	_check(gs.metrics["village_people_multiplier"] == 2.5, "set-key overwrites")
	gs.apply_mutations({"village_people_multiplier": 1.5})
	_check(gs.metrics["village_people_multiplier"] == 1.5, "set-key overwrites, not adds")

	var phases: Array = []
	gs.phase_changed.connect(func(p: int) -> void: phases.append(p))
	gs.apply_mutations({"set_phase": 2})
	_check(phases == [2], "set_phase emits phase_changed once")
	gs.apply_mutations({"street_cred": 1})
	_check(phases == [2], "no phase signal without a change")

	gs.reset()
	gs.apply_mutations({"naira_wallet": -99999999.0})
	_check(gs.metrics["naira_wallet"] == 0.0, "wallet never goes negative")
	gs.apply_mutations({"stamina": NAN})
	_check(not is_nan(float(gs.metrics["stamina"])), "NaN mutation rejected")

	gs.reset()
	_check(not gs.can_apply({"cad_wallet": -1.0}), "can_apply rejects overspend")
	_check(gs.can_apply({"stamina": -100.0}), "can_apply allows exactly affordable")
	_check(not gs.can_apply({"stamina": -101.0}), "can_apply rejects too much stamina")

	gs.reset()
	_check(not gs.send_remittance(400.0), "remittance fails with an empty CAD wallet")
	gs.apply_mutations({"cad_wallet": 1000.0})
	var naira_before: float = gs.metrics["naira_wallet"]
	_check(gs.send_remittance(400.0), "remittance succeeds with funds")
	_check(gs.metrics["cad_wallet"] == 600.0, "remittance debits CAD")
	_check(gs.metrics["naira_wallet"] == naira_before + 560000.0, "remittance credits Naira at 1400")
	_check(gs.metrics["family_strain_index"] == 20.0, "remittance relieves strain (40 -> 20)")
	gs.free()


func _test_conditions() -> void:
	var gs := GameStateScript.new()
	gs.apply_mutations({"investor_interest": 70, "clb9": true})
	_check(gs.evaluate({"route.investor_interest": [">=", 70]}), "route >= passes at boundary")
	_check(not gs.evaluate({"route.investor_interest": [">", 70]}), "route > fails at boundary")
	_check(gs.evaluate({"flag.clb9": ["==", true]}), "flag == true")
	_check(not gs.evaluate({"flag.nope": ["==", true]}), "missing flag is false")
	_check(gs.evaluate({"street_cred": [">=", 10]}), "metric lookup")
	_check(not gs.evaluate({"route.investor_interest": [">=", 70], "route.technical_credibility": [">=", 65]}), "all conditions must hold")
	_check(not gs.evaluate({"street_cred": ["~", 1]}), "unknown operator fails safe")
	_check(not gs.evaluate({"street_cred": 5}), "malformed condition fails safe")
	gs.free()


func _test_state_roundtrip_hardening() -> void:
	var gs := GameStateScript.new()
	gs.apply_mutations({"cad_wallet": 123.0, "x_stat": 4, "a_flag": true, "set_phase": 2})
	var snap: Dictionary = gs.to_dict()
	var gs2 := GameStateScript.new()
	gs2.from_dict(snap)
	_check(gs2.metrics["cad_wallet"] == 123.0 and int(gs2.metrics["phase"]) == 2, "state round-trips")
	_check(gs2.route_stats["x_stat"] == 4.0 and gs2.flags["a_flag"] == true, "route stats and flags round-trip")
	var gs3 := GameStateScript.new()
	gs3.from_dict({"metrics": {"mental_stress": "lots", "stamina": 5000, "evil": 1}, "flags": {"f": "yes"}, "route_stats": {"r": "bad"}})
	_check(gs3.metrics["mental_stress"] == 30.0, "non-numeric metric ignored, default kept")
	_check(gs3.metrics["stamina"] == 100.0, "out-of-range metric clamped on load")
	_check(not gs3.metrics.has("evil"), "unknown metric key not injected")
	_check(not gs3.flags.has("f") and not gs3.route_stats.has("r"), "bad flag/route types dropped")
	for g in [gs, gs2, gs3]:
		g.free()


# --- Data integrity ---------------------------------------------------------

func _collect_mutation_problems(where: String, mutations: Variant, out: Array) -> void:
	if not (mutations is Dictionary):
		out.append("%s: mutations is not an object" % where)
		return
	for k in mutations.keys():
		var v: Variant = mutations[k]
		if not (v is bool or v is int or v is float):
			out.append("%s: mutation %s has non-scalar value" % [where, k])


func _test_data_integrity() -> void:
	var data: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/japa_nodes.json"))
	_check(data is Dictionary, "japa_nodes.json parses")
	if not data is Dictionary:
		return
	var nodes: Dictionary = data["dialogue_nodes"]
	var problems: Array = []
	var ops := [">=", ">", "<=", "<", "==", "!="]
	for id in nodes.keys():
		var n: Dictionary = nodes[id]
		if n.has("on_enter"):
			_collect_mutation_problems(id + ".on_enter", n["on_enter"], problems)
		if n.has("terminal_condition") and not ["win", "fail", "neutral"].has(n.get("outcome", "")):
			problems.append("%s: terminal without valid outcome" % id)
		if n.has("terminal_condition") and not n.get("choices", []).is_empty():
			problems.append("%s: terminal node has choices" % id)
		if n.has("auto_branch"):
			var ab: Array = n["auto_branch"]
			if ab.is_empty() or ab[ab.size() - 1].has("when"):
				problems.append("%s: auto_branch needs an unconditional fallback last" % id)
			for b in ab:
				var target: String = b.get("next_node", "")
				if target != "dashboard_home" and not nodes.has(target):
					problems.append("%s: auto_branch -> missing %s" % [id, target])
				for path in b.get("when", {}).keys():
					var rule: Array = b["when"][path]
					if rule.size() != 2 or not ops.has(rule[0]):
						problems.append("%s: bad condition on %s" % [id, path])
		elif not n.has("terminal_condition") and n.get("choices", []).is_empty():
			problems.append("%s: dead end (no choices, not terminal)" % id)
		for i in n.get("choices", []).size():
			var c: Dictionary = n["choices"][i]
			var tgt: String = c.get("next_node", "")
			if tgt != "dashboard_home" and not nodes.has(tgt):
				problems.append("%s.choice[%d] -> missing %s" % [id, i, tgt])
			_collect_mutation_problems("%s.choice[%d]" % [id, i], c.get("mutations", {}), problems)
			for path in c.get("requires", {}).keys():
				var rule2: Array = c["requires"][path]
				if rule2.size() != 2 or not ops.has(rule2[0]):
					problems.append("%s.choice[%d]: bad requires on %s" % [id, i, path])
	for p in problems:
		printerr("DATA PROBLEM: " + p)
	_check(problems.is_empty(), "dialogue data has no structural problems (%d found)" % problems.size())

	# Reachability: every node must be reachable from some scenario start.
	var reachable := {}
	var queue: Array = []
	for s in data["scenarios"]:
		_check(nodes.has(s["start_node"]), "scenario %s start node exists" % s["id"])
		queue.append(s["start_node"])
	while not queue.is_empty():
		var cur: String = queue.pop_back()
		if reachable.has(cur) or not nodes.has(cur):
			continue
		reachable[cur] = true
		for c in nodes[cur].get("choices", []):
			queue.append(c.get("next_node", ""))
		for b in nodes[cur].get("auto_branch", []):
			queue.append(b.get("next_node", ""))
	for id in nodes.keys():
		_check(reachable.has(id), "node %s is reachable from a scenario" % id)

	# Timed nodes need a valid hidden timeout choice.
	for id in nodes.keys():
		var tn: Dictionary = nodes[id]
		if tn.has("time_limit"):
			var to: Dictionary = tn.get("timeout", {})
			var to_target: String = to.get("next_node", "")
			_check(to_target == "dashboard_home" or nodes.has(to_target), "%s: timeout leads to a real node" % id)
			var tprobs: Array = []
			_collect_mutation_problems(id + ".timeout", to.get("mutations", {}), tprobs)
			_check(tprobs.is_empty(), "%s: timeout mutations are scalar" % id)

	# Events: each points at an event scenario of the same phase.
	var events: Array = DayCycleScript.load_events()
	_check(events.size() >= 8, "events.json loads (%d events)" % events.size())
	var by_id := {}
	for sc in data["scenarios"]:
		by_id[sc["id"]] = sc
	for e in events:
		var sc: Dictionary = by_id.get(e.get("scenario", ""), {})
		_check(not sc.is_empty(), "event %s has a scenario" % e.get("id", "?"))
		_check(sc.get("event", false) or e["scenario"] == "devaluation", "event %s scenario is hidden from the menu" % e["id"])
		_check(int(sc.get("phase", 0)) == int(e.get("phase", -1)), "event %s phase matches its scenario" % e["id"])
		for path in e.get("when", {}).keys():
			_check(ops.has(e["when"][path][0]), "event %s condition operator valid" % e["id"])

	var actions: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/actions.json"))
	_check(actions is Dictionary and actions["actions"].size() > 0, "actions.json loads")
	for a in actions["actions"]:
		_check(a.has("label") and a.has("detail"), "action %s has label and detail" % a.get("id", "?"))
		_check([1, 2].has(int(a.get("phase", 0))), "action %s has a phase" % a.get("id", "?"))
		if a.get("kind", "") != "remittance":
			var probs: Array = []
			_collect_mutation_problems(str(a["id"]), a.get("mutations", {}), probs)
			_check(probs.is_empty(), "action %s mutations are scalar" % a["id"])


# --- Campaign (M1) ------------------------------------------------------------

func _shown_choices(nar) -> Array:
	var out: Array = []
	for c in nar._present_choices(nar.db[nar.current_node_id]):
		out.append(c)
	return out


func _test_campaign_rules() -> void:
	var s := _make_stack()
	var gs = s["gs"]
	var nar = s["nar"]
	var ids: Array = []
	for sc in nar.menu_scenarios():
		ids.append(sc["id"])
	_check(ids.has("funding_pool") and ids.has("embassy_interview") and ids.has("landing"), "Lagos menu lists the Phase 1 scenarios")
	_check(not ids.has("landlord_split") and not ids.has("year_one"), "Lagos menu hides Canada scenarios")
	_check(not ids.has("ev_fuel"), "events are hidden from the menu")
	_check(not nar.is_available(nar.get_scenario("landing")), "Touchdown locked until the visa is approved")
	_check(not nar.is_available(nar.get_scenario("embassy_interview")), "visa interview locked without funds and IELTS")
	gs.apply_mutations({"naira_wallet": 3000000})
	gs.set_route_stat_max("ielts_best_clb", 7)
	_check(nar.is_available(nar.get_scenario("embassy_interview")), "visa interview unlocks at N7M and CLB 7")
	gs.apply_mutations({"visa_approved": true})
	_check(nar.is_available(nar.get_scenario("landing")), "Touchdown unlocks with the visa")
	_check(not nar.is_available(nar.get_scenario("embassy_interview")), "an approved visa is not re-interviewed")
	gs.apply_mutations({"done_agent_scam": true})
	_check(not nar.is_available(nar.get_scenario("agent_scam")), "finished scenarios cannot be replayed for rewards")
	gs.apply_mutations({"car_sold": true, "took_loan": true, "asked_uncle": true})
	_check(nar.is_available(nar.get_scenario("funding_pool")), "replayable scenarios stay open")

	# Scenario counters reset without wiping the IELTS best score.
	gs.set_route_stat_max("ielts_prep", 3)
	nar.start_scenario("suv_pitch")
	_check(gs.route_stats.get("ielts_best_clb", 0.0) == 7.0, "startup pitch keeps the IELTS best score")
	_check(gs.route_stats.get("ielts_prep", 0.0) == 3.0, "startup pitch keeps IELTS prep")
	_check(gs.route_stats["investor_interest"] == 40.0, "startup pitch resets its own counters")
	nar.start_scenario("suv_pitch")
	_check(gs.route_stats["investor_interest"] == 40.0, "replaying the pitch does not stack counters")

	# Canada ending gate
	gs.apply_mutations({"set_phase": 2})
	ids.clear()
	for sc in nar.menu_scenarios():
		ids.append(sc["id"])
	_check(ids.has("year_one") and not ids.has("funding_pool"), "Canada menu swaps in the Phase 2 scenarios")
	_check(not nar.is_available(nar.get_scenario("year_one")), "ending locked at first")
	gs.apply_mutations({"done_landlord_split": true, "done_lmia_interview": true, "canada_days": 30})
	_check(nar.is_available(nar.get_scenario("year_one")), "ending unlocks with home, sponsor and 30 days")
	var r := _play(s, "year_one", ["quiet night"])
	_check(r["outcome"] == "win" and r["reason"] == "JAPA_COMPLETE", "the ending is a win")
	_free_stack(s)

	# Timers
	s = _make_stack()
	s["nar"].start_scenario("agent_scam")
	_check(s["nar"].time_limit() == 0.0, "ordinary nodes are untimed")
	_check(not s["nar"].time_out(), "time_out does nothing on an untimed node")
	_check(s["nar"].current_node_id == "encounter_agent_01", "untimed node unchanged by time_out")
	_free_stack(s)


func _embassy_stack(in_debt: bool) -> Dictionary:
	var s := _make_stack()
	s["gs"].apply_mutations({"naira_wallet": 2500000, "in_debt": in_debt})
	s["gs"].set_route_stat_max("ielts_best_clb", 8)
	return s


func _test_embassy_and_funding() -> void:
	var s := _embassy_stack(false)
	s["gs"].set_route_stat_max("ielts_prep", 3)
	var r := _play(s, "embassy_interview", ["job offer in logistics", "paper trail", "Answer fluently"])
	_check(r["outcome"] == "win" and r["reason"] == "VISA_APPROVED", "prepared, honest interview gets the visa")
	_check(s["gs"].flags.get("visa_approved") == true, "visa flag set")
	_check(s["gs"].metrics["naira_wallet"] == 7000000.0 - 250000.0, "interview fee charged")
	_free_stack(s)

	s = _embassy_stack(false)
	s["nar"].start_scenario("embassy_interview")
	var q3_fluent_locked := true
	s["nar"].select_choice(0)
	s["nar"].select_choice(0)
	for c in _shown_choices(s["nar"]):
		if str(c["text"]).find("Answer fluently") != -1:
			q3_fluent_locked = not c["enabled"]
	_check(q3_fluent_locked, "fluent answer locked without IELTS prep")
	_free_stack(s)

	s = _embassy_stack(false)
	r = _play(s, "embassy_interview", ["job offer in logistics", "all my own savings", "hard worker"])
	_check(r["outcome"] == "fail" and r["reason"] == "VISA_REFUSED", "a weak but honest interview is refused (35 < 60)")
	_check(s["nar"].is_available(s["nar"].get_scenario("embassy_interview")) == false, "retry needs the funds back above N7M")
	s["gs"].apply_mutations({"naira_wallet": 500000})
	_check(s["nar"].is_available(s["nar"].get_scenario("embassy_interview")), "refusal can be retried")
	s["gs"].set_route_stat_max("ielts_prep", 3)
	r = _play(s, "embassy_interview", ["job offer in logistics", "paper trail", "Answer fluently"])
	_check(r["outcome"] == "win", "second attempt starts from fresh confidence and can pass")
	_free_stack(s)

	s = _embassy_stack(true)
	r = _play(s, "embassy_interview", ["job offer in logistics", "all my own savings"])
	_check(r["outcome"] == "fail" and r["reason"] == "GAME_OVER_MISREPRESENTATION", "calling a loan savings is misrepresentation")
	_free_stack(s)

	s = _embassy_stack(true)
	r = _play(s, "embassy_interview", ["job offer in logistics", "show appreciation"])
	_check(r["reason"] == "GAME_OVER_BRIBERY", "offering a bribe ends the run")
	_free_stack(s)

	# Running out the clock on every question is a refusal, never a crash.
	s = _embassy_stack(false)
	var ended := {"reason": ""}
	s["nar"].scenario_ended.connect(func(_o: String, rr: String, _c: Dictionary) -> void: ended["reason"] = rr)
	s["nar"].start_scenario("embassy_interview")
	var outs := 0
	while s["nar"].active and outs < 10:
		_check(s["nar"].time_limit() > 0.0, "every interview question is timed")
		s["nar"].time_out()
		outs += 1
	_check(outs == 3 and ended["reason"] == "VISA_REFUSED", "three timeouts lead to a refusal")
	_free_stack(s)

	# Funding pool
	s = _make_stack()
	r = _play(s, "funding_pool", ["micro-loan", "Accept"])
	_check(s["gs"].metrics["naira_wallet"] == 6000000.0 and s["gs"].flags.get("in_debt") == true, "micro-loan adds N1.5M and debt")
	s["nar"].start_scenario("funding_pool")
	_check(not _shown_choices(s["nar"])[0]["enabled"], "only one loan at a time")
	s["nar"].select_choice(3)
	r = _play(s, "funding_pool", ["Sell the Corolla", "Sell it"])
	_check(s["gs"].flags.get("car_sold") == true and s["gs"].metrics["naira_wallet"] == 8200000.0, "selling the car adds N2.2M")
	s["nar"].start_scenario("funding_pool")
	s["nar"].select_choice(2)
	var plan_locked: bool = not _shown_choices(s["nar"])[0]["enabled"]
	_check(plan_locked, "written plan for Uncle needs Street Cred 30")
	s["nar"].select_choice(1)
	s["nar"].select_choice(0)
	_check(s["gs"].metrics["naira_wallet"] == 8800000.0, "emotional appeal with low strain gets N600k")
	s["nar"].start_scenario("funding_pool")
	_check(not _shown_choices(s["nar"])[2]["enabled"], "Uncle can only be asked once")
	_free_stack(s)

	s = _make_stack()
	s["gs"].apply_mutations({"family_strain_index": 30})
	r = _play(s, "funding_pool", ["Pitch Uncle", "you know how this country is", "Back to the dashboard"])
	_check(s["gs"].metrics["naira_wallet"] == 4500000.0, "emotional appeal with high strain gets nothing")
	_free_stack(s)


func _test_day_cycle() -> void:
	var events: Array = DayCycleScript.load_events()
	var gs := GameStateScript.new()
	gs.new_run(12345)
	_check(gs.run_seed == 12345, "new_run sets the seed")
	gs.apply_mutations({"village_people_multiplier": 0.0})
	var naira: float = gs.metrics["naira_wallet"]
	var fired := DayCycleScript.pass_days(gs, events, 0, 5)
	_check(fired == "", "no events with a zero multiplier")
	_check(gs.metrics["naira_wallet"] == naira - 50000.0, "Lagos living cost is N10,000 a day")
	_check(gs.metrics["canada_days"] == 0.0, "Lagos days do not count as Canada days")

	# Same seed, same day -> same outcome; across many days events do fire.
	gs.new_run(777)
	var a: Array = []
	for d in 200:
		a.append(DayCycleScript.roll_event(gs, events, d))
	gs.new_run(777)
	var b: Array = []
	for d in 200:
		b.append(DayCycleScript.roll_event(gs, events, d))
	_check(a == b, "event rolls are deterministic per seed")
	var count := 0
	for e in a:
		if e != "":
			count += 1
	_check(count >= 10 and count <= 60, "event rate is sensible (%d in 200 days)" % count)
	_check(a.count("ev_hospital") <= 1, "once-only events fire at most once")
	_check(not a.has("ev_loan_call"), "loan calls need a loan")
	_check(not a.has("ev_winter"), "Canada events never fire in Lagos")

	gs.new_run(777)
	gs.apply_mutations({"village_people_multiplier": 4.0})
	_check(is_equal_approx(DayCycleScript.event_chance(gs), 0.6), "event chance is capped")

	# Canada: CAD cost, family drift, day counter, broke stress
	gs.new_run(1)
	gs.apply_mutations({"set_phase": 2, "cad_wallet": 100, "village_people_multiplier": 0.0})
	var stress: float = gs.metrics["mental_stress"]
	var strain: float = gs.metrics["family_strain_index"]
	DayCycleScript.pass_days(gs, events, 0, 5)
	_check(gs.metrics["canada_days"] == 5.0, "Canada days counted")
	_check(gs.metrics["cad_wallet"] == 0.0, "CAD living cost drains the wallet")
	_check(gs.metrics["family_strain_index"] == strain + 5.0, "family strain drifts up while abroad")
	_check(gs.metrics["mental_stress"] == stress + 12.0, "being broke adds stress (2 short days)")

	# Seed survives a save round trip.
	gs.new_run(424242)
	var gs2 := GameStateScript.new()
	gs2.from_dict(gs.to_dict())
	_check(gs2.run_seed == 424242, "run seed survives save/load")
	gs2.from_dict({"run_seed": "x"})
	_check(gs2.run_seed == 0, "bad seed in a save is ignored")
	gs.free()
	gs2.free()


## A sensible scripted player: works, rests, studies, raises funds honestly,
## passes the interview, lands, settles and finishes. Proves the campaign is
## winnable with events on, across many seeds.
func _test_campaign_bot() -> void:
	var actions_data: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/actions.json"))
	var actions := {}
	for a in actions_data["actions"]:
		actions[a["id"]] = a
	var events: Array = DayCycleScript.load_events()
	var wins := 0
	var max_days := 0
	var runs := 40
	for seed_i in runs:
		var s := _make_stack()
		var gs = s["gs"]
		var nar = s["nar"]
		gs.new_run(1000 + seed_i)
		var steps := 0
		var won := false
		while gs.game_over_reason == "" and steps < 600 and not won:
			steps += 1
			var phase := int(gs.metrics["phase"])
			var plan := ""
			var scen := ""
			if phase == 1:
				if not gs.flags.get("car_sold", false):
					scen = "car"
				elif float(gs.route_stats.get("ielts_best_clb", 0)) < 7.0:
					gs.set_route_stat_max("ielts_best_clb", 8)  # stands in for the minigame
					continue
				elif float(gs.route_stats.get("ielts_prep", 0)) < 3.0:
					plan = "study_ielts"
				elif nar.is_available(nar.get_scenario("embassy_interview")):
					scen = "embassy_interview"
				elif nar.is_available(nar.get_scenario("landing")):
					scen = "landing"
				else:
					plan = "office_shift"
			else:
				if not gs.flags.get("done_landlord_split", false):
					scen = "landlord_split"
				elif not gs.flags.get("done_lmia_interview", false):
					scen = "lmia_interview"
				elif nar.is_available(nar.get_scenario("year_one")):
					scen = "year_one"
				elif float(gs.metrics["family_strain_index"]) > 60.0 and float(gs.metrics["cad_wallet"]) >= 400.0:
					plan = "remit"
				elif float(gs.metrics["family_strain_index"]) > 60.0:
					plan = "video_call"
				else:
					plan = "extra_delivery"
			# Rest when tired or stressed.
			if plan != "" and plan != "remit":
				var stamina_cost := -float(actions[plan]["mutations"].get("stamina", 0))
				if float(gs.metrics["stamina"]) < stamina_cost or float(gs.metrics["mental_stress"]) > 70.0:
					plan = "rest_lagos" if phase == 1 else "rest"
					if phase == 2 and float(gs.metrics["mental_stress"]) > 70.0 and float(gs.metrics["stamina"]) >= 10.0:
						plan = "video_call"
			if scen == "car":
				_play(s, "funding_pool", ["Sell the Corolla", "Sell it"])
			elif scen == "embassy_interview":
				_play(s, scen, ["job offer in logistics", "paper trail", "Answer fluently"])
			elif scen == "landing":
				_play(s, scen, ["approved permit"])
			elif scen == "landlord_split":
				_play(s, scen, ["My family joins me", "Move into"])
			elif scen == "lmia_interview":
				_play(s, scen, ["I understand the hesitation", "follow the advertising rules"])
			elif scen == "year_one":
				var r := _play(s, scen, ["quiet night"])
				won = r["outcome"] == "win"
			elif plan != "":
				var day_before := int(gs.metrics["day"])
				var act: Dictionary = actions[plan]
				if act.get("kind", "") == "remittance":
					gs.send_remittance(float(act["cad"]))
					gs.apply_mutations({"day": 1})
				else:
					gs.apply_mutations(act["mutations"])
				var ev := DayCycleScript.pass_days(gs, events, day_before, int(gs.metrics["day"]))
				if ev != "" and gs.game_over_reason == "":
					# Answer every event with its first affordable choice, then leave.
					nar.start_scenario(ev)
					var hops := 0
					while nar.active and hops < 10:
						var picked := false
						for c in _shown_choices(nar):
							if c["enabled"]:
								nar.select_choice(int(c["index"]))
								picked = true
								break
						if not picked:
							break
						hops += 1
		if won:
			wins += 1
			max_days = maxi(max_days, int(s["gs"].metrics["day"]))
		_free_stack(s)
	print("campaign bot: %d/%d runs won, longest %d in-game days" % [wins, runs, max_days])
	_check(wins >= int(runs * 0.8), "a sensible player wins most seeded runs (%d/%d)" % [wins, runs])


# --- Narrative paths ----------------------------------------------------------

## Plays a scenario by choosing, at each step, the first choice whose text contains
## the given fragment. Returns {outcome, reason}.
func _play(stack: Dictionary, scenario_id: String, picks: Array) -> Dictionary:
	var nar = stack["nar"]
	var result := {"outcome": "", "reason": ""}
	nar.scenario_ended.connect(func(o: String, r: String, _c: Dictionary) -> void:
		result["outcome"] = o
		result["reason"] = r)
	nar.start_scenario(scenario_id)
	for pick in picks:
		var node: Dictionary = nar.db[nar.current_node_id]
		var idx := -1
		for i in node["choices"].size():
			if str(node["choices"][i]["text"]).find(str(pick)) != -1:
				idx = i
				break
		_check(idx != -1, "%s: found choice containing '%s'" % [scenario_id, pick])
		if idx == -1:
			break
		nar.select_choice(idx)
	return result


## A node whose on_enter mutation burns the player out must end the scenario
## instead of showing a dialogue the player can no longer finish.
func _test_on_enter_game_over() -> void:
	var s := _make_stack()
	var nar = s["nar"]
	nar.db["test_burn"] = {
		"speaker": "Test", "text": "Too much.", "on_enter": {"mental_stress": 500},
		"choices": [{"text": "Continue", "next_node": "dashboard_home"}],
	}
	var ended := {"outcome": "", "reason": ""}
	nar.scenario_ended.connect(func(o: String, r: String, _c: Dictionary) -> void:
		ended["outcome"] = o
		ended["reason"] = r)
	nar.execute_node("test_burn")
	_check(ended["outcome"] == "fail" and ended["reason"] == "BURNOUT_FAILURE", "on_enter burnout ends the scenario")
	_check(not nar.active, "narrative inactive after on_enter burnout")
	_free_stack(s)


func _test_narrative_paths() -> void:
	# Invalid and locked choices change nothing
	var s := _make_stack()
	s["nar"].start_scenario("agent_scam")
	var before: Dictionary = s["gs"].to_dict()
	_check(not s["nar"].select_choice(99), "out-of-range choice rejected")
	_check(not s["nar"].select_choice(-1), "negative choice rejected")
	_check(s["nar"].current_node_id == "encounter_agent_01", "pointer unchanged after invalid choice")
	_check(s["gs"].to_dict() == before, "state unchanged after invalid choice")
	_free_stack(s)

	# Agent scam: paying ends in fraud, refusing escapes
	s = _make_stack()
	var r := _play(s, "agent_scam", ["deposit right now"])
	_check(r["outcome"] == "fail" and r["reason"] == "GAME_OVER_FRAUD", "paying the agent is a fraud ending")
	_check(s["gs"].metrics["naira_wallet"] == 3000000.0, "agent costs 1.5M")
	_check(s["gs"].metrics["village_people_multiplier"] == 2.5, "multiplier set to 2.5")
	_free_stack(s)

	s = _make_stack()
	r = _play(s, "agent_scam", ["official LMIA approval", "No verifiable job offer", "Return to Dashboard"])
	_check(s["gs"].flags.get("done_agent_scam") == true, "escaping marks the scenario done")
	_check(s["gs"].metrics["street_cred"] == 10.0 + 15.0 + 30.0 + 5.0, "street cred accumulates along the good path")
	_free_stack(s)

	# Startup pitch: only strong answers win (baseline 40/40)
	s = _make_stack()
	r = _play(s, "suv_pitch", ["interoperable bridge", "event-driven", "key-person clause"])
	_check(r["outcome"] == "win" and r["reason"] == "SUV_LOS_ISSUED", "best pitch earns the Letter of Support")
	_free_stack(s)

	s = _make_stack()
	r = _play(s, "suv_pitch", ["interoperable bridge", "event-driven", "best friends"])
	_check(r["outcome"] == "win", "good pitch survives one weak answer (70 interest)")
	_free_stack(s)

	s = _make_stack()
	r = _play(s, "suv_pitch", ["interoperable bridge", "advanced cloud", "key-person clause"])
	_check(r["outcome"] == "fail" and r["reason"] == "SUV_REJECTED", "vague technical answer sinks the pitch")
	_check(s["gs"].metrics["naira_wallet"] == 4000000.0, "rejection costs 500k")
	_free_stack(s)

	s = _make_stack()
	r = _play(s, "suv_pitch", ["simply superior", "event-driven", "key-person clause"])
	_check(r["outcome"] == "fail", "arrogance trap fails the pitch")
	_free_stack(s)

	# Kovacs
	s = _make_stack()
	r = _play(s, "lmia_interview", ["I understand the hesitation", "fake job listing"])
	_check(r["outcome"] == "fail" and r["reason"] == "BLATANT_MISREPRESENTATION", "suggesting a fake posting ends the interview")
	_free_stack(s)

	s = _make_stack()
	r = _play(s, "lmia_interview", ["I understand the hesitation", "follow the advertising rules"])
	_check(r["outcome"] == "win" and r["reason"] == "LMIA_SPONSORSHIP_STARTED", "compliant path wins sponsorship")
	_free_stack(s)

	s = _make_stack()
	r = _play(s, "lmia_interview", ["Please sir", "West African corridors"])
	_check(r["outcome"] == "fail" and r["reason"] == "NO_SPONSORSHIP", "desperation then a gamble is declined")
	_free_stack(s)

	# Landing: phase switches to Canada and money converts
	s = _make_stack()
	var phases: Array = []
	s["gs"].phase_changed.connect(func(p: int) -> void: phases.append(p))
	r = _play(s, "landing", ["approved permit"])
	_check(r["outcome"] == "win", "landing completes")
	_check(int(s["gs"].metrics["phase"]) == 2 and phases.has(2), "landing switches to the Canada phase")
	_check(s["gs"].metrics["cad_wallet"] == 1428.0 and s["gs"].metrics["naira_wallet"] == 2500000.0, "exchange shock converts 2M naira to CAD 1,428")
	_free_stack(s)

	# Landlord: locked choices
	s = _make_stack()
	s["nar"].start_scenario("landlord_split")
	s["gs"].apply_mutations({"cad_wallet": 5000})
	var shown: Array = []
	s["nar"].dialogue_loaded.connect(func(_sp: String, _t: String, ch: Array) -> void:
		shown.clear()
		shown.append_array(ch))
	s["nar"].resume("encounter_spousal_split_01")
	_check(shown.size() == 4, "landlord shows 4 choices")
	_check(shown[0]["enabled"] == true, "pay-up choice enabled with CAD 5,000")
	_check(shown[1]["enabled"] == false, "guarantor choice locked at street cred 10")
	_check(not s["nar"].select_choice(1), "locked choice cannot be selected")
	_check(s["nar"].select_choice(0), "affordable choice can be selected")
	_check(s["gs"].metrics["cad_wallet"] == 1400.0, "paying costs CAD 3,600")
	_free_stack(s)

	# Devaluation applies its loss on entry only once, even when re-rendered
	s = _make_stack()
	s["nar"].start_scenario("devaluation")
	_check(s["gs"].metrics["naira_wallet"] == 4500000.0 - 810000.0, "devaluation loss applied on entry")
	s["nar"].resume("village_people_devaluation")
	_check(s["gs"].metrics["naira_wallet"] == 4500000.0 - 810000.0, "resume does not re-apply on_enter")
	_free_stack(s)


func _test_localization() -> void:
	var s := _make_stack()
	var shown: Array = []
	s["nar"].dialogue_loaded.connect(func(_sp: String, t: String, _ch: Array) -> void: shown.append(t))
	s["nar"].start_scenario("agent_scam")
	_check(str(shown[0]).begins_with("Ah, my brother! You are in luck"), "English text by default")
	s["loc"].set_language("pidgin_NG")
	s["nar"].resume("encounter_agent_01")
	_check(str(shown[1]).find("village people don lose block") != -1, "Pidgin text when selected")
	s["nar"].resume("encounter_agent_escaped")
	_check(str(shown[2]).begins_with("SUCCESS"), "missing translation falls back to English")
	_check(not s["loc"].LANGUAGES.has("fr"), "unsupported language not offered")
	s["loc"].set_language("fr")
	_check(s["loc"].current_language == "pidgin_NG", "unsupported language ignored")
	s["loc"].cycle_language()
	_check(s["loc"].current_language == "en_NG", "language cycles back")
	_free_stack(s)


# --- Fuzzing ----------------------------------------------------------------

func _test_fuzz_playthroughs() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 20261009
	var s := _make_stack()
	var nar = s["nar"]
	var gs = s["gs"]
	var errors: Array = []
	nar.scenario_ended.connect(func(o: String, r: String, _c: Dictionary) -> void:
		if o == "error":
			errors.append(r))
	var finished_runs := 0
	for scenario in nar.scenarios:
		for run in 300:
			gs.reset()
			nar.start_scenario(scenario["id"])
			var steps := 0
			while nar.active and steps < 60:
				var count: int = nar.db[nar.current_node_id]["choices"].size()
				nar.select_choice(rng.randi_range(-1, count))  # includes invalid indexes
				steps += 1
			if not nar.active:
				finished_runs += 1
			_check(steps < 60, "scenario %s terminates (run %d)" % [scenario["id"], run])
			if steps >= 60:
				break
			for k in GameStateScript.CLAMPED_0_100:
				if gs.metrics[k] < 0.0 or gs.metrics[k] > 100.0:
					_check(false, "metric %s out of range after fuzz" % k)
	_check(errors.is_empty(), "fuzz playthroughs hit no content errors")
	_check(finished_runs == nar.scenarios.size() * 300, "every fuzzed run ended")
	_free_stack(s)


func _test_fuzz_mutations() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var gs := GameStateScript.new()
	var t0 := Time.get_ticks_msec()
	for i in 10000:
		gs.apply_mutations({
			"naira_wallet": rng.randf_range(-5000000.0, 5000000.0),
			"cad_wallet": rng.randf_range(-5000.0, 5000.0),
			"stamina": rng.randi_range(-120, 120),
			"mental_stress": rng.randi_range(-3, 3),
			"family_strain_index": rng.randi_range(-3, 3),
			"x_stat": rng.randf_range(-10.0, 10.0),
		})
	var ok := true
	for k in GameStateScript.CLAMPED_0_100:
		ok = ok and gs.metrics[k] >= 0.0 and gs.metrics[k] <= 100.0
	for k in GameStateScript.NON_NEGATIVE:
		ok = ok and gs.metrics[k] >= 0.0
	_check(ok, "10,000 random mutations keep every metric in bounds")
	_check(Time.get_ticks_msec() - t0 < 2000, "10,000 mutations run quickly")
	gs.free()


# --- Save store -------------------------------------------------------------

func _test_save_store() -> void:
	var s := _make_stack()
	var store := SaveStoreScript.new()
	store.save_path = TEST_SAVE
	store.state = s["gs"]
	store.narrative = s["nar"]
	store.loc = s["loc"]
	store.delete_save()
	_check(not store.has_save(), "no save to start")

	s["nar"].start_scenario("suv_pitch")
	s["nar"].select_choice(1)
	s["loc"].set_language("pidgin_NG")
	_check(store.save_now(), "save succeeds")
	_check(store.has_save(), "save file exists")

	var node_at_save: String = s["nar"].current_node_id
	var interest_at_save: float = s["gs"].route_stats["investor_interest"]
	s["gs"].reset()
	s["nar"].active = false
	s["loc"].set_language("en_NG")
	_check(store.load_game(), "load succeeds")
	_check(s["nar"].current_node_id == node_at_save and s["nar"].active, "dialogue position restored")
	_check(s["gs"].route_stats["investor_interest"] == interest_at_save, "route stats restored")
	_check(s["loc"].current_language == "pidgin_NG", "language restored")

	# Second save keeps a valid file (swap logic)
	_check(store.save_now(), "second save succeeds")
	_check(not FileAccess.file_exists(TEST_SAVE + ".tmp"), "no temp file left behind")
	_check(not FileAccess.file_exists(TEST_SAVE + ".bak"), "no backup left behind after clean swap")

	# Corruption is detected
	var f := FileAccess.open(TEST_SAVE, FileAccess.WRITE)
	f.store_string("{this is not json")
	f.close()
	_check(not store.load_game(), "garbage save rejected")

	# Tampering with the payload is detected
	store.save_now()
	var raw := FileAccess.get_file_as_string(TEST_SAVE)
	var env: Dictionary = JSON.parse_string(raw)
	env["payload"] = str(env["payload"]).replace("investor_interest", "investor_interesz")
	var f2 := FileAccess.open(TEST_SAVE, FileAccess.WRITE)
	f2.store_string(JSON.stringify(env))
	f2.close()
	_check(not store.load_game(), "edited payload fails its hash")

	# Backup recovery: valid .bak is used when the main file is damaged
	store.delete_save()
	store.save_now()
	DirAccess.copy_absolute(TEST_SAVE, TEST_SAVE + ".bak")
	var f3 := FileAccess.open(TEST_SAVE, FileAccess.WRITE)
	f3.store_string("corrupted")
	f3.close()
	_check(store.load_game(), "falls back to the backup when the main save is damaged")

	store.delete_save()
	store.free()
	_free_stack(s)
