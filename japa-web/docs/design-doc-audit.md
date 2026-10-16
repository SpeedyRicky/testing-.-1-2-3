# Design-doc audit: what we took, adapted, corrected or left out

Two design documents were checked line by line against the game (v0.24). Status key:
**Built** = now in the game · **Already in** = the game had it · **Adapted** = built, but changed to fit the
web game or real rules · **Corrected** = the doc's claim was wrong or risky, fixed in the game · **Not built** = left
out on purpose (reason given).

## Document 1 — game design

| Idea | Status | Where / notes |
|---|---|---|
| Earn money for IELTS, sneak out of a micromanaging job | **Built** | Nigeria: "Oga at the top" (ask HR for leave → a real employment letter for your file; sneak out at lunch; call in sick), each a gamble |
| Passport office delays, dodge fake agents | **Built** | Passport-office tout (instant fail); the Agent Room; "we know people" consultant |
| Stealth at airport immigration | **Not built** | Evading border control would teach something illegal. The airport is a *rapid-fire interview* instead (CBSA, and the new file-review boss) |
| Three stat bars: Funds, Village People, Street Cred | **Already in** | Every route has money, a Village People/desperation meter and a route skill bar |
| Archetypes: Student, Tech Bro, Nurse | **Built** | Sign-up job/course picks a track (tech, health, teaching, engineering, trades, business). Nigeria, Student, Express Entry and Year One text follow it; nurses get their own licensing scenes |
| Phase 1: hustle economy, document quest, funding pool, final-boss interview | **Built / Adapted** | Funding: family meeting, crowdfund, car sale on Jiji, loan apps. Final boss: the timed file-review interview (Student) |
| Embassy interview | **Corrected** | Canada rarely interviews study-permit or visitor applicants; the officer decides on paper. The "interview" is presented as the officer reading your file, so players learn the real process |
| Phase 2: exchange-rate shock, housing hunt, survival jobs, cultural friction | **Built** | Landing FX shock card and "≈ ₦" under every CAD balance; Mr. Henderson's landlord screening; warehouse/delivery shifts; the accent conversation, first tax season, customs |
| London / Houston destinations | **Not built** | The game is Canada-only by your earlier direction; adding the UK/US would double every rule to verify |
| Scholarship route: cold emails, exam stress, reference chase | **Built** | Student → "Chase a fully funded research master's": tailored vs mass email, the analog professor (malt + traffic), a self-written reference is fraud |
| GRE/GMAT micro-tests | **Corrected** | Most Canadian master's don't require the GRE; the game says so. Language tests are the real gate |
| Vanier scholarship as the win | **Corrected** | Federal graduate scholarships were restructured in 2024–25, so the game doesn't promise Vanier; the win is university/RA funding, which is what most funded students actually get |
| Express Entry: live CRS, age penalty, IELTS max-out, ECA courier delays, POF crisis, draws, French pivot | **Already in** | Express Entry route has all of these (CRS meter, CLB 7 floor, PTE Core, French, category draws, 6-month rule, settlement funds) |
| Self-funded route: sell car, pension, property; FX volatility; home ties | **Built / Adapted** | Car on Jiji (fake credit alert), FX volatility scene with an instant loan app, devaluation crisis events. Pension cash-out left out (the PenCom withdrawal rules are narrow and changing; worth a verified scene later) |
| Crowdfunded route: viral pitch, aso-ebi family board, trust tracker | **Built** | Crowdfund (authentic vs dramatic; backlash risk), family meeting (pledge, private gift deed, family loan), donor-trust crisis event later |
| Post-landing: tuition installments, black tax pop-ups | **Built** | Black-tax crisis events; tuition comes out every term |
| Missed tuition = "automatic immigration violation" | **Corrected** | Not automatic. Students must stay enrolled and in good standing; the game frames it that way |
| Startup Visa: LOS hunt, co-founder diplomacy | **Already in / Built** | The pitch plus a new co-founder crisis (your CTO's Manchester offer; you can't claim a backup if he leaves) |
| Startup Visa: "immediate PR, zero net worth" | **Corrected** | Founders must show settlement funds, and IRCC has paused new Start-up Visa applications; the route says so |
| Caregiver/LMIA: target draws, fake-LMIA scammers, fast-track permits | **Already in / Corrected** | Fake LMIA and caregiver scams are instant fails. "Fast-tracked work permits" is wrong today: the home care worker pilots aren't taking new applications |
| Targeted Trade route | **Built** | New playable route: documented years, CLB 5/4 bar, certificate or job offer, trades draw, −27°C on the scaffold |
| "Electrical Engineering" as a trade | **Corrected** | Engineering is a regulated profession, not a trade; the route covers electricians, plumbers and welders |
| Visitor-to-work-permit gamble | **Already in / Corrected** | The Tourist Gamble. Since 28 Aug 2024 visitors generally can't apply for a work permit from inside Canada; the game teaches that |
| "Fraudulent or exaggerated home-ties portfolio" | **Not built** | Fraud is always an instant fail in this game. Real home ties (an employer's leave letter, property, family) are rewarded instead |
| PNP rural route: +600, geographic lock | **Built / Corrected** | New playable route. "Geographic lock" corrected: PRs have mobility rights, but misrepresenting your intent to settle can be misrepresentation |
| Phase 2: founder grind, trade winter, caregiver tied to employer | **Built** | Trades winter scene; Kunle (passport held by his boss → open work permit for vulnerable workers) |
| The Agent Room script | **Built** | Your Alhaji script almost word for word, with the Red-flag/Skepticism choices, safe escape (+20 Street Cred, −10 stress), retaliation, and the Section 40 game over |

## Document 2 — scenes, UI and technology

| Idea | Status | Where / notes |
|---|---|---|
| Embassy interview script (3 choice points) | **Adapted** | Student file-review boss with a 15-second timer per question. Pooled/borrowed funds now *lower* the officer's confidence (they don't count) rather than counting as fraud, because disclosing them honestly isn't misrepresentation |
| Dashboard: mission card, CRS hub, daily grind | **Already in** | Level banner/strip shows the objective; Express Entry shows CRS; Tourist dashboard is the daily-grind board |
| Live currency widget with exchange damage | **Built** | "≈ ₦" under every CAD balance; FX shock card on landing; runway days on the Tourist dashboard |
| Village People gauge pulsing red, collapse | **Already in** | Danger pulse near collapse lines; burnout endings |
| Forums tab | **Built** | "Gist": a daily X/Nairaland-style feed per route, with Community notes correcting myths and scams |
| Phase 2 tracker: temperature, credit score, SIN, health card | **Adapted** | Year One covers SIN, bank, health card, credit cards and winter as scenes; a separate credit-score gauge was left for later |
| Landlord screening (Mr. Henderson) | **Built / Corrected** | "First and last two months upfront" corrected: in Ontario a landlord can't demand more than a last-month deposit; volunteering more under pressure is discouraged. Student work limit corrected from 20 to 24 hours a week |
| IELTS punctuation mini-game | **Not built** | IELTS doesn't test punctuation sorting. The timed-question mechanic is ready for a real IELTS-style micro-quiz next |
| Startup pitch and Kovacs scripts | **Already in** | Both are in the game (from your earlier spec). The "tailor the ad to West African trade compliance" answer was corrected: requirements written to fit one candidate get scrutinised |
| 6-month ticking clock, burndown | **Already in / Built** | 180-day counter; runway days added |
| Village People event generator with choices | **Built** | Crisis pop-ups that force a choice: devaluation, fuel surge, freeze-thaw shock, black tax, donors, transformer, SOWP backlog, P.A. Day, stream paused |
| Split-family route, Family Strain, dual budget | **Built** | New playable route "Pilot & Passenger": CAD and naira wallets side by side, Family Strain (100 = breakdown), remittances, time zones, kids, SOWP |
| State machine singleton, nested JSON | **Already in** | `game/machine.ts` + `game/scenarios.json` (pure, tested reducer) |
| "Decrypts" JSON / encrypted local storage | **Not built (explained)** | Anything decrypted in the browser can be decrypted by the player too, so client-side encryption adds no security. Instead: a checksum + sanity checks reject corrupted or edited saves, and the save flushes when the phone backgrounds the app. Purchases (if ever added) must be verified on a server |
| Dual-bus ambient mixer | **Built** | Lagos bed (generator, chatter, danfo horns) + Canada bed (blizzard, furnace), crossfaded by scene, with an Ambience slider |
| Full Nigerian Pidgin localisation + runtime switcher | **Built** | English/Pidgin toggle; 1,406 translated lines, loaded only when chosen; placeholders verified. UI buttons are still English |
| Godot export presets, project.godot frame clamp, queue_free | **Not applicable** | The game isn't Godot. Equivalents: Capacitor Android wrapper, CSS animations (GPU-composited), no audio files at all (synthesised), React unmounts nodes automatically |
| minSdk 21 / targetSdk 34 | **Corrected** | Google Play requires targetSdk 35 for new apps (2025+); Capacitor 7 needs minSdk 23 (Android 6). Configured 23/35 |
| .aab under 50 MB | **Built** | The offline build is about 1 MB; CI fails if the bundle exceeds 50 MB |
| Play pricing in NGN/GHS | **Documented** | `docs/ANDROID.md` — there are no in-app purchases yet |
| Paystack inside the Play build | **Corrected (don't)** | Google Play requires Play Billing for digital goods sold inside Play-distributed apps; using Paystack for in-app digital purchases risks removal unless the app is enrolled in an approved alternative-billing program. Paystack is fine on the website |
| Backend hosting + PostgreSQL analytics schema | **Built / Adapted** | `docs/analytics-schema.sql` (star schema, insert-only RLS, funnel views) + optional Supabase sink in `app/launch/analytics.ts`. Hosting: Vercel (web) + Supabase free tier |
| Marketing assets | **Built (placeholders)** | `store/`: 512 icon (danfo in snow), 1024×500 feature graphic, four 1080×1920 screenshots from the real game. A designer should redo the icon and graphic before launch |
| Play Store copy | **Corrected** | `store/listing.md`: removed "Embassy Interview", "immediate PR", "under 35MB" (it is about 1 MB) and other claims that would mislead players |
| Stress-test engine | **Built** | `game/fuzz.test.ts`: 4,000 random runs with extreme values across all routes; tampered saves rejected |
| GPU celebration particles | **Already in** | Win confetti and ending animations are CSS transforms (GPU-composited) |
| GitHub Actions CI/CD for an optimized .aab | **Built** | `.github/workflows/japa-ci.yml`: lint, typecheck, tests, simulation, builds; signed .aab on tags |
| Downloadable project zip | **Built** | `deliverables/japa-game-v0.24.zip` |
| Android memory bug-hunting strategy | **Adapted** | `docs/ANDROID.md`, rewritten for a WebView app on Tecno/Infinix/itel phones |
| Custom UI button themes | **Already in** | Tailwind theme with route colours; not reworked this round |

## Follow-up request: pathways depend on the profile (v0.25)

| Idea | Status | Where / notes |
|---|---|---|
| Sign-up asks questions that decide your pathways | **Built** | New "Your situation" step (marital status, money you could show, startup) plus trade jobs (plumber, welder, carpenter, mechanic) |
| Only show what the player qualifies for | **Built / Adapted** | `game/eligibility.ts`. Locked routes stay visible with a padlock and the exact reason, rather than hidden, so players learn who each route is for and what to change |
| Real criteria | **Adapted** | Simplified: FSW 1 year skilled work, FST 2 years in a trade, visitor visa funds and ties, spousal route for married players. Not an eligibility check; the modal points to IRCC's "Come to Canada" tool |
| Progression unlocks | **Built** | Student PGWP win opens Express Entry; any landing opens Year One; Tourist win opens the LMIA interview |

## Follow-up: stolen and fake passports (v0.26)

| Idea | Status | Where / notes |
|---|---|---|
| Some people travel on stolen or fake passports | **Built (as fraud)** | Nigeria route, passport office: a "travel connect" offers a lookalike passport (someone else's, often stolen) or a forged "fresh one". Both are instant fails with Reality Checks (impostor fraud, misrepresentation, five-year ban, fingerprints checked on arrival). Walking away and reporting him earns Street Cred. No detail on how such documents are made or used |
| The victim's side | **Built** | New crisis: your passport is stolen at the motor park. Reporting it to the police and the NIS costs money and time but flags the booklet; skipping the report costs more |
| Gist feed | **Built** | "Lookalike passports, Canada visa already inside" scam post with a Community note |

## Follow-up: the working Nigerian, tests, WES, nurses, Atlantic Canada, why people visit (v0.27)

| Idea | Status | Where / notes |
|---|---|---|
| Workers have no time to study (4 a.m. commute, owambe Saturdays, long Sunday programmes) | **Built** | Express Entry opens for working players with "4:00 a.m. Again.", Saturday's invitations, and Sunday by faith (church programme vs Jumu'ah on Friday). Study time raises the test odds |
| IELTS is worth more points than CELPIP | **Corrected** | Express Entry converts every approved test to CLB, and the same CLB earns the same points (CELPIP 9 = CLB 9 = IELTS L8 R7 W7 S7). CELPIP is offered in Nigeria (Lagos and Ibadan are on the official site). For AIP, PNP and Trades only the minimum CLB matters, so the game says to pick the test you're most comfortable with |
| Booking a weekday test and sneaking out | **Built** | A gamble: Oga travels, or the server crashes and you pay twice |
| Japa is a secret at work; HR may sideline or let you go | **Built** | "Who told HR?" (workers only): stay quiet, tell your manager (gamble), or post it and lose the promotion |
| Not resigning at once; remote months; close to retirement | **Built** | Year One "Your Lagos job is still open" (workers only): ask honestly for remote months, resign properly, or hide the move and lose your reference |
| WES saga: reference number, registry, re-verification, official email, bribes | **Built / Corrected** | New "WES has emailed your school" scene. WES issues the reference number when you submit the application, and payment can follow before evaluation, so the Convera workaround isn't needed (and Convera may not serve every country). Bribing a clerk is a crime and, in the game, bounces |
| Atlantic Immigration Program | **Built (new route)** | Designated employers only, job offer terms, CLB 5 (TEER 0-3) / CLB 4 (TEER 4), ECA, needs assessment and settlement plan with a designated provider (ISANS, the Association for New Canadians…), endorsement, referral letter, offer of employment number from the Employer Portal, employer-specific work permit, settlement funds. New Brunswick's 2025 pause is a crisis event. Paying a recruiter or the employer's compliance fee, fake transcripts, leaving the employer, and unauthorised work all fail |
| Nurses: NNAS, authorisation to test, IELTS, NCLEX in Nairobi or Johannesburg | **Built / Corrected** | The college sets the English test (Ontario accepts IELTS General; BC wants Academic, CELBAN or OET); NNAS is optional in BC; NCLEX abroad scene with Nairobi (simpler entry) vs Johannesburg (visa) |
| Visitors: family visits, invite letters, meeting employers | **Built** | New Tourist Gamble opener "Why are you going?": a family visit, or meeting an employer your relative found (allowed if you say so). Hiding the real purpose is misrepresentation |
| Stolen or arranged passport, thrown away at Pearson, then Kawosoke | **Built (as fraud)** | Instant fail: detained until identity is established, and missing documents weigh against credibility. Genuine claimants can claim with their own passport |
