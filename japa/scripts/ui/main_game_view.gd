extends Control
## Main screen: dual-budget dashboard + scenario menu + dialogue window.
## Everything is built in code, so the scene file is a single root node.
## Layout is portrait (720x1280 base) with the Canada panel left, Nigeria right.

const IELTS_SCENE: PackedScene = preload("res://scenes/minigames/ielts_game.tscn")
const ACTIONS_PATH := "res://data/actions.json"

var _bg: ColorRect
var _day_label: Label
var _lang_button: Button
var _stress_label: Label
var _stress_bar: ProgressBar
var _canada_panel: PanelContainer
var _canada_title: Label
var _canada_wallet: Label
var _stamina_label: Label
var _stamina_bar: ProgressBar
var _nigeria_panel: PanelContainer
var _nigeria_title: Label
var _nigeria_wallet: Label
var _strain_label: Label
var _strain_bar: ProgressBar
var _message: Label
var _menu_scroll: ScrollContainer
var _menu_box: VBoxContainer
var _dialogue_scroll: ScrollContainer
var _speaker: Label
var _text: Label
var _feedback: Label
var _timer_label: Label
var _time_left: float = 0.0
var _choices: VBoxContainer
var _mixer: AudioCrossfadeMixer
var _celebration: CelebrationScreen

var _actions: Array = []
var _events: Array = []
var _last_feedback: String = ""
var _show_continue: bool = false


func _ready() -> void:
	_load_actions()
	_events = DayCycle.load_events()
	_build_ui()

	GameState.metrics_updated.connect(_on_metrics_updated)
	GameState.phase_changed.connect(_on_phase_changed)
	GameState.game_over_triggered.connect(_on_game_over)
	Narrative.dialogue_loaded.connect(_on_dialogue_loaded)
	Narrative.choice_feedback.connect(_on_choice_feedback)
	Narrative.scenario_ended.connect(_on_scenario_ended)
	Narrative.returned_to_dashboard.connect(_on_returned_to_dashboard)
	Localization.language_changed.connect(_on_language_changed)
	GameState.phase_changed.connect(_mixer.transition_environment_audio)

	_show_continue = SaveStore.has_save()
	if GameState.run_seed == 0:
		GameState.run_seed = randi_range(1, 2147483646)
	_on_phase_changed(int(GameState.metrics["phase"]))
	_on_metrics_updated(GameState.metrics)
	_show_menu()


func _load_actions() -> void:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(ACTIONS_PATH))
	if parsed is Dictionary:
		_actions = parsed.get("actions", [])


# --- UI construction -------------------------------------------------------

