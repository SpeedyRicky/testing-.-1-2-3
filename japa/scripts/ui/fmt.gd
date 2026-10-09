class_name Fmt
extends RefCounted
## Small display-formatting helpers.


## 1234567.4 -> "1,234,567"; negatives keep their sign.
static func money(amount: float) -> String:
	var digits := str(int(roundf(absf(amount))))
	var out := ""
	var count := 0
	for i in range(digits.length() - 1, -1, -1):
		out = digits[i] + out
		count += 1
		if count % 3 == 0 and i > 0:
			out = "," + out
	if amount < 0.0 and out != "0":
		out = "-" + out
	return out


## "CHOICE_TAG_NAME" -> "Choice tag name"
static func tag(raw: String) -> String:
	if raw == "":
		return ""
	var s := raw.replace("_", " ").to_lower()
	return s.substr(0, 1).to_upper() + s.substr(1)
