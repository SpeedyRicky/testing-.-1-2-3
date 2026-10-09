extends Node
## Autoload "Localization": runtime language switching (English / Nigerian Pidgin).
## English text lives in the dialogue nodes themselves; this table only holds
## translations, keyed by dialogue node id. A missing translation falls back to
## the node's own English text, so partially translated content never breaks.

signal language_changed(new_language: String)

const DATA_PATH := "res://data/localization_pidgin.json"
const LANGUAGES: Array[String] = ["en_NG", "pidgin_NG"]
const LANGUAGE_NAMES := {"en_NG": "English", "pidgin_NG": "Pidgin"}

var current_language: String = "en_NG"
var strings: Dictionary = {}
var ui: Dictionary = {}


func _ready() -> void:
	load_data()


func load_data(path: String = DATA_PATH) -> bool:
	if not FileAccess.file_exists(path):
		push_error("Localization: file not found: %s" % path)
		return false
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not (parsed is Dictionary):
		push_error("Localization: could not parse %s" % path)
		return false
	strings = parsed.get("strings", {})
	ui = parsed.get("ui", {})
	return true


func set_language(language: String) -> void:
	if language == current_language or not LANGUAGES.has(language):
		return
	current_language = language
	language_changed.emit(current_language)


func cycle_language() -> void:
	var i := LANGUAGES.find(current_language)
	set_language(LANGUAGES[(i + 1) % LANGUAGES.size()])


func language_name() -> String:
	return LANGUAGE_NAMES.get(current_language, current_language)


## Translated text for `key`, or `default_text` when no translation exists.
func text_for(key: String, default_text: String) -> String:
	var entry: Variant = strings.get(key)
	if entry is Dictionary and entry.has(current_language):
		return str(entry[current_language])
	return default_text


## UI label lookup: ui["section"]["key"], with fallback.
func ui_text(section: String, key: String, default_text: String) -> String:
	var sec: Variant = ui.get(section)
	if sec is Dictionary:
		var entry: Variant = sec.get(key)
		if entry is Dictionary and entry.has(current_language):
			return str(entry[current_language])
		if entry is String:
			return entry
	return default_text
