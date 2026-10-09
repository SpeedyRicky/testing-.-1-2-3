# Android export

Part 1 shipped an `export_presets.cfg` with option names that Godot 4.3 does not have (`graphics/driver_name`,
`audio/driver`, `audio/channel_layout`, ...) and a committed encryption key. A hand-written preset that the editor
silently ignores is worse than none, so none is shipped. Let the editor create it.

## Steps

1. Install the 4.3 export templates (Editor > Manage Export Templates), Android SDK and JDK 17, and point
   Editor Settings > Export > Android at them.
2. Project > Install Android Build Template (needed for an `.aab`). Commit `android/build`.
3. Project > Export > Add > Android. Set:
   - Gradle Build: on, Export Format: Android App Bundle
   - Architectures: arm64-v8a only (keeps the download small; add armeabi-v7a if your test devices need it)
   - Unique Name and Name; Min SDK 21 is fine for the Compatibility renderer
   - Do **not** type passwords or keys into the preset; use the environment variables in the CI file.
4. Create a release keystore **outside** the project folder (`keytool -genkeypair -v ...`) and back it up in two
   places. If you lose it you cannot update the app.

## Check before release (I could not verify these here)

- **Play target API level.** Godot 4.3's Android template targets API 34 by default. Google Play raises the minimum
  target API every year, and new uploads in late 2026 may require a newer level than 4.3 supports. Check the Play
  Console requirement now; the likely fix is moving to a newer Godot 4.x before release. The project uses only
  basic Control nodes, so the upgrade should be small, but run the test suite after it.
- **Size.** Measure the real `.aab` and the per-device download. The project has no audio or image assets yet, so
  today's number says nothing about the final one. OGG, mono, 22 kHz for ambience keeps loops small.
- **Low-end devices.** Test on a real budget phone (Tecno, Infinix, Itel class): frame rate, memory, battery, and
  the pause/resume save path (switch apps mid-scenario, then reopen). `run/max_fps=30` is already set.

## Encrypting the exported game

Godot can encrypt the packed resources (PCK) and scripts with a 256-bit key. That slows down casual extraction of
dialogue text; it does not stop a determined person because the key must be inside the app. Treat it as optional
polish. Never use it as a reason to trust local save data.
