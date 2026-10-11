# Japa: The Great Escape

Survive Lagos Life, pitch a Canadian incubator, gamble 180 days as a tourist, and face Mr. Kovacs in the boardroom.
Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · lucide-react.

## Run it
```bash
npm install
npm run dev          # open http://localhost:3000 once the terminal says "Ready"
npm test             # 41 engine tests
npm run lint
npm run build
```

## Routes
| Tab | Layout | What happens |
|---|---|---|
| **Lagos Life** | `LAGOS_STAGE` | Animated Yaba street scenes, danfo/okada/trek travel, calls with Ada in Peckham. Keep Cash, Energy, Papers and Village People Interference alive. Traps and parallel-market shocks strike at random. Ends with a rank you can post on X; a win offers the next chapter. |
| **Startup Pitch** | `ZOOM_GRID` | 2x2 Zoom call with Ms. Vance, Mr. Chen, Mr. Ross, ending on the Letter of Support resolution. |
| **Tourist Gamble** | `DASHBOARD` | 180 days on a visitor record: daily actions, toasts, CAD/₦ wallet. 3 employer leads unlock the boardroom. |
| **LMIA Interview** | `CORPORATE_OFFICE` | The Mr. Kovacs dialogue tree. |
| Trades, PNP Rural | | Coming soon: add scenes and set `status` to `playable`. |

## How it fits together
```
app/layout.tsx, app/page.tsx         Next.js shell (Geist + Source Serif fonts)
app/globals.css, app/lagos-2d.css    Tailwind v4 theme + the hand-built 2D Lagos stage
app/components/Game.tsx              header, route tabs, Reset run
app/components/LayoutContainer.tsx   reads the current scene, picks layout + background by route, draws stat bars
app/components/layouts/              LagosStageLayout, ZoomGridLayout, DashboardLayout, CorporateOfficeLayout
app/components/LagosStage, Person, TravelRibbon, Popups   the Lagos visuals, pop-ups, game-over card, Post on X
game/scenarios.json                  ALL content: routes, scenes, choices, effects, traps, market shock, ranks
game/types.ts                        GameState and the scenarios.json schema
game/engine.ts                       pure rules (effects, conditions, endings, traps, market shock, ranks, dashboard)
game/machine.ts                      the state machine: one reducer, each route keeps its own progress
game/rng.ts                          dice rolls (passed into the engine, so the rules stay testable)
```

## Adding content without code
Everything a player sees comes from `game/scenarios.json`.
- **A scene:** add it under `scenes` with `route`, `layoutType`, `speaker`/`dialogue` (or `title`/`location`/`stage`/`transitIn`
  for Lagos) and `choices`. Each choice has `text`, `nextSceneId` and `effects` (e.g. `{ "walletNgn": -35000, "papers": 8 }`).
- **A locked choice:** `requires` + `lockedHint`, e.g. `{ "streetCred": [">=", 20] }`.
- **An automatic decision:** a `RESOLUTION` scene with `branch: [{ "when": {...}, "nextSceneId": "WIN" }, { "nextSceneId": "FAIL" }]`.
- **An ending:** a scene with `outcome` (`win` / `fail`). Lagos ranks are listed under `routes.LAGOS_LIFE.ranks`.
- **Traps, market shock, collapse rule:** tune the numbers under `routes.LAGOS_LIFE`.

`npm test` checks every link, stat name and dead end, so a typo fails the tests, not the game.

## Share a preview
`npm run standalone` writes `out/japa-standalone.html`, a single file that runs without a server.

## Deploy to Vercel
vercel.com → Add New → Project → import the repo → Deploy (set Root Directory if the game is in a subfolder).

## Disclaimer
A simulation for entertainment, not legal or immigration advice. Fraud options (fake documents, borrowed bank
statements, unauthorized work, fake job postings) are instant fails because they carry real penalties.
Check IRCC (canada.ca) for real rules.
