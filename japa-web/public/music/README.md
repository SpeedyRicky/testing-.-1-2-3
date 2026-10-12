# Optional music tracks

The game composes its own Naija-style music in the browser (`game/music.ts`, `app/audio/engine.ts`), so nothing
here is required. To use licensed recordings instead, put the files in this folder and list them by mood in
`manifest.json`, for example:

```json
{ "lagos": "lagos-afrobeat.mp3", "hustle": "amapiano-loop.mp3", "tension": "tension.mp3" }
```

Moods: `lagos` (Nigeria scenes), `hustle` (Tourist Gamble dashboard, Year One), `tension` (embassy, border, hearing,
draw night, boardroom), `canada`, `pitch` (Startup Visa), `triumph` (a win), `somber` (a loss). A listed file loops
in place of that mood's synthesized groove; unlisted moods keep the synth. Only use music you have the rights to.
The single-file standalone build always uses the synth.
