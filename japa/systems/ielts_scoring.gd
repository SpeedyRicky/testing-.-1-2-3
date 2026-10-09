class_name IeltsScoring
extends RefCounted
## Pure scoring logic for the punctuation minigame. No nodes, so it is unit-testable.
##
## A "slot" is one editable gap. Each slot has: shown (initial mark), correct, current (player's mark).
## - error slot:    shown != correct
## - distractor:    shown == correct (changing it is a mistake)

const MARKS: Array[String] = ["", ",", ".", ";", ":", "?", "!"]

## Simplified game mapping (NOT the official IELTS rubric): accuracy -> Writing band.
## Writing 7.0 = CLB 9, the Express Entry target.
const WRITING_TO_CLB := {
	7.5: 10, 7.0: 9, 6.5: 8, 6.0: 7, 5.5: 6, 5.0: 5, 4.0: 4,
}


static func next_mark(current: String) -> String:
	var i := MARKS.find(current)
	if i == -1:
		return MARKS[0]
	return MARKS[(i + 1) % MARKS.size()]


## slots: Array of {shown, correct, current}
static func evaluate(slots: Array) -> Dictionary:
	var errors := 0
	var fixed := 0
	var missed := 0
	var broken := 0
	for s in slots:
		var was_error: bool = s.shown != s.correct
		var is_right: bool = s.current == s.correct
		if was_error:
			errors += 1
			if is_right:
				fixed += 1
			else:
				missed += 1
		elif not is_right:
			broken += 1
	var net := maxi(fixed - broken, 0)
	var accuracy := 1.0 if errors == 0 else float(net) / float(errors)
	var band := band_for(accuracy, broken)
	return {
		"errors": errors,
		"fixed": fixed,
		"missed": missed,
		"broken": broken,
		"accuracy": accuracy,
		"band": band,
		"clb": WRITING_TO_CLB[band],
		"meets_clb9": WRITING_TO_CLB[band] >= 9,
	}


static func band_for(accuracy: float, broken: int) -> float:
	if accuracy >= 1.0 and broken == 0:
		return 7.5
	if accuracy >= 0.9:
		return 7.0
	if accuracy >= 0.8:
		return 6.5
	if accuracy >= 0.65:
		return 6.0
	if accuracy >= 0.5:
		return 5.5
	if accuracy >= 0.3:
		return 5.0
	return 4.0
