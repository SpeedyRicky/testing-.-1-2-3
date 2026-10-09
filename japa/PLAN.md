# Japa: The Great Escape — Unified Plan (v3)

Godot 4.3, GDScript, offline-first. This replaces the earlier two plans and merges the original design notes
(part 1: engine, UI, save, Pidgin, payments; part 2: IELTS game, Startup Visa pitch, tourist gamble) with the review.
Companion notes: `docs/FROM_PART_ONE.md` (where each piece went and what was wrong), `docs/ANDROID.md`,
`docs/STORE_LISTING.md`, `backend/README.md`.

## 1. Where the project stands

| Area | State | Evidence |
|---|---|---|
| Core state: dual wallets, stress, family strain, street cred, flags, per-pathway stats | Built | `scripts/global/game_state.gd` |
| Data-driven dialogue engine (conditions, auto-branches, locked choices, after-the-fact feedback) | Built | `scripts/global/narrative.gd` |
| 6 playable scenarios (22 nodes): fake agent, devaluation shock, Startup Visa pitch, Touchdown, landlord, LMIA interview | Built | `data/japa_nodes.json` |
| IELTS punctuation minigame (3 passages), result feeds the game state | Built | `scenes/minigames/` |
| Hub: split Canada/Nigeria dashboard, scenario menu, 5 Canada daily actions, remittance | Built | `scripts/ui/main_game_view.gd` |
| Local save: atomic, checksummed, backup, autosave, flush on pause | Built | `scripts/global/save_store.gd` |
| English / Nigerian Pidgin switch (re-renders an open dialogue) | Built, **4 of 51 nodes translated** | `data/localization_pidgin.json` |
| Phase themes, celebration screen, ambient crossfade | Built; **no audio files yet** | `scripts/ui/` |
| "Simulation, not legal advice" notice | Built | menu footer |
| Tests | 6,541 unit/fuzz checks (incl. a scripted player that wins 40/40 seeded campaigns), 80 UI checks, 6 backend tests: all pass on Godot 4.3 | `tests/`, `backend/test/` |
| Phase 1 (Lagos) loop: 5 daily actions, living costs, goal checklist | Built (v0.3) | `data/actions.json`, `main_game_view.gd` |
| Day tick + seeded Village People events (6 Lagos, 4 Canada) | Built (v0.3) | `systems/day_cycle.gd`, `data/events.json` |
| Timed visa interview with refusal-and-retry, misrepresentation and bribery fails | Built (v0.3) | `emb_*` nodes |
| Funding pool: micro-loan, sell the car, "pitch the uncle" tree | Built (v0.3) | `fund_*`, `uncle_*` nodes |
| Campaign win: home + sponsorship + 30 Canada days, then "One Year On" | Built (v0.3) | `year_one` scenario |
| Express Entry, CRS calculator, document quest | **Not built** (needs verified IRCC numbers) | see M1 step 6 |
| Android export, real-device test | **Not done** | `docs/ANDROID.md` |

The client has zero network code, so the game is fully offline today.

## 2. Design

### Story shape
Phase 1, **The Lagos Grind**: build a profile, raise money, secure the visa before burnout.
Phase 2, **The Cold Reality**: survive landing, housing, survival jobs, family back home, and winter.

### Shared stats (in `GameState`)
| Stat | Range | Meaning |
|---|---|---|
| `naira_wallet`, `cad_wallet` | ≥ 0 | Two budgets. Remittance converts CAD to Naira (rate is illustrative, to come from remote config) |
| `stamina` | 0–100 | Daily energy |
| `mental_stress` | 0–100 | "Village People" bar. 100 = burnout = game over |
| `family_strain_index` | 0–100 | 100 = family breakdown = game over (the Nigerian funding line locks) |
| `street_cred` | ≥ 0 | Adaptability, earned by smart moves |
| `village_people_multiplier` | set | Scales bad-luck events |
| pathway stats | any | e.g. `investor_interest`, `technical_credibility`, `scalability_score`, `ielts_best_clb` |

### Pathways × funding sources
The original eight "routes" mixed two things. Pathways are what status you pursue; funding is how you pay.

| Original route | Where it lives |
|---|---|
| Express Entry | Pathway: Express Entry (CRS, IELTS, ECA, proof of funds, draws) |
| PNP | Modifier on Express Entry (+600 CRS, geographic lock) |
| Trades, Caregiver | Streams of Express Entry / LMIA |
| Startup Visa | Pathway (pitch scenario already playable) |
| Caregiver / LMIA | Pathway (agent-scam scenario and Kovacs interview already playable) |
| Visitor-to-Work | Pathway, framed as a high-risk gamble; fraud options are instant fails |
| Scholarship, Self-funded, Crowdfunded, family sponsor | **Funding sources** for a Study Permit pathway; each funding minigame is written once and reused |
| Spousal split | Modifier on any pathway ("married with dependents": Solo Vanguard or Single-Parent Pilot) |

Archetypes (Student, Tech, Nurse, Trades) become starting loadouts, which are data (starting wallet, stamina, stress), not code.