func _build_ui() -> void:
	_bg = ColorRect.new()
	_bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_bg)

	_mixer = AudioCrossfadeMixer.new()
	add_child(_mixer)

	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 16)
	add_child(margin)

	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 12)
	margin.add_child(column)

	# Header: day, language switch, global stress
	var header := PanelContainer.new()
	column.add_child(header)
	var header_box := VBoxContainer.new()
	header.add_child(header_box)
	var header_row := HBoxContainer.new()
	header_box.add_child(header_row)
	_day_label = Label.new()
	_day_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header_row.add_child(_day_label)
	_lang_button = Button.new()
	_lang_button.custom_minimum_size = Vector2(150, 48)
	_lang_button.pressed.connect(func() -> void: Localization.cycle_language())
	header_row.add_child(_lang_button)
	_stress_label = Label.new()
	header_box.add_child(_stress_label)
	_stress_bar = _make_bar()
	header_box.add_child(_stress_bar)
	# Stamina matters in both phases, so it lives in the header, not a country panel.
	_stamina_label = Label.new()
	header_box.add_child(_stamina_label)
	_stamina_bar = _make_bar()
	header_box.add_child(_stamina_bar)

	# Split dual-budget row
	var split := HBoxContainer.new()
	split.add_theme_constant_override("separation", 12)
	column.add_child(split)

	_canada_panel = PanelContainer.new()
	_canada_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	split.add_child(_canada_panel)
	var canada_box := VBoxContainer.new()
	_canada_panel.add_child(canada_box)
	_canada_title = _small_label("CANADA")
	canada_box.add_child(_canada_title)
	_canada_wallet = Label.new()
	_canada_wallet.add_theme_font_size_override("font_size", 30)
	canada_box.add_child(_canada_wallet)

	_nigeria_panel = PanelContainer.new()
	_nigeria_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	split.add_child(_nigeria_panel)
	var nigeria_box := VBoxContainer.new()
	_nigeria_panel.add_child(nigeria_box)
	_nigeria_title = _small_label("NIGERIA")
	nigeria_box.add_child(_nigeria_title)
	_nigeria_wallet = Label.new()
	_nigeria_wallet.add_theme_font_size_override("font_size", 30)
	nigeria_box.add_child(_nigeria_wallet)
	_strain_label = _small_label("")
	nigeria_box.add_child(_strain_label)
	_strain_bar = _make_bar()
	nigeria_box.add_child(_strain_bar)

	_message = Label.new()
	_message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_message.add_theme_color_override("font_color", Color("#d9a441"))
	_message.add_theme_font_size_override("font_size", 22)
	column.add_child(_message)

	# Lower area: menu OR dialogue
	var lower := Control.new()
	lower.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(lower)

	_menu_scroll = ScrollContainer.new()
	_menu_scroll.set_anchors_preset(Control.PRESET_FULL_RECT)
	_menu_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	lower.add_child(_menu_scroll)
	_menu_box = VBoxContainer.new()
	_menu_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_menu_box.add_theme_constant_override("separation", 10)
	_menu_scroll.add_child(_menu_box)

	_dialogue_scroll = ScrollContainer.new()
	_dialogue_scroll.set_anchors_preset(Control.PRESET_FULL_RECT)
	_dialogue_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_dialogue_scroll.visible = false
	lower.add_child(_dialogue_scroll)
	var dialogue_box := VBoxContainer.new()
	dialogue_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dialogue_box.add_theme_constant_override("separation", 14)
	_dialogue_scroll.add_child(dialogue_box)
	_speaker = Label.new()
	_speaker.add_theme_font_size_override("font_size", 30)
	_speaker.add_theme_color_override("font_color", Color("#d9a441"))
	_speaker.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	dialogue_box.add_child(_speaker)
	_text = Label.new()
	_text.add_theme_font_size_override("font_size", 26)
	_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	dialogue_box.add_child(_text)
	_timer_label = Label.new()
	_timer_label.add_theme_font_size_override("font_size", 26)
	_timer_label.add_theme_color_override("font_color", Color("#e07a5f"))
	_timer_label.visible = false
	dialogue_box.add_child(_timer_label)
	_feedback = Label.new()
	_feedback.add_theme_font_size_override("font_size", 22)
	_feedback.add_theme_color_override("font_color", Color("#8fc9a3"))
	_feedback.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	dialogue_box.add_child(_feedback)
	_choices = VBoxContainer.new()
	_choices.add_theme_constant_override("separation", 10)
	dialogue_box.add_child(_choices)

	_celebration = CelebrationScreen.new()
	add_child(_celebration)


func _make_bar() -> ProgressBar:
	var bar := ProgressBar.new()
	bar.min_value = 0
	bar.max_value = 100
	bar.show_percentage = false
	bar.custom_minimum_size = Vector2(0, 18)
	return bar


func _small_label(text: String) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", 20)
	label.add_theme_color_override("font_color", JapaTheme.MUTED)
	return label


func _make_button(text: String, callback: Callable, min_height: float = 72.0) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(0, min_height)
	button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	button.pressed.connect(callback)
	return button


# --- Reactive updates ------------------------------------------------------

func _on_metrics_updated(metrics: Dictionary) -> void:
	_day_label.text = "Day %d" % int(metrics["day"])
	_stress_bar.value = float(metrics["mental_stress"])
	_stamina_bar.value = float(metrics["stamina"])
	_strain_bar.value = float(metrics["family_strain_index"])
	_canada_wallet.text = "CAD $" + Fmt.money(float(metrics["cad_wallet"]))
	_nigeria_wallet.text = "N" + Fmt.money(float(metrics["naira_wallet"]))
	_stress_label.text = "%s: %d%%" % [_phase_text("stress_label", "Village People Tracker"), int(metrics["mental_stress"])]
	_stamina_label.text = "%s: %d" % [_phase_text("energy_label", "Stamina"), int(metrics["stamina"])]
	_strain_label.text = "Family Strain: %d%%" % int(metrics["family_strain_index"])
	if _menu_scroll.visible:
		_rebuild_menu()


