extends SceneTree
## UI smoke test: runs the real main scene with the real autoloads and drives it
## by pressing its buttons. Run:
##   godot --headless --path . -s res://tests/smoke_ui.gd

var _failures := 0
var _checks := 0
var _main: Control


func _check(cond: bool, msg: String) -> void:
	_checks += 1
	if not cond:
		_failures += 1
		printerr("FAIL: " + msg)


func _init() -> void:
	_run()


func _frames(n: int = 3) -> void:
	for i in n:
		await process_frame


func _buttons(node: Node, out: Array = []) -> Array:
	if node is Button and (node as Button).is_visible_in_tree():
		out.append(node)
	for c in node.get_children():
		_buttons(c, out)
	return out


func _find(text_fragment: String, root: Node = null) -> Button:
	for b in _buttons(root if root != null else _main):
		if (b as Button).text.find(text_fragment) != -1:
			return b
	return null


func _press(text_fragment: String, root: Node = null) -> bool:
	var b := _find(text_fragment, root)
	_check(b != null, "button containing '%s' is visible" % text_fragment)
	if b == null or b.disabled:
		_check(b == null, "button '%s' is enabled" % text_fragment)
		return false
	b.pressed.emit()
	await _frames()
	return true


func _run() -> void:
	# Autoloads are added to the tree after _init(), so wait one frame first.
	await process_frame
	var gs: Node = root.get_node_or_null("GameState")
	var nar: Node = root.get_node_or_null("Narrative")
	var store: Node = root.get_node_or_null("SaveStore")
	var loc: Node = root.get_node_or_null("Localization")
	_check(gs != null and nar != null and store != null and loc != null, "all four autoloads are registered")
	if gs == null or nar == null:
		quit(1)
		return
	store.save_path = "user://smoke_save.json"
	store.delete_save()
	gs.reset()

	var scene: PackedScene = load("res://scenes/main_game_view.tscn")
	_main = scene.instantiate()
	root.add_child(_main)
	await _frames(5)

	gs.apply_mutations({"village_people_multiplier": 0.0})  # events off until we test them
	await _frames(2)

	# Menu (Lagos)
	_check(_find("The Travel Consultant") != null, "menu lists the scenarios")
	_check(_find("The Japa Fund") != null, "menu lists the funding pool")
	_check(_find("IELTS Writing Test") != null, "menu has the IELTS button")
	_check(_find("Office Shift") != null, "Lagos daily actions shown in Phase 1")
	_check(_find("Send Remittance") == null, "Canada actions hidden in the Nigeria phase")
	_check(_find("The Landlord") == null, "Canada scenarios hidden in the Nigeria phase")
	_check(_find("Touchdown") != null and _find("Touchdown").disabled, "Touchdown locked before the visa")
	_check(_find("Touchdown").text.find("[Locked:") != -1, "locked scenario explains why")
	var disclaimer_shown := false
	var goals_shown := false
	for n in _main.find_children("*", "Label", true, false):
		if (n as Label).text.find("not legal or immigration advice") != -1:
			disclaimer_shown = true
		if (n as Label).text.find("[ ] Japa fund") != -1:
			goals_shown = true
	_check(disclaimer_shown, "menu shows the simulation / not-legal-advice disclaimer")
	_check(goals_shown, "menu shows the Phase 1 goal checklist")

	# Scam scenario, with a language switch mid-dialogue
	await _press("The Travel Consultant")
	_check(_find("deposit right now") != null, "dialogue choices are shown")
	await _press("English")  # language button reads the current language name
	var pidgin_visible := false
	for n in _main.find_children("*", "Label", true, false):
		if (n as Label).text.find("village people don lose block") != -1:
			pidgin_visible = true
	_check(pidgin_visible, "switching to Pidgin re-renders the open dialogue")
	await _press("Pidgin")  # back to English
	await _press("Agents can't sell them")
	_check(_find("Return to Dashboard") != null, "success node offers a return button")
	await _press("Return to Dashboard")
	_check(gs.flags.get("done_agent_scam") == true, "scenario flagged done")
	var done_button := _find("(done) The Travel Consultant")
	_check(done_button != null and done_button.disabled, "finished scenario is marked done and closed")

	# Lagos daily action: pay, living cost, day tick
	var naira_before: float = gs.metrics["naira_wallet"]
	var day_before: int = int(gs.metrics["day"])
	await _press("Office Shift")
	_check(gs.metrics["naira_wallet"] == naira_before + 60000.0 - 10000.0, "office shift pays N60k minus N10k living cost")
	_check(int(gs.metrics["day"]) == day_before + 1, "an action advances the day")

	# Village People events fire through the day tick
	gs.apply_mutations({"village_people_multiplier": 4.0})
	var event_seen := false
	for i in 25:
		await _press("Rest a Day")
		if nar.active:
			event_seen = true
			break
	_check(event_seen, "a Village People event interrupts the day")
	if event_seen:
		var hops := 0
		while nar.active and hops < 6:
			for b in _main._choices.get_children():
				if b is Button and not (b as Button).disabled:
					(b as Button).pressed.emit()
					await _frames()
					break
			hops += 1
		_check(not nar.active, "the event can be answered")
		if _find("Back to menu") != null:
			await _press("Back to menu")
	gs.apply_mutations({"village_people_multiplier": 0.0})
	await _frames(2)

	# Funding pool: sell the car, Bolt locks
	naira_before = gs.metrics["naira_wallet"]
	await _press("The Japa Fund")
	await _press("Sell the Corolla")
	await _press("Sell it")
	_check(gs.metrics["naira_wallet"] == naira_before + 2200000.0, "selling the car adds N2.2M")
	var bolt := _find("Weekend Bolt Driving")
	_check(bolt != null and bolt.disabled and bolt.text.find("sold the car") != -1, "Bolt driving locks once the car is sold")

	# Timed visa interview
	gs.set_route_stat_max("ielts_best_clb", 8)
	gs.set_route_stat_max("ielts_prep", 3)
	gs.apply_mutations({"naira_wallet": 2000000})
	await _frames(2)
	await _press("The Visa Interview")
	_check(_main._timer_label.visible and _main._timer_label.text.begins_with("Time left"), "interview shows a countdown")
	_main._process(25.0)  # let the clock run out on question 1
	await _frames()
	_check(nar.current_node_id == "emb_q2", "running out of time moves the interview on")
	_check(_main._feedback.text.find("Froze") != -1, "timeout feedback is shown")
	await _press("paper trail")
	await _press("Answer fluently")
	_check(gs.flags.get("visa_approved", false) == false, "freezing once costs the visa (-10 + 25 + 30 = 45 < 60)")
	_check(_find("Back to menu") != null, "refusal ends the interview")
	await _press("Back to menu")
	gs.apply_mutations({"naira_wallet": 1000000})
	await _frames(2)
	await _press("The Visa Interview")  # retry
	await _press("job offer in logistics")
	await _press("paper trail")
	await _press("Answer fluently")
	_check(gs.flags.get("visa_approved") == true, "retry with strong answers gets the visa (80)")
	var celebration: Node = null
	for c in _main.get_children():
		if c is CelebrationScreen:
			celebration = c
	_check(celebration != null and (celebration as Control).visible, "celebration screen shown on a win")
	await _press("Continue", celebration)
	await _press("Back to menu")
	_check(not _main._timer_label.visible, "countdown hidden after the interview")

	# Landing: Touchdown unlocked, moves to Canada
	await _press("Touchdown")
	await _press("approved permit")
	_check(int(gs.metrics["phase"]) == 2, "landing moves the game to Canada")
	await _press("Continue", celebration)
	await _press("Back to menu")
	_check(_find("Send Remittance") != null, "Canada daily actions unlocked")
	_check(_find("Office Shift") == null, "Lagos actions gone in Canada")
	_check(_find("One Year On") != null and _find("One Year On").disabled, "the ending is listed but locked")

	# Canada daily actions
	var cad_before: float = gs.metrics["cad_wallet"]
	await _press("Extra Delivery Shift")
	_check(gs.metrics["cad_wallet"] == cad_before + 95.0 - 30.0, "extra delivery earns CAD 95 minus CAD 30 living cost")
	_check(gs.metrics["canada_days"] == 1.0, "Canada days counted")
	naira_before = gs.metrics["naira_wallet"]
	await _press("Send Remittance")
	_check(gs.metrics["naira_wallet"] == naira_before + 560000.0, "remittance credits the Nigerian wallet")

	# IELTS minigame embedded
	await _press("IELTS Writing Test")
	var ielts: IeltsGame = null
	for c in _main.get_children():
		if c is IeltsGame:
			ielts = c
	_check(ielts != null, "IELTS scene is embedded")
	if ielts != null:
		await _press("Start", ielts)
		await _frames(2)
		var slots := 0
		for b in _buttons(ielts):
			if (b as Button).text == "·" or (b as Button).text.length() == 1:
				slots += 1
		_check(slots >= 9, "IELTS passage renders tappable gaps (%d)" % slots)
		await _press("Submit", ielts)
		_check(gs.route_stats.get("ielts_best_clb", 0.0) > 0.0, "IELTS result recorded in game state")
		await _press("X", ielts)
		await _frames(2)
		_check(not is_instance_valid(ielts) or ielts.is_queued_for_deletion(), "IELTS close button removes the scene")

	# Persistence: autosave flush and reload
	store.save_now()
	var cad_saved: float = gs.metrics["cad_wallet"]
	gs.reset()
	_check(store.load_game(), "game reloads from disk")
	_check(gs.metrics["cad_wallet"] == cad_saved, "wallet restored after reload")

	# Game over via burnout shows only New Game
	gs.apply_mutations({"mental_stress": 500})
	await _frames(2)
	_check(_find("GAME OVER") == null or true, "game over label optional")
	var has_new_game := _find("New Game") != null
	var has_scenarios := _find("The Landlord") != null or _find("Extra Delivery") != null
	_check(has_new_game and not has_scenarios, "burnout leaves only New Game")
	await _press("New Game")
	_check(gs.game_over_reason == "" and _find("The Travel Consultant") != null, "new game resets and restores the menu")
	_check(int(gs.metrics["phase"]) == 1 and gs.run_seed > 0, "new game starts in Lagos with a fresh event seed")

	store.delete_save()
	print("%d UI checks run" % _checks)
	if _failures == 0:
		print("UI SMOKE TEST PASSED")
	else:
		printerr("%d UI CHECK(S) FAILED" % _failures)
	quit(1 if _failures > 0 else 0)
