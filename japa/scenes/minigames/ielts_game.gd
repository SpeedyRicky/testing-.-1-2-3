class_name IeltsGame
extends Control
## M0 prototype: IELTS Writing punctuation minigame.
## Tap a gap to cycle its punctuation mark. Fix every error before time runs out.
## All UI is built in code so the scene file stays a single root node.

signal finished(result: Dictionary)
## Emitted when the player taps the close button (only shown when embedded).
signal exit_requested

const PASSAGES_PATH := "res://data/ielts_passages.json"

const COLOR_BG := Color("#14202b")
const COLOR_TEXT := Color("#e8eef2")
const COLOR_MUTED := Color("#8fa3b0")
const COLOR_GAP := Color("#2d4457")
const COLOR_GAP_TOUCHED := Color("#2f6f8f")
const COLOR_OK := Color("#2e8b57")
const COLOR_BAD := Color("#b5483c")
const COLOR_WARN := Color("#d9a441")

## Set a non-zero seed for reproducible passage order (used for balancing runs).
@export var rng_seed: int = 0
## Set to true before add_child() when hosting this scene inside the main game.
@export var show_exit_button: bool = false

var _passages: Array = []
var _rng := RandomNumberGenerator.new()
var _passage_index: int = -1
var _slots: Array[Dictionary] = []
var _time_limit: float = 60.0
var _time_left: float = 0.0
var _running: bool = false

var _timer_label: Label
var _info_label: Label
var _title_label: Label
var _passage_box: VBoxContainer
var _scroll: ScrollContainer
var _submit_button: Button
var _overlay: PanelContainer
var _overlay_title: Label
var _overlay_body: Label
var _overlay_primary: Button
var _overlay_secondary: Button


func _ready() -> void:
	if rng_seed != 0:
		_rng.seed = rng_seed
	else:
		_rng.randomize()
	_load_passages()
	_build_ui()
	_show_intro()


func _process(delta: float) -> void:
	if not _running:
		return
	_time_left -= delta
	if _time_left <= 0.0:
		_time_left = 0.0
		_finish(true)
	_update_hud()


# --- Data ------------------------------------------------------------------

func _load_passages() -> void:
	var raw := FileAccess.get_file_as_string(PASSAGES_PATH)
	var parsed: Variant = JSON.parse_string(raw)
	if parsed is Dictionary and parsed.has("passages"):
		_passages = parsed["passages"]
	if _passages.is_empty():
		push_error("No passages loaded from %s" % PASSAGES_PATH)


func _pick_passage() -> Dictionary:
	var next := _rng.randi_range(0, _passages.size() - 1)
	if _passages.size() > 1 and next == _passage_index:
		next = (next + 1) % _passages.size()
	_passage_index = next
	return _passages[next]


# --- UI construction -------------------------------------------------------

func _build_ui() -> void:
	var bg := ColorRect.new()
	bg.color = COLOR_BG
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)

	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 24)
	add_child(margin)

	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 14)
	margin.add_child(column)

	var hud := HBoxContainer.new()
	column.add_child(hud)
	if show_exit_button:
		var close := Button.new()
		close.text = "X"
		close.custom_minimum_size = Vector2(64, 56)
		close.pressed.connect(func() -> void: exit_requested.emit())
		hud.add_child(close)
	_timer_label = _make_label("0:00", 40, COLOR_WARN)
	hud.add_child(_timer_label)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hud.add_child(spacer)
	_info_label = _make_label("", 24, COLOR_MUTED)
	_info_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	hud.add_child(_info_label)

	_title_label = _make_label("", 28, COLOR_TEXT)
	column.add_child(_title_label)

	var hint := _make_label("Tap a gap to change its mark. A dot (·) means no punctuation.", 20, COLOR_MUTED)
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(hint)

	_scroll = ScrollContainer.new()
	_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	column.add_child(_scroll)

	_passage_box = VBoxContainer.new()
	_passage_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_passage_box.add_theme_constant_override("separation", 10)
	_scroll.add_child(_passage_box)

	_submit_button = Button.new()
	_submit_button.text = "Submit"
	_submit_button.custom_minimum_size = Vector2(0, 72)
	_submit_button.add_theme_font_size_override("font_size", 30)
	_submit_button.pressed.connect(func() -> void: _finish(false))
	column.add_child(_submit_button)

	_build_overlay()


func _build_overlay() -> void:
	_overlay = PanelContainer.new()
	_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.05, 0.09, 0.12, 0.96)
	_overlay.add_theme_stylebox_override("panel", style)
	add_child(_overlay)

	var center := CenterContainer.new()
	_overlay.add_child(center)

	var box := VBoxContainer.new()
	box.custom_minimum_size = Vector2(560, 0)
	box.add_theme_constant_override("separation", 20)
	center.add_child(box)

	_overlay_title = _make_label("", 44, COLOR_TEXT)
	_overlay_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_overlay_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(_overlay_title)

	_overlay_body = _make_label("", 26, COLOR_MUTED)
	_overlay_body.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_overlay_body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(_overlay_body)

	_overlay_primary = Button.new()
	_overlay_primary.custom_minimum_size = Vector2(0, 76)
	_overlay_primary.add_theme_font_size_override("font_size", 30)
	box.add_child(_overlay_primary)

	_overlay_secondary = Button.new()
	_overlay_secondary.custom_minimum_size = Vector2(0, 64)
	_overlay_secondary.add_theme_font_size_override("font_size", 24)
	box.add_child(_overlay_secondary)