func _phase_text(key: String, default_text: String) -> String:
	var section := "phase_2_canada" if int(GameState.metrics["phase"]) == 2 else "phase_1_lagos"
	return Localization.ui_text(section, key, default_text)


func _on_phase_changed(phase: int) -> void:
	var p := JapaTheme.palette(phase)
	theme = JapaTheme.make(phase)
	_bg.color = p["bg"]
	var canada_active := phase == 2
	_canada_panel.modulate = Color(1, 1, 1, 1) if canada_active else Color(0.6, 0.6, 0.6, 0.8)
	_nigeria_panel.modulate = Color(0.6, 0.6, 0.6, 0.8) if canada_active else Color(1, 1, 1, 1)
	_lang_button.text = Localization.language_name()
	if is_node_ready():
		_on_metrics_updated(GameState.metrics)


## GameState raises this after metrics_updated, so a menu action that tips the
## player into burnout would otherwise leave the old menu on screen. During a
## scenario, Narrative reports the failure itself.
func _on_game_over(_reason: String) -> void:
	if not Narrative.active:
		_show_menu()


func _on_language_changed(_language: String) -> void:
	_lang_button.text = Localization.language_name()
	_on_metrics_updated(GameState.metrics)
	if Narrative.active:
		Narrative.resume(Narrative.current_node_id)


# --- Menu ------------------------------------------------------------------

func _show_menu() -> void:
	_dialogue_scroll.visible = false
	_menu_scroll.visible = true
	_message.text = _last_feedback
	_rebuild_menu()


func _clear(box: Container) -> void:
	for child in box.get_children():
		box.remove_child(child)
		child.queue_free()


func _rebuild_menu() -> void:
	_clear(_menu_box)
	var title := Label.new()
	title.text = "THE GREAT JAPA ESCAPE"
	title.add_theme_font_size_override("font_size", 32)
	_menu_box.add_child(title)

	if GameState.game_over_reason != "":
		var over := Label.new()
		over.text = "GAME OVER: %s" % Fmt.tag(GameState.game_over_reason)
		over.add_theme_font_size_override("font_size", 30)
		over.add_theme_color_override("font_color", Color("#b5483c"))
		_menu_box.add_child(over)
		_menu_box.add_child(_make_button("New Game", _new_game))
		return

	if _show_continue:
		_menu_box.add_child(_make_button("Continue saved game", _continue_game))

	if bool(GameState.flags.get("done_year_one", false)):
		var won := Label.new()
		won.text = "CAMPAIGN COMPLETE. You made it. Keep playing, or start a New Game."
		won.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		won.add_theme_font_size_override("font_size", 24)
		won.add_theme_color_override("font_color", Color("#2e8b57"))
		_menu_box.add_child(won)

	_menu_box.add_child(_section_label(_phase_text("title", "Goals")))
	for goal in _goals():
		var g := Label.new()
		g.text = ("[x] " if goal[1] else "[ ] ") + str(goal[0])
		g.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		g.add_theme_font_size_override("font_size", 20)
		g.add_theme_color_override("font_color", Color("#8fc9a3") if goal[1] else JapaTheme.TEXT)
		_menu_box.add_child(g)

	_menu_box.add_child(_section_label("Daily actions"))
	var phase := int(GameState.metrics["phase"])
	for a in _actions:
		if int(a.get("phase", 2)) != phase:
			continue
		var text := "%s\n%s" % [a["label"], a["detail"]]
		var locked: bool = a.has("requires") and not GameState.evaluate(a["requires"])
		if locked and str(a.get("locked_hint", "")) != "":
			text += "\n[Locked: %s]" % a["locked_hint"]
		var button := _make_button(text, _do_action.bind(a), 84)
		button.disabled = locked or not _action_affordable(a)
		_menu_box.add_child(button)

	_menu_box.add_child(_section_label("Scenarios"))
	for sc in Narrative.menu_scenarios():
		var done: bool = Narrative.is_done(sc)
		var label := "%s%s\n%s" % ["(done) " if done else "", sc["title"], sc["subtitle"]]
		var available: bool = Narrative.is_available(sc)
		if not available and not done and str(sc.get("locked_hint", "")) != "":
			label += "\n[Locked: %s]" % sc["locked_hint"]
		var sbutton := _make_button(label, _start_scenario.bind(str(sc["id"])), 84)
		sbutton.disabled = not available
		_menu_box.add_child(sbutton)

	var best := int(GameState.route_stats.get("ielts_best_clb", 0))
	var ielts_text := "IELTS Writing Test\nPunctuation challenge" + ("  (best: CLB %d)" % best if best > 0 else "")
	_menu_box.add_child(_make_button(ielts_text, _launch_ielts, 84))

	_menu_box.add_child(_section_label("Game"))
	_menu_box.add_child(_make_button("New Game", _new_game, 60))

	var disclaimer := Label.new()
	disclaimer.text = "This is a simulation for entertainment. It is not legal or immigration advice. Rules, fees and cutoffs in real life change often, so check IRCC (canada.ca) before you act."
	disclaimer.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	disclaimer.add_theme_font_size_override("font_size", 18)
	disclaimer.add_theme_color_override("font_color", JapaTheme.MUTED)
	_menu_box.add_child(disclaimer)


