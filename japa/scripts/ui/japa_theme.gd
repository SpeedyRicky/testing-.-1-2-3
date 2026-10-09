class_name JapaTheme
extends RefCounted
## Builds the UI Theme in code (flat StyleBoxFlat, no image textures) so it stays
## light on low-RAM devices. Phase 1 uses the Lagos emerald palette, phase 2 the
## Canadian slate-blue palette.

const LAGOS := {
	"bg": Color("#0d1f16"), "panel": Color("#143324"),
	"base": Color("#0b6623"), "hover": Color("#128231"), "pressed": Color("#064e19"), "edge": Color("#064e19"),
}
const CANADA := {
	"bg": Color("#101a24"), "panel": Color("#1b2c3b"),
	"base": Color("#2f6f8f"), "hover": Color("#3a86ab"), "pressed": Color("#225670"), "edge": Color("#1a4358"),
}
const TEXT := Color("#e8eef2")
const MUTED := Color("#8fa3b0")


static func palette(phase: int) -> Dictionary:
	return CANADA if phase == 2 else LAGOS


static func make(phase: int) -> Theme:
	var p := palette(phase)
	var theme := Theme.new()
	theme.default_font_size = 24

	theme.set_stylebox("normal", "Button", _button_box(p["base"], p["edge"], 4))
	theme.set_stylebox("hover", "Button", _button_box(p["hover"], p["base"], 4))
	theme.set_stylebox("pressed", "Button", _button_box(p["pressed"], p["pressed"].darkened(0.3), 1))
	theme.set_stylebox("disabled", "Button", _button_box(Color("#3a444c"), Color("#2b343b"), 4))
	theme.set_stylebox("focus", "Button", _focus_box(p["hover"]))
	theme.set_color("font_color", "Button", Color.WHITE)
	theme.set_color("font_hover_color", "Button", Color("#f0fdf4"))
	theme.set_color("font_disabled_color", "Button", Color("#8a959c"))
	theme.set_font_size("font_size", "Button", 24)

	theme.set_stylebox("panel", "PanelContainer", _panel_box(p["panel"]))
	theme.set_color("font_color", "Label", TEXT)

	var bar_bg := StyleBoxFlat.new()
	bar_bg.bg_color = Color("#0a1117")
	bar_bg.set_corner_radius_all(6)
	var bar_fill := StyleBoxFlat.new()
	bar_fill.bg_color = p["hover"]
	bar_fill.set_corner_radius_all(6)
	theme.set_stylebox("background", "ProgressBar", bar_bg)
	theme.set_stylebox("fill", "ProgressBar", bar_fill)
	theme.set_constant("outline_size", "ProgressBar", 0)
	return theme


static func _button_box(fill: Color, edge: Color, bottom: int) -> StyleBoxFlat:
	var b := StyleBoxFlat.new()
	b.bg_color = fill
	b.set_corner_radius_all(12)
	b.set_content_margin_all(14)
	b.border_width_bottom = bottom
	b.border_color = edge
	return b


static func _focus_box(color: Color) -> StyleBoxFlat:
	var b := StyleBoxFlat.new()
	b.draw_center = false
	b.set_border_width_all(2)
	b.border_color = color
	b.set_corner_radius_all(12)
	return b


static func _panel_box(fill: Color) -> StyleBoxFlat:
	var b := StyleBoxFlat.new()
	b.bg_color = fill
	b.set_corner_radius_all(14)
	b.set_content_margin_all(14)
	return b
