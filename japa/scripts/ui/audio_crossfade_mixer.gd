class_name AudioCrossfadeMixer
extends Node
## Two ambient loops (Lagos / Canada) play together and are crossfaded by volume,
## never swapped, so the transition has no gap. If an audio file is missing the
## game simply stays silent, so the project runs before any audio is added.
##
## Expected files (mono OGG, 22 kHz keeps them small):
##   res://audio/ambient/lagos_market_chatter.ogg
##   res://audio/ambient/canada_howling_blizzard.ogg
##   res://audio/sfx/village_people_alarm.wav

const FADE_DURATION := 2.5
const SILENT_DB := -80.0
const ACTIVE_DB := -6.0

const LAGOS_PATH := "res://audio/ambient/lagos_market_chatter.ogg"
const CANADA_PATH := "res://audio/ambient/canada_howling_blizzard.ogg"
const STINGER_PATH := "res://audio/sfx/village_people_alarm.wav"

var lagos_player: AudioStreamPlayer
var canada_player: AudioStreamPlayer


func _ready() -> void:
	lagos_player = _make_player(LAGOS_PATH)
	canada_player = _make_player(CANADA_PATH)
	lagos_player.volume_db = ACTIVE_DB
	canada_player.volume_db = SILENT_DB
	for p in [lagos_player, canada_player]:
		if p.stream != null:
			p.play()


func _make_player(path: String) -> AudioStreamPlayer:
	var player := AudioStreamPlayer.new()
	if ResourceLoader.exists(path):
		var stream: AudioStream = load(path)
		if stream != null and "loop" in stream:
			stream.set("loop", true)
		player.stream = stream
	add_child(player)
	return player


## Connect to GameState.phase_changed.
func transition_environment_audio(target_phase: int) -> void:
	var to_lagos := ACTIVE_DB if target_phase != 2 else SILENT_DB
	var to_canada := ACTIVE_DB if target_phase == 2 else SILENT_DB
	var tween := create_tween().set_parallel(true).set_trans(Tween.TRANS_SINE)
	tween.tween_property(lagos_player, "volume_db", to_lagos, FADE_DURATION)
	tween.tween_property(canada_player, "volume_db", to_canada, FADE_DURATION)


func play_stinger() -> void:
	if not ResourceLoader.exists(STINGER_PATH):
		return
	var stinger := AudioStreamPlayer.new()
	stinger.stream = load(STINGER_PATH)
	stinger.volume_db = -2.0
	add_child(stinger)
	stinger.finished.connect(stinger.queue_free)
	stinger.play()
