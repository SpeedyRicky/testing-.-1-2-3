# Japa: The Great Escape (web edition)

A browser version of three Japa scenarios, built to be shared as a link.
Vite + React + TypeScript + Tailwind. No backend, no tracking, nothing stored.

| Mode | What it is |
|---|---|
| **The Startup Visa Pitch Route** | A Zoom-style 2x2 call with Ms. Vance, Mr. Chen and Mr. Ross. Answers move Investor Interest, Technical Credibility and Scalability Score; the Letter of Support resolution screen shows each criterion against its threshold. |
| **The 180-Day Tourist Gamble** | A dashboard: tourist time remaining, energy, desperation, wallet in CAD with the NGN equivalent, location. Daily actions cost time, energy and money and pop a toast. Three employer leads win the round and carry you (and your desperation) into the LMIA interview. |
| **The Hidden LMIA Interview** | The Mr. Kovacs dialogue tree in a boardroom theme. |

## Run
```
npm install
npm run dev        # http://localhost:5173
npm test           # engine tests (vitest)
npm run build      # type-check + production build into dist/
```

## Deploy to Vercel
1. Push the repo to GitHub (already done if you are reading this there).
2. vercel.com → **Add New… → Project** → import the repo.
3. Set **Root Directory** to `japa-web`. Vercel detects Vite; `vercel.json` sets the build command and `dist` output.
4. Deploy. Every push to the branch gets a preview URL.

## How it is built
- `src/engine/machine.ts`: the state machine. One reducer, three modes (`pitch | tourist | lmia`), each keeping its
  own progress when you switch. Events are plain objects (`SWITCH_MODE`, `PITCH_CHOOSE`, `TOURIST_ACTION`, ...).
- `src/engine/dialogue.ts`: a TypeScript port of the Godot dialogue runner (`japa/scripts/global/narrative.gd`):
  mutations, conditions, `auto_branch`, terminal outcomes.
- `src/engine/pitch.ts`: `resolveLetterOfSupport()` reads the thresholds from the `suv_resolve` node, so the web
  and Godot games always agree on who gets the Letter (Investor Interest ≥ 70 and Technical Credibility ≥ 65;
  Scalability is tracked but not scored, as in the Godot game).
- `src/engine/tourist.ts`: the tourist simulation. Pure; randomness is passed in as `rolls`, so it is testable.
- Randomness, rates and costs are illustrative game values.

## Content is shared with the Godot game
The pitch and Kovacs dialogue come from `src/content/japa_nodes.json`, a copy of `../japa/data/japa_nodes.json`.
Edit the Godot file, then run `npm run sync-content`.

## Disclaimer
A simulation for entertainment, not legal or immigration advice. Working without authorization on visitor status is
an instant fail in the game because it can lead to removal in real life. Check IRCC (canada.ca) for real rules.
