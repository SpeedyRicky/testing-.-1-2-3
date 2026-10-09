# Where everything from part 1 went

Part 1 (state machine, audio, UI, save, localization, Paystack, CI, marketing) and part 2 (IELTS minigame,
Startup Visa pitch, tourist gamble) are now one project. This is the map, and the list of things in part 1 that
would have failed or misled, so you know why the code differs from the original.

## Map

| Part 1 item | Now | Status |
|---|---|---|
| `japa_state_machine.gd` (metrics + dialogue in one script) | Split: `scripts/global/game_state.gd` (metrics, mutations, conditions) and `scripts/global/narrative.gd` (dialogue graph) | Ported, hardened |
| `data/japa_nodes.json` (agent scam, landlord) | Same file, now also holds the SUV pitch, Touchdown, devaluation and LMIA interview from part 2 | Merged |
| `japa_ui_manager.gd` (dual-budget dashboard) | `scripts/ui/main_game_view.gd`, built in code | Rewritten |
| `japa_button_theme.gd` | `scripts/ui/japa_theme.gd`: one Theme per phase (Lagos emerald, Canada slate) instead of a script on every button | Improved |
| `japa_audio_manager.gd` | `scripts/ui/audio_crossfade_mixer.gd`; silent if audio files are missing | Ported, hardened |
| `japa_save_system.gd` | `scripts/global/save_store.gd` | Rewritten |
| `japa_localization_manager.gd` + Pidgin strings | `scripts/global/localization.gd` + `data/localization_pidgin.json` | Ported; **4 of 22 nodes translated** |
| `japa_celebration_manager.gd` | `scripts/ui/celebration_screen.gd` (CPU particles) | Ported |
| Split-Family dashboard, remittance, Family Strain | Hub UI + `GameState.send_remittance`, `data/actions.json` | Ported |
| IELTS punctuation minigame (part 2) | `scenes/minigames/ielts_game.*`, opened from the hub, result stored in `GameState` | Merged |
| `test_japa_core.gd` stress test | `tests/run_tests.gd` (2,019 checks incl. fuzzing) + `tests/smoke_ui.gd` (44 UI checks) | Replaced |
| Paystack server, webhook, schema, analytics schema | `backend/` (tested) | Reference only, deferred |
| GitHub Actions pipeline | `.github/workflows/ci.yml` | Fixed; tests now run first |
| `export_presets.cfg` | Not shipped. See `docs/ANDROID.md` | Dropped on purpose |
| Store copy and asset specs | `docs/STORE_LISTING.md` | Edited |
| Web shop "loophole" | Not built | See `backend/README.md` |

## Problems in part 1 (found by reading and running it)

**Would not run in Godot 4**
- `onready var state_machine = ...` in the UI manager and the save system is Godot 3 syntax; Godot 4 needs `@onready`.
- The UI manager looks up nodes by hard-coded paths (`$VBoxContainer/HeaderPanel/HBox/StressBar`), but the setup
  instructions list node *types* without those names, so the paths cannot match. The UI is now built in code.
- `select_choice(99)` indexes past the end of the choices array. Part 1's own test expected a safe discard; it would
  have errored. Choices are now bounds-checked and locked choices are refused (tested).
- `next_node: "dashboard_home"` is used by the JSON but no such node exists, so "Return to Dashboard" would log a
  missing-node error. It is now a reserved id that returns to the menu.
- The stinger loads `village_people_warning.wav`, but the folder plan names the file `village_people_alarm.wav`,
  and `load()` on a missing file would fail. The mixer now checks first.

**Silently wrong**
- Mutations on keys not in `player_metrics` were dropped, so `unlocked_shelter` and `village_people_multiplier`
  never took effect. Booleans now become story flags, the multiplier is a "set" key, and other numbers go to
  per-pathway route stats (which is where the pitch's Investor Interest and Technical Credibility live).
- Burnout emitted a signal but play continued. Now the scenario ends and the menu shows Game Over.
  (A further case, a menu action that tips you into burnout, was missed even in the merged build until this pass.)
- Save: the start node ran from the state machine's `_ready` *and* from the loader; it only flushed on window close or
  back (not when the OS pauses the app); it overwrote the file in place (a battery death mid-write destroys the save);
  there was no version number.

**Security and money**
- A passphrase, an AES key and a Paystack fallback key sit in source or config. Any key shipped inside a game client
  can be extracted, so the save uses a SHA-256 checksum for corruption and makes no tamper claim. Nothing should
  trust local save contents for purchases.
- Webhook HMAC was computed over `JSON.stringify(req.body)` (different bytes from what Paystack signed) with a plain
  string compare; the claim step could double-credit under concurrent requests; the API URL was wrong. All fixed in `backend/`.
- The keystore was to be stored under `res://secrets/`, i.e. packed into the game. Keep it outside the project.
- The web-shop idea steers in-game players to external payment for digital items, a Google Play policy risk.

**Claims to measure, not assume**
- "Under 35MB / 50MB", "cuts power by 60%", and "production ready" were never measured. They are removed from the
  store copy; measure a real export on a real low-end phone first.

## Where the two designs disagreed, and what I picked

| Question | Part 1 | Part 2 / review | Chosen |
|---|---|---|---|
| Renderer | Compatibility in export, Forward+ in project | Mobile | **Compatibility**: Mobile needs Vulkan, which many budget phones handle badly |
| Particles | GPU | | **CPU**, the recommended choice for low-end GL devices |
| Save protection | AES with a key in source | Atomic JSON | **Atomic JSON + checksum** |
| Autoloads | 3 | "about 3" | **4** (GameState, Narrative, Localization, SaveStore), each with one job and no UI |
| Dialogue quality | Telegraphed tags | Hide tags, add trade-offs | **Feedback shown after the choice**; locked options show a hint |
| Monetization | ₦100 "undo" cards via web shop | Avoid pay-to-win | **None in the build**; see `backend/README.md` |
| Languages | en_NG, en_CA, pidgin_NG | | **en_NG + pidgin_NG** for now; en_CA was never different from en_NG |