## [text, done] pairs for the current phase's checklist.
func _goals() -> Array:
	var m := GameState.metrics
	if int(m["phase"]) != 2:
		return [
			["Japa fund: N7,000,000 in the bank (now N%s)" % Fmt.money(float(m["naira_wallet"])),
				float(m["naira_wallet"]) >= 7000000.0],
			["IELTS Writing CLB 7 or better", float(GameState.route_stats.get("ielts_best_clb", 0)) >= 7.0],
			["Study IELTS 3 times (%d/3)" % int(GameState.route_stats.get("ielts_prep", 0)),
				float(GameState.route_stats.get("ielts_prep", 0)) >= 3.0],
			["Pass the visa interview", bool(GameState.flags.get("visa_approved", false))],
			["Touchdown in Canada", bool(GameState.flags.get("done_landing", false))],
		]
	return [
		["Find a place to live (The Landlord)", bool(GameState.flags.get("done_landlord_split", false))],
		["Win an employer's sponsorship (The LMIA Interview)", bool(GameState.flags.get("done_lmia_interview", false))],
		["Survive 30 days in Canada (%d/30)" % int(m["canada_days"]), float(m["canada_days"]) >= 30.0],
		["Play 'One Year On'", bool(GameState.flags.get("done_year_one", false))],
	]


func _section_label(text: String) -> Label:
	var label := Label.new()
	label.text = text.to_upper()
	label.add_theme_font_size_override("font_size", 20)
	label.add_theme_color_override("font_color", JapaTheme.MUTED)
	return label


func _action_affordable(a: Dictionary) -> bool:
	if a.has("requires") and not GameState.evaluate(a["requires"]):
		return false
	if a.get("kind", "") == "remittance":
		return float(GameState.metrics["cad_wallet"]) >= float(a["cad"])
	return GameState.can_apply(a.get("mutations", {}))


func _do_action(a: Dictionary) -> void:
	if not _action_affordable(a):
		return
	var day_before := int(GameState.metrics["day"])
	if a.get("kind", "") == "remittance":
		GameState.send_remittance(float(a["cad"]))
		GameState.apply_mutations({"day": int(a.get("advance_day", 0))})
		_last_feedback = "Remittance sent at the current parallel-market rate."
	else:
		GameState.apply_mutations(a["mutations"])
		_last_feedback = str(a["label"]) + " done."
	_message.text = _last_feedback
	if GameState.game_over_reason != "":
		return
	var event_id := DayCycle.pass_days(GameState, _events, day_before, int(GameState.metrics["day"]))
	if event_id != "" and GameState.game_over_reason == "":
		_last_feedback = "Village People strike!"
		_feedback.text = ""
		_mixer.play_stinger()
		Narrative.start_scenario(event_id)
	elif GameState.game_over_reason == "":
		_message.text = _last_feedback


func _new_game() -> void:
	GameState.new_run()
	SaveStore.delete_save()
	Narrative.active = false
	_show_continue = false
	_last_feedback = ""
	_show_menu()


func _continue_game() -> void:
	_show_continue = false
	if not SaveStore.load_game():
		_last_feedback = "No valid save found."
	_show_menu_unless_dialogue()


