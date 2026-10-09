extends Node
## Autoload "SaveStore": local-first persistence. Works with no network at all.
##
## - Atomic: writes a temp file, then swaps it in (old save kept as .bak until the
##   swap succeeds), so a battery death mid-write cannot destroy the save.
## - Integrity: SHA-256 of the payload detects corruption. This is NOT tamper
##   protection; any key shipped inside a client app can be extracted. Do not
##   gate purchases on local save contents.
## - Autosave: debounced after state changes, and flushed on pause/close.

signal saved
signal loaded

const SAVE_VERSION := 1
const DEBOUNCE_SECONDS := 1.5

var save_path: String = "user://japa_save.json"

var state: Node
var narrative: Node
var loc: Node

var _dirty: bool = false
var _timer: Timer


func _ready() -> void:
	state = get_node_or_null("/root/GameState")
	narrative = get_node_or_null("/root/Narrative")
	loc = get_node_or_null("/root/Localization")
	_timer = Timer.new()
	_timer.one_shot = true
	_timer.wait_time = DEBOUNCE_SECONDS
	_timer.timeout.connect(_on_debounce)
	add_child(_timer)
	if state != null:
		state.metrics_updated.connect(func(_m: Dictionary) -> void: mark_dirty())
	if loc != null:
		loc.language_changed.connect(func(_l: String) -> void: mark_dirty())


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST \
			or what == NOTIFICATION_WM_GO_BACK_REQUEST \
			or what == NOTIFICATION_APPLICATION_PAUSED:
		flush_now()


func mark_dirty() -> void:
	_dirty = true
	if _timer != null and is_inside_tree() and _timer.is_stopped():
		_timer.start()


func _on_debounce() -> void:
	flush_now()


func flush_now() -> void:
	if _dirty:
		save_now()


func has_save() -> bool:
	return FileAccess.file_exists(save_path) or FileAccess.file_exists(save_path + ".bak")


func snapshot() -> Dictionary:
	var node_id := ""
	if narrative != null and narrative.active:
		node_id = narrative.current_node_id
	return {
		"version": SAVE_VERSION,
		"saved_at": Time.get_unix_time_from_system(),
		"game": state.to_dict(),
		"language": loc.current_language if loc != null else "en_NG",
		"node": node_id,
	}


func save_now() -> bool:
	var payload := JSON.stringify(snapshot())
	var envelope := JSON.stringify({"sha256": payload.sha256_text(), "payload": payload})
	var tmp := save_path + ".tmp"
	var bak := save_path + ".bak"

	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		push_error("SaveStore: cannot open %s (error %d)" % [tmp, FileAccess.get_open_error()])
		return false
	f.store_string(envelope)
	f.close()

	if _read_envelope(tmp).is_empty():
		push_error("SaveStore: verification of %s failed" % tmp)
		DirAccess.remove_absolute(tmp)
		return false

	if FileAccess.file_exists(save_path):
		if FileAccess.file_exists(bak):
			DirAccess.remove_absolute(bak)
		DirAccess.rename_absolute(save_path, bak)
	var err := DirAccess.rename_absolute(tmp, save_path)
	if err != OK:
		push_error("SaveStore: swap failed (error %d)" % err)
		if FileAccess.file_exists(bak):
			DirAccess.rename_absolute(bak, save_path)
		return false
	if FileAccess.file_exists(bak):
		DirAccess.remove_absolute(bak)
	_dirty = false
	saved.emit()
	return true


## Returns the payload dictionary, or {} if the file is missing, corrupt or fails its hash.
func _read_envelope(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var env: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not (env is Dictionary) or not env.has("payload") or not env.has("sha256"):
		return {}
	var payload_text := str(env["payload"])
	if payload_text.sha256_text() != str(env["sha256"]):
		return {}
	var payload: Variant = JSON.parse_string(payload_text)
	if payload is Dictionary:
		return payload
	return {}


## Loads the newest valid save (falls back to the .bak). Returns true on success.
func load_game() -> bool:
	var data := _read_envelope(save_path)
	if data.is_empty():
		data = _read_envelope(save_path + ".bak")
	if data.is_empty():
		return false
	if int(data.get("version", 0)) > SAVE_VERSION:
		push_error("SaveStore: save is from a newer game version")
		return false
	state.from_dict(data.get("game", {}))
	if loc != null:
		loc.set_language(str(data.get("language", "en_NG")))
	_dirty = false
	loaded.emit()
	var node_id := str(data.get("node", ""))
	if narrative != null and node_id != "":
		narrative.resume(node_id)
	return true


func delete_save() -> void:
	for p in [save_path, save_path + ".bak", save_path + ".tmp"]:
		if FileAccess.file_exists(p):
			DirAccess.remove_absolute(p)
	_dirty = false
