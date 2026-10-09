class_name CelebrationScreen
extends Control
## Full-screen reward overlay with confetti. Built entirely in code.
## Styles: "visa" (multicolour confetti) and "border" (Canadian red and white).
##
## Uses CPUParticles2D on purpose: the target phones (budget Android, 2 GB RAM,
## OpenGL ES) are the case Godot recommends CPU particles for, and 150-250
## flat squares cost almost nothing on the CPU.

signal closed

var _title: Label
var _subtitle: Label
var _particles: CPUParticles2D
var _button: Button


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	visible = false

	var dim := ColorRect.new()
	dim.color = Color(0.03, 0.06, 0.08, 0.92)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(dim)

	_particles = CPUParticles2D.new()
	_particles.one_shot = true
	_particles.emitting = false
	_particles.explosiveness = 0.0
	add_child(_particles)

	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)

	var box := VBoxContainer.new()
	box.custom_minimum_size = Vector2(560, 0)
	box.add_theme_constant_override("separation", 24)
	center.add_child(box)

	_title = Label.new()
	_title.add_theme_font_size_override("font_size", 46)
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(_title)

	_subtitle = Label.new()
	_subtitle.add_theme_font_size_override("font_size", 26)
	_subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_subtitle.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(_subtitle)

	_button = Button.new()
	_button.text = "Continue"
	_button.custom_minimum_size = Vector2(0, 76)
	_button.add_theme_font_size_override("font_size", 30)
	_button.pressed.connect(_on_continue)
	box.add_child(_button)


func play(title_text: String, subtitle_text: String, style: String = "visa") -> void:
	_title.text = title_text
	_subtitle.text = subtitle_text
	modulate.a = 0.0
	visible = true
	_configure_particles(style)
	var tween := create_tween().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tween.tween_property(self, "modulate:a", 1.0, 0.6)
	_particles.restart()
	_particles.emitting = true


func _configure_particles(style: String) -> void:
	var width := get_viewport_rect().size.x
	_particles.position = Vector2(width * 0.5, -20.0)
	_particles.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	_particles.emission_rect_extents = Vector2(width * 0.5, 1.0)
	_particles.direction = Vector2(0, 1)
	_particles.spread = 15.0
	if style == "border":
		_particles.gravity = Vector2(0, 120)
		_particles.initial_velocity_min = 80.0
		_particles.initial_velocity_max = 180.0
		_particles.scale_amount_min = 6.0
		_particles.scale_amount_max = 12.0
		var grad := Gradient.new()
		grad.set_color(0, Color("#ff0000"))
		grad.set_color(1, Color("#ffffff"))
		_particles.color_ramp = grad
		_particles.hue_variation_min = 0.0
		_particles.hue_variation_max = 0.0
		_particles.amount = 150
		_particles.lifetime = 5.0
	else:
		_particles.gravity = Vector2(0, 180)
		_particles.initial_velocity_min = 100.0
		_particles.initial_velocity_max = 250.0
		_particles.scale_amount_min = 4.0
		_particles.scale_amount_max = 8.0
		_particles.color = Color("#ffcc33")
		_particles.color_ramp = null
		_particles.hue_variation_min = -1.0
		_particles.hue_variation_max = 1.0
		_particles.amount = 250
		_particles.lifetime = 4.0


func _on_continue() -> void:
	visible = false
	_particles.emitting = false
	closed.emit()
