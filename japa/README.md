# Japa: The Great Escape

A story-and-strategy simulation about moving from Nigeria to Canada. Godot 4.3, GDScript, fully offline.

## Run
1. Open this folder in Godot 4.3 or newer (Project Manager > Import > `project.godot`).
2. Press F5. The main scene is `scenes/main_game_view.tscn`.

## How to play (v0.3 campaign)
**Phase 1, The Lagos Grind.** Work, study and rest with the daily actions; every day costs N10,000 to live and may
trigger a Village People event (fuel surge, NEPA, a hospital bill, owambe, loan recovery, devaluation).
Raise the N7,000,000 Japa fund (grind, or the Japa Fund scenario: micro-loan, sell the car, pitch Uncle Emeka),
reach IELTS Writing CLB 7 in the minigame, study IELTS 3 times, then pass the **timed visa interview**
(20 s per question; freezing, lying about a loan or offering a bribe all fail it; a refusal can be retried).
The visa unlocks **Touchdown**.
**Phase 2, The Canadian Reality.** Living costs CAD 30 a day and family strain creeps up while you are away.
Find a home (The Landlord), win sponsorship (The LMIA Interview), survive 30 days, then play **One Year On** to finish.
Burnout (stress 100) or family breakdown (strain 100) ends the run.

The language button switches English / Pidgin; it re-renders an open dialogue.
Prebuilt desktop builds (no Godot needed) are produced with `godot --headless --path . --export-release "Windows Desktop" build/Japa.exe`
using `export_presets.cfg`.
To play only the minigame, open `scenes/minigames/ielts_game.tscn` and press F6.

## Test
On a fresh checkout run the import once first (opening the project in the editor does the same); without it the
class names do not resolve and the tests fail with "Identifier not declared".
```
godot --headless --path . --import                       # once, builds the class cache
godot --headless --path . -s res://tests/run_tests.gd    # logic, narrative paths, save, fuzzing
godot --headless --path . -s res://tests/smoke_ui.gd     # drives the real scene by pressing buttons
cd backend && npm install && npm test                    # reference backend
```
Both Godot scripts exit non-zero on failure, so they work in CI (`.github/workflows/ci.yml`).

## Add content (no code needed)
- **Scenario**: add nodes to `data/japa_nodes.json` and an entry in `scenarios`. Format reference: `PLAN.md` section 3.
  The test suite checks every `next_node` exists, every mutation is valid, and walks the scenarios.
- **IELTS passage**: add to `data/ielts_passages.json`; gaps are `[shown/correct]`, e.g. `Dear Sir[/,]` (missing comma) or `Canada[./.]` (already right, a trap).
- **Translation**: add the node id under `strings` in `data/localization_pidgin.json`. Missing ones fall back to English.
- **Daily action**: add to `data/actions.json` with `phase` (1 Lagos, 2 Canada); optional `requires` + `locked_hint`.
- **Village People event**: write the nodes, add a scenario with `"event": true`, then list it in `data/events.json`
  (`phase`, `weight`, optional `once` and `when`). Rolls are seeded per run, so a run replays identically.
- **Timed node**: add `time_limit` (seconds) and a hidden `timeout` choice (`next_node`, `mutations`, `tag`, `feedback`).
- **Scenario gating**: `requires` + `locked_hint` lock it in the menu; `replayable` keeps it open after `done_flag`;
  `reset_stats` restarts only that scenario's own counters.
- **Audio**: drop mono OGG files at the paths listed in `scripts/ui/audio_crossfade_mixer.gd`; without them the game is silent.

## Docs
`PLAN.md` (design, architecture, milestones) · `docs/FROM_PART_ONE.md` (what was merged and what was fixed) ·
`docs/ANDROID.md` · `docs/STORE_LISTING.md` · `backend/README.md`

## Note
The IELTS band-to-CLB mapping is a simplified game approximation, not the official rubric. Nothing here is
immigration advice; verify real rules with IRCC.
