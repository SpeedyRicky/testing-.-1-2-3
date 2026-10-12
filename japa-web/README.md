# Japa: The Great Escape

Sign in, build your avatar, tell the game who you are and where in Nigeria you live, then survive Nigeria,
study in Canada, chase an Express Entry invitation, pitch an incubator, gamble 180 days as a
tourist, and face Mr. Kovacs in the boardroom. Every route plays out in animated 2D scenes, and every choice
plays a short cutscene.
Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · lucide-react.

## Run it
```bash
npm install
npm run dev          # open http://localhost:3000 once the terminal says "Ready"
npm test             # 115 engine tests
npm run lint
npm run build
```

## Sign in and your profile
Before the game, a five-step flow (`app/components/Onboarding.tsx`):
1. **Sign in** with a username. It becomes your character's name everywhere, including name tags and cutscenes.
2. **Avatar:** skin tone, body size, hairstyle and colour, outfit (T-shirt & jeans, Ankara dress, buba & iro, agbada,
   senator, suit, hoodie) and colour, headwear (gele, fila, headwrap, beanie) and glasses.
3. **Who you are:** a student (school type, course, level, grade) or a worker (job, years of experience, highest
   qualification, monthly income), plus age.
4. **Your state:** any of the 36 states or the FCT, plus your **family in Canada** (see below).
5. **Your game profile:** age, ECA-equivalent education, work years, savings, CRS today and with IELTS + ECA.

The profile is saved on the device (`localStorage`); edit it or sign out from the title bar. It sets each route's
starting state (`routePatches` in `game/profile.ts`): Express Entry starts from your age, education and work years,
the Student route locks the master's until you hold a degree, and savings set your money everywhere.

**Nigeria, not just Lagos.** Scenes are written with placeholders (`{area}`, `{city}`, `{market}`, `{techHub}`,
`{bus}`, `{vacCity}`, `{airport}`, `{name}`...) filled from `game/nigeria.ts`: the danfo becomes a keke (or Abuja's
city bus), the market and phone market are local, and the nearest Canada visa centre (Lagos or Abuja) and
departure airport follow the state. A test fills every scene for all 37 places and fails on anything left unfilled.

## Family in Canada
The relative you keep calling lives in Canada, in a province picked at random (Ontario, Quebec, Alberta,
British Columbia, Manitoba, Saskatchewan or one of the Atlantic provinces), and you land at **Toronto Pearson**.
Their name matches your heritage (`game/family.ts`):
- `detectHeritage` reads the username: Igbo names (Chidike, Chioma, Nnamdi...) get an Igbo sister, brother or
  aunty (Adaeze, Emeka, Aunty Ngozi...); Yoruba names (Tolu, Adebayo, Funmi...) get a Yoruba one (Folake, Tunde,
  Aunty Bisi...); Hausa names get a Hausa one. A name it doesn't know falls back to the state's region.
- On the state step the player can change the background (Igbo / Yoruba / Hausa / Other Nigerian), pick sister,
  brother or aunty, and shuffle for a new name and province.
- Scenes use `{relName}`, `{relTitle}` ("Sister Adaeze"), `{RelWho}` ("Your sister Adaeze"), `{relCity}`,
  `{relProvince}`, `{relWeather}`, `{relGap}` (hours behind Nigeria) and pronouns `{relSubj}`/`{relObj}`/`{relPoss}`.
- The call screen shows their province: city towers (Ontario, Quebec), the Rockies (Alberta, BC), prairie with a
  grain elevator (Manitoba, Saskatchewan) or a harbour of coloured houses (Atlantic), with snow.
- A sister or brother in Canada sets `siblingInCanada`, worth 15 CRS points in Express Entry (an aunty is not).

## Endings cabinet and Reality checks
Every ending (46 so far) ends with a **Reality check**: one plain rule from the real process (`outcome.lesson` on the
scene, or `routes.<ROUTE>.lessons` by reason). The **Endings** chip in the header counts the endings you've found on
this device (`localStorage` key `japa.endings.v1`) and opens a cabinet grouped by route. A test fails if any ending
has no lesson.