func _make_label(text: String, size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
	return label


# --- Flow ------------------------------------------------------------------

func _show_intro() -> void:
	_running = false
	_overlay_title.text = "IELTS Writing: Punctuation"
	_overlay_body.text = "Fix the punctuation errors in the essay before time runs out.\n\nTarget: Writing band 7.0 (CLB 9) for Express Entry.\nWrong changes to correct marks cost you points."
	_overlay_primary.text = "Start"
	_set_button(_overlay_primary, func() -> void: _start_round())
	_overlay_secondary.visible = false
	_overlay.visible = true


func _start_round() -> void:
	var passage := _pick_passage()
	_title_label.text = passage.get("title", "")
	_time_limit = float(passage.get("time_limit", 60))
	_time_left = _time_limit
	_build_passage(passage.get("text", ""))
	_submit_button.disabled = false
	_overlay.visible = false
	_scroll.scroll_vertical = 0
	_running = true
	_update_hud()


func _finish(timed_out: bool) -> void:
	if not _running:
		return
	_running = false
	_submit_button.disabled = true
	var result := IeltsScoring.evaluate(_slots)
	result["timed_out"] = timed_out
	result["time_left"] = _time_left
	_reveal_answers()
	finished.emit(result)
	_show_results(result, timed_out)


func _show_results(result: Dictionary, timed_out: bool) -> void:
	var passed: bool = result["meets_clb9"]
	_overlay_title.text = "CLB %d  (Writing %.1f)" % [result["clb"], result["band"]]
	var lines: PackedStringArray = []
	if timed_out:
		lines.append("Time ran out.")
	lines.append("Fixed %d of %d errors" % [result["fixed"], result["errors"]])
	lines.append("Missed: %d   Broke correct marks: %d" % [result["missed"], result["broken"]])
	lines.append("")
	lines.append("CLB 9 reached. Express Entry points secured." if passed else "Below CLB 9. Your CRS score takes the hit.")
	_overlay_body.text = "\n".join(lines)
	_overlay_title.add_theme_color_override("font_color", COLOR_OK if passed else COLOR_BAD)
	_overlay_primary.text = "Review answers"
	_set_button(_overlay_primary, func() -> void: _overlay.visible = false)
	_overlay_secondary.text = "Next passage"
	_overlay_secondary.visible = true
	_set_button(_overlay_secondary, func() -> void: _start_round())
	_overlay.visible = true


func _set_button(button: Button, callback: Callable) -> void:
	for conn in button.pressed.get_connections():
		button.pressed.disconnect(conn["callable"])
	button.pressed.connect(callback)


func _update_hud() -> void:
	var secs := int(ceil(_time_left))
	_timer_label.text = "%d:%02d" % [secs / 60, secs % 60]
	_timer_label.add_theme_color_override("font_color", COLOR_BAD if _time_left <= 10.0 else COLOR_WARN)
	var errors := 0
	for s in _slots:
		if s.shown != s.correct:
			errors += 1
	_info_label.text = "%d errors to find" % errors


# --- Passage rendering -----------------------------------------------------

func _build_passage(text: String) -> void:
	for child in _passage_box.get_children():
		child.queue_free()
	_slots.clear()

	var current_flow := _new_paragraph()
	var last_was_slot := false
	for seg in PassageParser.parse(text):
		if seg.type == "slot":
			var slot := {"shown": seg.shown, "correct": seg.correct, "current": seg.shown}
			var button := Button.new()
			button.custom_minimum_size = Vector2(34, 46)
			button.add_theme_font_size_override("font_size", 28)
			button.pressed.connect(_on_slot_pressed.bind(_slots.size()))
			slot["button"] = button
			_slots.append(slot)
			_style_slot(slot)
			current_flow.add_child(button)
			last_was_slot = true
		else:
			var lines: PackedStringArray = seg.value.split("\n", true)
			for li in lines.size():
				if li > 0:
					current_flow = _new_paragraph()
					last_was_slot = false
				var words: PackedStringArray = lines[li].split(" ", true)
				for wi in words.size():
					var w := words[wi]
					if w == "":
						if wi == 0 and last_was_slot:
							current_flow.add_child(_gap_spacer())
						continue
					var is_last := wi == words.size() - 1
					var label := _make_label(w if is_last else w + " ", 28, COLOR_TEXT)
					current_flow.add_child(label)
					last_was_slot = false


func _new_paragraph() -> HFlowContainer:
	var flow := HFlowContainer.new()
	flow.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	flow.add_theme_constant_override("h_separation", 0)
	flow.add_theme_constant_override("v_separation", 8)
	_passage_box.add_child(flow)
	return flow


func _gap_spacer() -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(8, 0)
	return c


func _on_slot_pressed(index: int) -> void:
	if not _running:
		return
	var slot := _slots[index]
	slot["current"] = IeltsScoring.next_mark(slot["current"])
	_style_slot(slot)


func _style_slot(slot: Dictionary, reveal: bool = false) -> void:
	var button: Button = slot["button"]
	var mark: String = slot["current"]
	button.text = mark if mark != "" else "·"
	var color := COLOR_GAP
	if mark != slot["shown"]:
		color = COLOR_GAP_TOUCHED
	if reveal:
		color = COLOR_OK if slot["current"] == slot["correct"] else COLOR_BAD
		if slot["current"] != slot["correct"]:
			var want: String = slot["correct"]
			button.text = "%s→%s" % [mark if mark != "" else "·", want if want != "" else "·"]
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.set_corner_radius_all(6)
	style.content_margin_left = 6
	style.content_margin_right = 6
	for state in ["normal", "hover", "pressed", "focus", "disabled"]:
		button.add_theme_stylebox_override(state, style)


func _reveal_answers() -> void:
	for slot in _slots:
		_style_slot(slot, true)
		(slot["button"] as Button).disabled = true
