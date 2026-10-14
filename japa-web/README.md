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
npm test             # 178 engine tests, including seeded balance checks
npm run simulate     # balance report: thousands of simulated playthroughs per route
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
- Home life follows heritage too: `{faithHub}` (church or masjid; Hausa players pray at a masjid, Yoruba families
  split), `{faithGroup}`, `{faithDay}` and `{parent}` (Mama, Mummy or Umma) appear in Year One, the Tourist hub and
  the Student pathway.

## Risky choices
Some choices are gambles: the button shows the chance of success (a 🎲 chip, green when likely, red when a long shot),
worked out from your preparation (`choice.gamble` in `scenarios.json`: base `odds`, a `bonus` per stat point, and
`success`/`fail` branches with their own effects and destinations). Examples: IELTS with three months of study
(CLB 9, or "one band short" at CLB 8) versus booking for Saturday; the study permit decision, driven by your study
plan; a live demo for Mr. Chen; "why not Port Harcourt?" at the hearing, driven by your evidence. Frauds are never
gambles: they always fail.

## Japa Points, the Oja market and the daily challenge
- **Japa Points (JP):** 10 for finishing a run, 30 for a win, 25 for a new ending, 5 per new level star, plus the
  daily challenge. Lifetime JP sets your title (JJC → Japa apprentice → Visa hustler → Paper chase pro → Japa legend).
- **Oja market:** perks that change your next runs (equip two): +15 energy, −10 Village People, +15% money, 30% fewer
  traps, +6% on every risky choice, +10 Street Cred. Plus name flair next to your username.
- **Daily challenge:** the same route and modifier for every player each day (Naira crash day, Harmattan, Wey Sabi is
  in town, Lucky Friday, Strike season, Owambe weekend). Win for 60 JP × your streak bonus (up to ×2).
- **Streak:** finish a run on consecutive days.
- Progress is saved per player on this device (`japa.meta.v1`); mid-run state too (`japa.save.v1`), so a refresh
  continues where you were. A first-time "How to play" tour opens once; the ? button reopens it.

## Achievements, blessings, keyboard and sharing
- **17 achievements** pay JP: Clean hands (win without a shady move), Honest exit, Scam spotter, Permanent resident,
  Protected person, Collector (10 endings), Completionist (30), Three-star general, Daily winner, 3- and 7-day streaks,
  and more. They're listed under Japa Hub → Your record.
- **Blessings:** good surprises (a credit alert from Aunty, NEPA light for 24 hours, a department bursary, a pro bono
  lawyer, a landlord who drops the rent), more likely when Village People Interference is high. `routes.<ROUTE>.blessings`.
- **Keyboard:** number keys 1-9 pick choices.
- **Share:** the game-over card has Post on X and Copy result: route, ending, your stars per level, interference.

## Balance
`game/simulate.ts` plays each route thousands of times with three seeded players: random, careful (avoids frauds and
dead ends) and smart (also manages energy and nerves, avoids loops, likes good odds). Win rates for the smart player
after tuning:

| Route | Smart win | Notes |
|---|---|---|
| Nigeria | 42% | was 13% before tuning (energy ran out) |
| Student | 37% | grades and program choice decide most losses |
| Express Entry | 64% | plus 27% switch to the Student route |
| Startup Pitch | 44% | one weak answer costs you unless a gamble lands |
| Tourist Gamble | 76% | about 67 days per win; 21% run out of money |
| LMIA Interview | 82% | short, and the right answers are learnable |
| Year One | 30% back in your field | 65% "surviving", which is still a pass |

The balance tests fail if a smart player wins less than 20% or more than 90% of a route, or if runs get stuck.

## Levels
Every route is split into named levels (3 to 5 each, 26 in all), set under `routes.<ROUTE>.levels` in
`game/scenarios.json`: a title, a goal, the scenes it covers and two bonus-star targets. Finishing a level earns one
star; each target met when you finish earns another. A banner announces each new level after the cutscene (with the
stars from the one you just finished), a strip above the scene shows your levels, and the **Level map** lets you
replay any level you have reached from the moment it started. Stars and replay points are saved on the device
(`japa.levels.v1`). Rules live in `game/levels.ts`; the UI in `app/components/Levels.tsx`.

