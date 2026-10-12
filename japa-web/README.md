# Japa: The Great Escape

Survive Lagos Life, study in Canada, chase an Express Entry invitation, pitch an incubator, gamble 180 days as a
tourist, and face Mr. Kovacs in the boardroom. Every route plays out in animated 2D scenes, and every choice
plays a short cutscene.
Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · lucide-react.

## Run it
```bash
npm install
npm run dev          # open http://localhost:3000 once the terminal says "Ready"
npm test             # 72 engine tests
npm run lint
npm run build
```

## Choice cutscenes
After every choice (and every Tourist Gamble action) a ~3 second cutscene plays in the scene where you chose:
1. **Say:** the camera pushes in, a big "You" steps in and the line appears word by word in a speech bubble.
2. **React:** the other character responds, the choice's label slams down as a stamp, and the scene reacts to the
   tone: confetti (good), maple-leaf confetti (win), sweat drops and a red shake (bad), sirens (fraud), coins falling
   or flying away (money in or out).
3. **Results:** each stat change pops out as a green or red chip.

It is built automatically from what the choice changed (`game/cinematic.ts`), so new scenes need no extra work.
Tap, Escape or Skip ends it early; the header switch toggles **Full** (3 s) and **Quick** (1.3 s) and is remembered.

## Routes
| Tab | Layout | What happens |
|---|---|---|
| **Lagos Life** | `LAGOS_STAGE` | Animated Yaba street scenes, danfo/okada/trek travel, calls with Ada in Peckham. Keep Cash, Energy, Papers and Village People Interference alive. Traps and parallel-market shocks strike at random. Ends with a rank you can post on X; a win offers the next chapter. |
| **Student** | `STORY_STAGE` | The most common route: choose a program (master's, public college diploma, or a private-college trap), fund it (scholarship, family sponsor, land sale, crowdfunding), write the study plan, survive January at Pearson, work within the 24-hour rule, graduate. A PGWP carries you into Express Entry. |
| **Express Entry** | `STORY_STAGE` | IELTS, ECA, then a live CRS calculator with a breakdown. Draw nights decide: Canadian Experience Class (~518), French-language (~400), provincial nominee (+600). Proof of funds, police certificate, medical, PR. |
| **Startup Pitch** | `ZOOM_GRID` | 2x2 Zoom call with Ms. Vance, Mr. Chen, Mr. Ross, ending on the Letter of Support resolution. |
| **Tourist Gamble** | `DASHBOARD` | 180 days on a visitor record: daily actions, toasts, CAD/₦ wallet. 3 employer leads unlock the boardroom. |
| **LMIA Interview** | `CORPORATE_OFFICE` | The Mr. Kovacs dialogue tree. |
| Trades, PNP Rural | | Coming soon: add scenes and set `status` to `playable`. |

## How it fits together
```
app/layout.tsx, app/page.tsx         Next.js shell (Geist + Source Serif fonts)
app/globals.css, app/lagos-2d.css    Tailwind v4 theme + the hand-built 2D Lagos stage
app/canada-2d.css                    2D kit: Toronto skyline, CN Tower, snow, streetcar, interiors, props, extra poses
app/components/stages.ts             every non-Lagos 2D location as data (sky, ground, props, people, moods)
app/components/Stage2D.tsx           draws any stage; SceneStage picks LagosStage or the kit
app/components/Cinematic.tsx, app/cinematic.css   the after-choice cutscene, its provider and the speed switch
game/cinematic.ts                    pure rules: which stats changed, good or bad, which effects to play
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
- **A 2D scene:** set `stage` on a scene (or a dashboard action) to any key in `app/components/stages.ts`, and
  `transitIn` to `danfo`, `okada`, `trek`, `call`, `plane`, `streetcar` or `snow-walk`. New locations are a few
  lines of data in `stages.ts`.
- **Overwriting a value** (e.g. a test result): a choice's `set`, e.g. `{ "clbFirst": 9 }`.
- **Carrying a player into another route:** an ending's `unlocksRoute`, `unlockStartSceneId` and `carry.routeStats`.

## Immigration numbers (check before release)
| Number | Value used | Source status |
|---|---|---|
| CRS tables (single applicant) | `crs` in `game/scenarios.json` | Long-standing IRCC grid; canada.ca was unreachable from the build environment, so re-check |
| Arranged employment points | 0 | Removed March 25, 2025 |
| Express Entry proof of funds, 1 person | CAD 15,263 | July 2025 figure, still cited in Oct 2026 |
| Study permit living costs, 1 person | CAD 23,448 | Applications from Sept 1, 2026 (secondary sources) |
| Off-campus work during classes | 24 h/week | Since Nov 2024 |
| 2026 draw cutoffs | CEC ~507-523, French 382-420 | Third-party draw trackers |
| PGWP | Master's exempt from field-of-study list; private career colleges not eligible | Secondary sources |

`npm test` checks every link, stat name and dead end, so a typo fails the tests, not the game.

## Share a preview
`npm run standalone` writes `out/japa-standalone.html`, a single file that runs without a server.

## Deploy to Vercel
vercel.com → Add New → Project → import the repo → Deploy (set Root Directory if the game is in a subfolder).

## Disclaimer
A simulation for entertainment, not legal or immigration advice. Fraud options (fake documents, borrowed bank
statements, unauthorized work, fake job postings) are instant fails because they carry real penalties.
Check IRCC (canada.ca) for real rules.