func _show_menu_unless_dialogue() -> void:
	if not Narrative.active:
		_show_menu()


# --- Scenarios and dialogue -------------------------------------------------

func _start_scenario(scenario_id: String) -> void:
	if not Narrative.is_available(Narrative.get_scenario(scenario_id)):
		return
	_show_continue = false
	_last_feedback = ""
	_feedback.text = ""
	if scenario_id == "devaluation":
		_mixer.play_stinger()
	Narrative.start_scenario(scenario_id)


func _on_dialogue_loaded(speaker: String, text: String, choices: Array) -> void:
	_menu_scroll.visible = false
	_dialogue_scroll.visible = true
	_dialogue_scroll.scroll_vertical = 0
	_speaker.text = speaker
	_text.text = text
	_time_left = Narrative.time_limit()
	_update_timer_label()
	_clear(_choices)
	for c in choices:
		var label := str(c["text"])
		if not c["enabled"] and str(c["locked_hint"]) != "":
			label += "\n[Locked: %s]" % c["locked_hint"]
		var button := _make_button(label, _on_choice_pressed.bind(int(c["index"])), 72)
		button.disabled = not c["enabled"]
		_choices.add_child(button)


func _process(delta: float) -> void:
	if _time_left <= 0.0 or not Narrative.active or _celebration.visible:
		return
	_time_left -= delta
	if _time_left <= 0.0:
		_time_left = 0.0
		_update_timer_label()
		Narrative.time_out()
	else:
		_update_timer_label()


func _update_timer_label() -> void:
	_timer_label.visible = _time_left > 0.0 and Narrative.active
	_timer_label.text = "Time left: %d s" % ceili(_time_left)


func _on_choice_pressed(index: int) -> void:
	_time_left = 0.0
	for b in _choices.get_children():
		if b is Button:
			(b as Button).disabled = true
	Narrative.select_choice(index)


func _on_choice_feedback(tag: String, text: String) -> void:
	var line := text
	if tag != "":
		line = "%s: %s" % [Fmt.tag(tag), text]
	_feedback.text = line
	_last_feedback = line


func _on_scenario_ended(outcome: String, reason: String, celebration: Dictionary) -> void:
	_time_left = 0.0
	_timer_label.visible = false
	_menu_scroll.visible = false
	_dialogue_scroll.visible = true
	var result := Label.new()
	result.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	result.add_theme_font_size_override("font_size", 28)
	match outcome:
		"win":
			result.text = "SCENARIO COMPLETE"
			result.add_theme_color_override("font_color", Color("#2e8b57"))
		"error":
			result.text = "Content error: %s" % reason
			result.add_theme_color_override("font_color", Color("#b5483c"))
		_:
			result.text = "FAILED: %s" % Fmt.tag(reason)
			result.add_theme_color_override("font_color", Color("#b5483c"))
	_choices.add_child(result)
	_choices.add_child(_make_button("Back to menu", _show_menu, 72))
	if outcome == "win" and not celebration.is_empty():
		_celebration.play(str(celebration.get("title", "")), str(celebration.get("subtitle", "")), str(celebration.get("style", "visa")))


func _on_returned_to_dashboard() -> void:
	_show_menu()


# --- IELTS minigame ---------------------------------------------------------

func _launch_ielts() -> void:
	var game := IELTS_SCENE.instantiate() as IeltsGame
	game.show_exit_button = true
	game.finished.connect(_on_ielts_finished)
	game.exit_requested.connect(func() -> void:
		game.queue_free()
		_show_menu())
	add_child(game)


func _on_ielts_finished(result: Dictionary) -> void:
	var clb := int(result["clb"])
	GameState.set_route_stat_max("ielts_best_clb", float(clb))
	if bool(result["meets_clb9"]):
		if not bool(GameState.flags.get("clb9_writing", false)):
			GameState.apply_mutations({"street_cred": 10, "mental_stress": -5, "clb9_writing": true})
			_last_feedback = "CLB 9 reached in Writing. Street Cred up, stress down."
		else:
			_last_feedback = "CLB 9 again. Nice and steady."
	else:
		GameState.apply_mutations({"mental_stress": 4})
		_last_feedback = "Writing CLB %d. Below the CLB 9 target." % clb