### Dialogue rules
Every option has a real cost or risk. Outcome tags are revealed after the choice. Options can be locked behind earlier
preparation and show why. The Startup Visa pitch already works this way: only strong answers reach the 70-interest /
65-credibility Letter of Support threshold, and one weak answer is survivable.

## 3. Architecture (as built)

```
autoloads   GameState · Narrative · Localization · SaveStore   (each one job, no UI)
data/       japa_nodes.json  localization_pidgin.json  actions.json  ielts_passages.json
scripts/    global/ (autoloads)   ui/ (hub, theme, audio, celebration, formatting)
systems/    passage_parser.gd  ielts_scoring.gd         (pure logic, no nodes)
scenes/     main_game_view.tscn   minigames/ielts_game.*
tests/      run_tests.gd  smoke_ui.gd
backend/    reference server (deferred)
```

**Mutations** (`GameState.apply_mutations`): `set_phase: N` switches geography; a boolean becomes a story flag; keys in
`SET_KEYS` overwrite; metric keys add then clamp; any other number accumulates into pathway stats.
**Conditions**: `{"route.investor_interest": [">=", 70], "flag.clb9_writing": ["==", true]}`; operators `>= > <= < == !=`.
**Dialogue node**: `speaker`, `text`, `choices[]` (`text`, `next_node`, `mutations`, `requires`, `locked_hint`, `tag`,
`feedback`), `on_enter`, `auto_branch` (resolved instantly, e.g. the Letter of Support check), `terminal_condition` +
`outcome` + `celebration`. The id `dashboard_home` returns to the menu. Content is data: a new scenario needs no code.
**Save**: temp file, verify, swap, `.bak` kept until the swap succeeds; SHA-256 detects corruption (not tampering);
debounced autosave plus flush on pause/close. **Localization**: English lives in the node; Pidgin is an override table keyed by node id.
**Rendering**: Compatibility renderer, CPU particles, flat `StyleBoxFlat` theme (no textures), 30 fps cap.

## 4. Milestones

| | Scope | Status |
|---|---|---|
| **M0** Fun test | IELTS minigame | Done. Not yet playtested by real players |
| **M1** Vertical slice | Lagos Grind + Express Entry + landing, local save | In progress (below) |
| **M2** Closed beta | 30–50 players, remote config, anonymous analytics, optional cloud save | Reference backend exists |
| **M3** Expansion | Study Permit + funding minigames | Not started |
| **M4+** | Startup Visa, LMIA, Visitor-to-Work as full episodes | Core scenarios exist as single scenes |

### M1 remaining, in build order
1. **Real-device check first.** Export an Android build, play on a budget phone, measure size, frame rate, battery, and the pause/resume save.
2. ~~**Lagos hub.**~~ Done in v0.3.
3. ~~**Day tick + seeded Village People events.**~~ Done in v0.3; `_test_campaign_bot` is the headless balancing run.
4. ~~**Embassy interview**~~ Done in v0.3 (game abstraction: most real Canadian visa files from Nigeria have no interview).
5. ~~**Funding pool**~~ Done in v0.3.
6. **Express Entry**: CRS calculator as a pure function with tables in JSON, ECA courier delay, proof-of-funds puzzle, draw events, French/PNP pivot. **Every number must be verified against IRCC** and stored with a `verified_on` date.
7. **Landing loop**: housing hunt, survival-job shifts, black-tax pop-ups.
8. **Translate the remaining 47 nodes** with a native Pidgin speaker reviewing all of it.
9. Audio (mono OGG, 22 kHz) and the first real art.

Gate each milestone on player feedback. If testers do not replay the IELTS game or finish a scenario by choice,
fix that before adding pathways.

## 5. Decisions and why

- **Offline-first means "never needs the network", not a sync engine.** Event sourcing, outboxes and merge rules were dropped.
  The backend's real jobs are remote config (rules that change in real life) and anonymous analytics.
- **Compatibility renderer.** Mobile needs Vulkan; budget phones are the audience.
- **No monetization in the build.** If you add some, avoid items that undo failure (pay-to-win in a game about
  financial pressure) and use Play Billing for digital items (`backend/README.md` explains the policy risk of the web shop).
- **Content is the bottleneck.** Expect 15–25k words of branching per pathway plus balancing. Keep scope to one pathway at a time.

## 6. Risks

- **Accuracy.** People will read this as advice. Program rules, fees, cutoffs and the Startup Visa program's status change; none is verified in this build. Keep numbers in config with dates and keep the disclaimer.
- **Fraud framing.** Fake documents, inflated job postings and fabricated home ties are instant fails with real consequences, never "clever". The LMIA "niche requirement" tactic in the original notes is not a reliable loophole; the Kovacs scenario should keep it as a gamble that can backfire.
- **Play Store.** Target API level and payment policy both need checking against the current Play Console before release.
- **Translation quality.** Pidgin was written without native review; treat it as a draft.

## 7. Open questions for you

1. Which pathway is the first full one: Express Entry (pure logic, easy to test) or Study Permit (reuses funding minigames)?
2. Do you want me to research the current CRS grid and draw history so step 6 starts from verified numbers?
3. Is there a Pidgin speaker who can review the translations?
