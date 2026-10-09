class_name PassageParser
extends RefCounted
## Parses passage markup into segments.
##
## Markup: plain text, plus editable gaps written as [shown/correct].
##   "Dear Sir[/,] I am writing"  -> gap shows nothing, correct mark is ","
##   "Canada[,/,] is"             -> gap already correct (a distractor: don't touch it)
##   "visa[./]"                   -> gap shows ".", correct is nothing

const SLOT_PATTERN := "\\[([^/\\]]*)/([^\\]]*)\\]"


static func parse(text: String) -> Array[Dictionary]:
	var segments: Array[Dictionary] = []
	var regex := RegEx.new()
	regex.compile(SLOT_PATTERN)
	var cursor := 0
	for m in regex.search_all(text):
		var start := m.get_start()
		if start > cursor:
			segments.append({"type": "text", "value": text.substr(cursor, start - cursor)})
		segments.append({
			"type": "slot",
			"shown": m.get_string(1),
			"correct": m.get_string(2),
		})
		cursor = m.get_end()
	if cursor < text.length():
		segments.append({"type": "text", "value": text.substr(cursor)})
	return segments


static func slot_count(segments: Array[Dictionary]) -> int:
	var n := 0
	for s in segments:
		if s.type == "slot":
			n += 1
	return n
