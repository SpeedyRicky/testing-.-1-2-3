# Japa: The Great Escape (web edition)

Next.js 14 + TypeScript + Tailwind CSS + lucide-react. A data-driven game: every scene, route, stat bar and
daily action lives in `src/game/scenarios.json`; React only renders what that file describes.

| Route | Layout | What happens |
|---|---|---|
| **The Startup Visa Pitch Route** (`STARTUP_VISA`) | `ZOOM_GRID` | 2x2 Zoom call with Ms. Vance, Mr. Chen, Mr. Ross. Answers move Investor Interest, Technical Credibility, Scalability Score. Ends on the Letter of Support resolution screen. |
| **The 180-Day Tourist Gamble** (`TOURIST_GAMBLE`) | `DASHBOARD` | Time remaining, energy, desperation, CAD wallet with ₦ conversion, location. Daily actions cost time, energy and money and show a toast. 3 employer leads win and unlock the LMIA interview, carrying your desperation and wallet in. |
| **The Hidden LMIA Interview** (`CAREGIVER_LMIA`) | `CORPORATE_OFFICE` | Mr. Kovacs dialogue tree in a boardroom theme. |
| Targeted Trade, PNP Rural | | Listed as "Soon". Add scenes and set `status` to `playable`. |

## Run
```
npm install
npm run dev        # http://localhost:3000
npm test           # 29 engine tests (vitest)
npm run build      # type-check + production build
```

## Deploy to Vercel
vercel.com → **Add New → Project** → import this repo → **Root Directory: `japa-web`** → Deploy.
Vercel detects Next.js; no settings needed.

For a single-file preview (no server): `node scripts/build-standalone.mjs out/japa.html`.

## Files
```
app/layout.tsx, app/page.tsx      Next.js shell (fonts, metadata)
src/game/types.ts                 GameState and the scenarios.json schema
src/game/scenarios.json           all content: routes, scenes, choices, effects, dashboard actions
src/game/engine.ts                pure rules: effects, conditions, scene entry, resolution, dashboard actions
src/game/machine.ts               the state machine (one reducer; each route keeps its own GameState)
src/components/LayoutContainer.tsx  reads the current scene, maps stats to animated bars, picks layout + background by route
src/components/layouts/*          ZoomGrid, CorporateOffice, Dashboard
```

## Adding a scene (no code)
Add an entry under `scenes` in `scenarios.json`:
```json
"SUV_PITCH_CHEN": {
  "id": "SUV_PITCH_CHEN", "route": "STARTUP_VISA", "layoutType": "ZOOM_GRID",
  "speaker": "Mr. Chen (Chief Technology Officer)",
  "dialogue": "Let's look at your architecture...",
  "choices": [
    { "text": "...", "label": "TECHNICAL DROPOUT", "nextSceneId": "SUV_PITCH_ROSS",
      "effects": { "technicalCredibility": -35 }, "feedback": "You did not answer the architecture question." }
  ]
}
```
- `effects`: numbers added to any `GameState` stat (`energy`, `walletCad`, `desperation`, ...) or `routeStats` key.
- `requires` + `lockedHint` on a choice lock it until a condition holds, e.g. `{ "streetCred": [">=", 20] }`.
- A `RESOLUTION` scene decides automatically: `branch: [{ "when": {...}, "nextSceneId": "WIN" }, { "nextSceneId": "FAIL" }]`.
  Its thresholds also draw the white tick on the stat bars.
- A scene with `outcome` ends the run (`result`: `win` / `fail` / `neutral`).
- `npm test` checks every link, stat name and dead end, so a typo fails the tests instead of the game.

## Content source
`scenarios.json` was seeded from the Godot game's `japa/data/japa_nodes.json` and is now the web game's own file.
The Godot project is not updated automatically from it.

## Disclaimer
A simulation for entertainment, not legal or immigration advice. Working without authorization on visitor status is
an instant fail in the game because it can lead to removal in real life. Check IRCC (canada.ca) for real rules.