| Route | Levels |
|---|---|
| Nigeria | Generator Coughs · The Paper Chase · The Gate |
| Student | Admission · Show the Money · The Officer · First Winter · Convocation |
| Express Entry | Tests and Transcripts · The Pool · Invitation to Apply · Sixty Days |
| Startup Pitch | Ms. Vance · Mr. Chen · Mr. Ross |
| Tourist Gamble | Primary Inspection · 180 Days · Kawosoke · The Wait · Room 7 |
| LMIA Interview | Mr. Kovacs · The Advertising Question |
| Year One | Landing · The Hustle · Cold Season · Year End |

## Music and sound
Original Naija-style music, composed live in the browser with Web Audio (no audio files, nothing to license):
- **Lagos** Afrobeat (108 BPM): off-beat kick, clap, shekere, talking drum, highlife guitar, horn stabs.
- **Hustle** amapiano (113 BPM): log drum and off-beat piano, for the Tourist dashboard and Year One.
- **Tension** (84 BPM): heartbeat kick, low drone, a lone talking drum, for visa centres, the border, draw night,
  the hearing and the boardroom.
- **Canada** cold highlife with bells, **Pitch** Afro-house, **Triumph** for a win, **Somber** for a loss.

Sound effects play on taps, each cutscene (by tone, plus coins in or out), danfo horns, okada engines, phone rings,
planes, wind, random events ("wahala?" on the talking drum), level-ups, and the ending fanfare or "dun dun DUN".
Browsers only allow sound after a tap, so the music starts on your first click. The header chip opens a small
mixer: **Music on / Effects only / Muted**, music and effects volume sliders, and a **Soundtrack** picker, all
remembered:
- **Afrobeats** (default): the grooves above.
- **Amapiano Vibes**: log drums and off-beat keys for every scene, slowed down for tension and loss.
- **Highlife Gold**: palmwine guitars that swing.
- **Fuji Drums**: talking drums lead, shekere drives, film-style booms under the tension.
- **Nollywood Drama**: big detuned strings, low "boom" impacts and risers into each phrase.
Styles are data (`STYLES` and `grooveFor` in `game/music.ts`); a mood a style doesn't restyle falls back to
Afrobeats. The strings, booms and risers are new instruments in `app/audio/engine.ts`. Grooves are data in `game/music.ts`; the synth is `app/audio/engine.ts`.
To use licensed recordings for a mood, see `public/music/README.md`.