Scenes added from community stories (see `docs/community-voices.html`): the study refusal with GCMS notes, student
housing and rental scams, the Express Entry reference letter and procedural fairness letter, the "Positive LMIA, CAD 25k"
WhatsApp seller, the claimant shelter crisis and cash-job trap, and random events from Nigeria to Year One.

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
| **Nigeria** | `STORY_STAGE` | Animated street scenes in your own state, local bus/keke/okada/trek travel, calls with your sister, brother or aunty in Canada. Keep Cash, Energy, Papers and Village People Interference alive. Traps and parallel-market shocks strike at random. Ends with a rank you can post on X; a win offers the next chapter. |
| **Student** | `STORY_STAGE` | The most common route: choose a program (master's, public college diploma, or a private-college trap), fund it (scholarship, family sponsor, land sale, crowdfunding), write the study plan, survive January at Pearson, work within the 24-hour rule, graduate. A PGWP carries you into Express Entry. |
| **Express Entry** | `STORY_STAGE` | IELTS, ECA, then a live CRS calculator with a breakdown. Draw nights decide: Canadian Experience Class (~518), French-language (~400), provincial nominee (+600). Proof of funds, police certificate, medical, PR. |
| **Startup Pitch** | `ZOOM_GRID` | 2x2 Zoom call with Ms. Vance, Mr. Chen, Mr. Ross, ending on the Letter of Support resolution. |
| **Tourist Gamble** | `STORY_STAGE` + `DASHBOARD` | Starts at CBSA primary inspection at Pearson. Then 180 days on a visitor record: daily actions, coffee with Mentor Wey Sabi, toasts, CAD/₦ wallet. 3 employer leads unlock the boardroom. Or **Kawosoke** (see below). |
| **LMIA Interview** | `CORPORATE_OFFICE` | The Mr. Kovacs dialogue tree. |
| **Year One** | `STORY_STAGE` | Life after landing: SIN and bank, renting with no credit, "no Canadian experience", the credential wall, black tax, the first winter, a layoff, Detty December. Ends back in your field, surviving, or reverse japa. Unlocked by permanent residence or refugee protection, or play it directly. |
| Trades, PNP Rural | | Coming soon: add scenes and set `status` to `playable`. |

## Kawosoke: the asylum branch of the Tourist Gamble
"Kawosoke" is the slang for claiming asylum, and Mentor Wey Sabi recommends it to everyone. Claim at the Pearson counter
on arrival, or later from the dashboard card **Kawosoke: Claim Asylum Inside Canada** (the IRCC portal). Then:
- **What you fear:** "nothing, I came for work" (honest exit, back to the dashboard); a bought story from Wey Sabi's
  unlicensed "paralegal" (CAD 1,500); a real sexual-orientation story; real gender-based violence; real conflict in the
  North (only for players from Borno, Yobe, Adamawa, Zamfara, Katsina, Kaduna, Sokoto, Niger, Benue or Plateau); or
  village people.
- **The wait and the hearing** move two meters, **Credibility** and **Evidence** (`kwCredibility`, `kwEvidence`).
- **Endings:** protected person; internal flight alternative ("try Port Harcourt"); refused on credibility; no nexus
  (village people); claim abandoned (flew home for the owambe); misrepresentation (a bought story always fails).
- Random events that only strike once a claim is filed (trap `when` conditions).

Real persecution is written straight and can win; the jokes are aimed at Wey Sabi and the people selling shortcuts.
The research behind this and every other route, with sources and a scenario backlog, is in
`docs/pathways-deep-dive.html`.

## How it fits together
```
app/layout.tsx, app/page.tsx         Next.js shell (Geist + Source Serif fonts)
app/globals.css, app/lagos-2d.css    Tailwind v4 theme + the hand-built 2D Lagos stage
app/canada-2d.css                    2D kit: Toronto skyline, CN Tower, snow, streetcar, interiors, props, extra poses
app/components/stages.ts             every non-Lagos 2D location as data (sky, ground, props, people, moods)
app/components/Stage2D.tsx           draws any stage; SceneStage picks LagosStage or the kit
app/components/Cinematic.tsx, app/cinematic.css   the after-choice cutscene, its provider and the speed switch
app/components/Onboarding.tsx        sign in, avatar builder, student/worker profile, state picker, summary
app/components/Player.tsx            the signed-in player: fills {placeholders}, provides the avatar and local transport
app/avatar.css                       avatar body sizes, hair, outfits and headwear
game/profile.ts                      profile types, options, profile -> game stats, text filling, validation
game/nigeria.ts                      36 states + FCT: city, area, market, transport, visa centre, airport
game/family.ts                       the relative in Canada: heritage from the name, name pools, provinces
docs/pathways-deep-dive.html         research: 2025-2026 rules per route, replay levers, scenario backlog
docs/community-voices.html           research: what Nigerians report about each route, and the scene each became
game/endings.ts                      every ending, its key and its Reality check lesson
app/components/Endings.tsx           Endings chip, cabinet, new-ending badge, Reality check box
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
- **Random events (traps), market shock, collapse rule:** tune the numbers under `routes.<ROUTE>`. Any route can have
  `traps`; an item with `when` (e.g. `{ "kwBasis": [">=", 1] }`) only strikes while that holds.
- **A dashboard card that opens a story scene:** give the action `goToSceneId`.
- **A 2D scene:** set `stage` on a scene (or a dashboard action) to any key in `app/components/stages.ts`, and
  `transitIn` to `danfo`, `okada`, `trek`, `call`, `plane`, `streetcar` or `snow-walk`. New locations are a few
  lines of data in `stages.ts`.
- **Local places:** write `{city}`, `{area}`, `{market}`, `{bus}`/`{Bus}`, `{vacCity}`, `{airport}`, `{name}` etc. in
  any text; the full list is `placeVars` + `relativeVars` + `profileVars`.
- **Overwriting a value** (e.g. a test result): a choice's `set`, e.g. `{ "clbFirst": 9 }`.
- **Carrying a player into another route:** an ending's `unlocksRoute`, `unlockStartSceneId` and `carry.routeStats`.

## Immigration numbers (check before release)
| Number | Value used | Source status |
|---|---|---|
| CRS tables (single applicant) | `crs` in `game/scenarios.json` | Long-standing IRCC grid; canada.ca was unreachable from the build environment, so re-check |
| Arranged employment points | 0 | Removed March 25, 2025 |
| Sibling in Canada (citizen or PR, 18+) | +15 CRS | Long-standing IRCC grid; re-check |
| Express Entry category draws 2026 | Healthcare ~470, trades ~476 | Third-party draw trackers |
| PGWP language test | CLB 7 university, CLB 5 college | Since Nov 2024 (secondary sources) |
| Asylum: one-year bar (Bill C-12) | Claims 1+ year after first entry go to PRRA only | Royal assent March 26, 2026 |
| Asylum: wait for an IRB decision | ~18 months | IRCC committee notes, Feb 2026 |
| Nigerian claims decided in 2025 | ~69% accepted | IRB data via news reports; verify |
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