## Endings cabinet and Reality checks
Every ending (49 so far) ends with a **Reality check**: one plain rule from the real process (`outcome.lesson` on the
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

## Playtest fixes (v0.16)
Three persona playtests (a Lagos nurse, an Ibadan ex-visitor, a Calgary newcomer from Kaduna) read every route.
What changed:
- **Facts:** you keep your passport at the visa centre (it's requested after a yes: "PPR"), and nobody there interviews
  you; spouse open work permits need a 16-month master's; CLB 6 is below the Express Entry floor; PTE Core counts;
  category draws need 6 months of experience; a job offer needs a work permit; Startup Visa money must come from a
  designated Canadian angel group or VC fund; only licensed (CICC) consultants may charge; Ontario own-use evictions
  don't cover a nephew; EI needs insurable hours; uncertain dates were softened.
- **New scenes:** the nurse thread (Matron, council verification, "UK first?"), japa in silence, Ghana Must Go at
  customs, first tax season (the group-chat tax guy is fraud), the gig-driver year, a December callback if you said
  no to family, the cash shift (a gamble, not a free CAD 150), the couch getting tight, an honest flight home with a
  clean record, and a regulation question in the Startup pitch.
- **Right answers cost something (v0.17):** the honest study plan costs a week of nights (an editor is the middle
  option), GCMS notes cost an intake, the honest reference letter is a gamble when the boss has moved to Dubai, and
  hearing prep costs sleep. Year One adds a schedule clash with `{faithDay}` (Jumu'ah or Sunday service).
- **Callbacks:** saying no to family money comes back in December; a posted boarding pass brings a gift-card "IRCC"
  scam call; warning the group chat about a scam can bring a job lead; Matron's signed reference helps the Express
  Entry letter later.
- **Feel:** characters have faces (brows, blinking, a mouth that follows your stats), stat bars flash and pop on
  change and pulse **Danger** near a collapse line, and the sound chip is a mixer.

## Your job shapes the story (v0.18–v0.19)
`game/careers.ts` maps the sign-up occupation (or course) to a track: tech, health, teaching, engineering, trades or
business. Nigeria Life's job hunt, listing, interview story, offer catch and side hustle follow it (a nurse hunts on a
ward and registers with the nursing college before any offer); the Student route offers programs in your field and
the study plan names your background; Year One shows bridging and licence options only for regulated fields.
Nurse licensing: NNAS for most provinces (BC's college assesses directly), and the provincial regulator decides when
you sit the NCLEX-RN; "Two tests, one nurse" explains IELTS Academic/CELBAN vs the Express Entry tests.
Round-3 fixes: unauthorized cash work and filing a bought asylum story are instant fails again; heritage words
(`{homeFood}`, `{uncle}`, `{partyCloth}`) replace Southern-only details; relatives never share your name; the
Startup route says IRCC has paused new Start-up Visa applications; a worker charged for an LMIA is treated as the
victim; a new Tourist scene with Kunle, whose boss holds his passport.

## Kawosoke: the asylum branch of the Tourist Gamble
"Kawosoke" is the slang for claiming asylum, and Mentor Wey Sabi recommends it to everyone. Claim at the Pearson counter
on arrival, or later from the dashboard card **Kawosoke: Claim Asylum Inside Canada** (the IRCC portal). Then:
- **Your own story:** every character has one true backstory, fixed by their profile (`kwTruthFor` in
  `game/family.ts`): nothing (most visitors), outed as LGBTQ, partner violence, or targeted by armed groups (likely for
  players from Borno, Yobe, Adamawa, Zamfara, Katsina, Kaduna, Sokoto, Niger, Benue or Plateau). The claim screen shows
  it, and only that "It really happened" option is open; the others say "That isn't your story".
- **What you fear:** "nothing, I came for work" (honest exit, back to the dashboard); a bought story from Wey Sabi's
  unlicensed "paralegal" (CAD 1,500); your own true story; or village people.
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
game/meta.ts, app/components/Meta.tsx      Japa Points, titles, perks, flair, daily challenge, streak, Japa Hub
game/save.ts                         mid-run saves; game/simulate.ts: the balance simulator
app/components/Tutorial.tsx, OddsChip.tsx  first-play tour; the odds chip on risky choices
game/levels.ts, app/components/Levels.tsx   levels, stars, banner, level map and replay
game/music.ts, app/audio/engine.ts, app/components/Sound.tsx   grooves and moods, the Web Audio band, the sound toggle
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

## Launch: previews, analytics, install
- **Link previews:** a 1200×630 card (`app/opengraph-image.tsx`) with Open Graph and X tags, so a pasted link shows
  the title and art on X, WhatsApp and LinkedIn. Set `NEXT_PUBLIC_SITE_URL` so the card uses your domain.
- **Analytics:** `app/launch/analytics.ts`, off unless you set Plausible or PostHog keys (see `.env.example`). It
  sends route and ending ids, counts and the visit source, never names or profile data, and respects Do Not Track.
- **Home-screen install:** web app manifest, icons, a service worker for offline play, and an **Install** chip
  (a how-to on iPhone Safari).
- The step-by-step plan from deploy to investors is in `docs/LAUNCH.md`.

## Share a preview
`npm run standalone` writes `out/japa-standalone.html`, a single file that runs without a server.

## Deploy to Vercel
vercel.com → Add New → Project → import the repo → Deploy (set Root Directory if the game is in a subfolder).

## Disclaimer
A simulation for entertainment, not legal or immigration advice. Fraud options (fake documents, borrowed bank
statements, unauthorized work, fake job postings) are instant fails because they carry real penalties.
Check IRCC (canada.ca) for real rules.
