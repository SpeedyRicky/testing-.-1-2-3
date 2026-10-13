# Japa: launch checklist

Web first. Launch on X with a public link, measure, and build store apps only when the numbers justify it.
Tick each box before moving to the next phase.

## Phase 0 — Before the link goes public (1–2 days)

**Content and safety**
- [ ] 2–3 people you trust read the Kawosoke (asylum) and LGBTQ scenes in full. Ask one question: "Would you be
      comfortable if this were screenshotted out of context?" Fix anything that gets a no.
- [ ] One person who has actually been through each route reads its Reality checks for accuracy (Express Entry,
      study permit, visitor visa). Update anything that has changed since October 2026.
- [ ] The disclaimer is visible: footer on every page, plus the Reality check on every ending. Don't remove it.
- [ ] Decide who answers "is this legal advice?" replies on X. (Answer: no, it's a game; link canada.ca.)

**Accounts you need** (all have free tiers)
- [ ] GitHub: the code is on branch `claude/dazzling-gauss-j7em0f`. Merge it to your main branch when you're happy.
- [ ] Vercel account, connected to the GitHub repo.
- [ ] A domain (e.g. `japagame.ng` from a .ng registrar, or a .com). Optional for the soft launch.
- [ ] Analytics: Plausible (simplest) or PostHog (free tier, better funnels). See `.env.example`.

## Phase 1 — Deploy (half a day)

1. Vercel → Add New Project → import the repo → **Root Directory: `japa-web`** → Framework: Next.js.
2. Environment Variables: set `NEXT_PUBLIC_SITE_URL` and one analytics provider from `.env.example`.
3. Deploy. Open the URL on your phone.
4. Domain (optional): Vercel → Settings → Domains → add it, then update `NEXT_PUBLIC_SITE_URL` and redeploy.

**Smoke test on the live URL**
- [ ] Sign up, play one route to an ending, tap **Post on X**: the draft shows your result and the link.
- [ ] Paste the link in a WhatsApp chat or X DM to yourself: the preview card shows the title, flags and pills.
      (Or check it at opengraph.xyz.)
- [ ] Android Chrome: the **Install** chip appears; install it, open from the home screen, play.
- [ ] iPhone Safari: tap **Install** for the how-to; Share → Add to Home Screen works.
- [ ] Turn on airplane mode after one visit and reopen: it still loads.
- [ ] Analytics dashboard shows `app_open`, `signup_complete`, `run_start`, `run_end` and `share` within minutes.

## Phase 2 — Soft launch (week 1)

- [ ] Send the link to 20–50 people from your japa group chats. Ask for one sentence back: "What made you laugh,
      and where did you get bored?"
- [ ] Watch the funnel daily. Targets for a healthy soft launch:

| Metric | Event(s) | Healthy | Worry if |
|---|---|---|---|
| Sign-up rate | `signup_complete` ÷ `app_open` (new) | > 60% | < 40% (onboarding too long) |
| Start rate | `run_start` ÷ `signup_complete` | > 85% | < 70% |
| Completion | `run_end` ÷ `run_start` | > 50% | < 30% (too long or confusing) |
| Share rate | `share` ÷ `run_end` | > 8% | < 3% (endings not share-worthy) |
| Return | players with `app_open` on 2+ days | > 20% in week 1 | < 10% |

- [ ] Fix the top 3 complaints before Phase 3.

## Phase 3 — Launch on X (weeks 2–6)

- [ ] Launch post: a 20–30 second screen recording of a funny ending (Village People Interference 100%, the
      bought-story exposure, or "Japa'd to the UK"), the hook "Can you japa from Nigeria to Canada?", and the link.
- [ ] Pin it. Reply to every quote post in the first 24 hours.
- [ ] Weekly content from the game itself: "Ending of the week", "Today's daily challenge", one Reality check as
      a carousel ("5 japa myths this game kills").
- [ ] Ask 3–5 Naija creators who post about japa to play it on camera. Don't pay for the first ones; offer them a
      shout-out in the credits.
- [ ] Track every link you post with its own source: `?utm_source=x`, `?utm_source=whatsapp`,
      `?utm_source=tiktok`. Analytics records it as `source` on `app_open`.

## Phase 4 — Investor-ready (after 4–6 weeks of data)

Investors fund traction. Have these numbers ready, straight from the dashboard:
- [ ] Players (unique `app_open`), weekly growth %, and where they came from (`source`).
- [ ] Completion rate and average runs per player.
- [ ] Share rate and the best-performing post.
- [ ] Day-7 return rate, and how many play the daily challenge.
- [ ] 3–5 real player quotes (with permission).
- [ ] What's next and what it costs: original art and music, more routes (Trades, PNP Rural), native apps,
      and a revenue idea to test (sponsorship by licensed consultants/schools, or a premium route pack).

## Phase 5 — Store apps (only when the numbers say so)

Build iOS/Android when installs or players ask for it (for example, more than 500 home-screen installs, or
repeated "is there an app?" replies). The same code wraps with Capacitor. Before submitting:
- [ ] A privacy policy page and a support email (both stores require them).
- [ ] App Store/Play review notes explaining the immigration and asylum content is educational fiction with a
      disclaimer, not advice. Expect questions.
- [ ] Apple Developer Program (USD 99/year) and Google Play Console (USD 25 once).

## What's already built

- Link previews: `app/opengraph-image.tsx` and `app/twitter-image.tsx` (1200×630 card), full Open Graph and X tags
  in `app/layout.tsx`.
- Analytics: `app/launch/analytics.ts` (Plausible or PostHog, off by default, honours Do Not Track and Global
  Privacy Control, never sends names or profile data). Events: `app_open {source, returning}`,
  `signup_complete {role}`, `run_start {route, daily}`, `run_end {route, result, ending, moves, daily}`,
  `share {channel}`, `daily_start {route}`, `install_available`, `install_click`, `install_choice`, `app_installed`.
- Home-screen install: `app/manifest.ts`, icons in `public/icons/`, `public/sw.js` (offline after the first
  visit), and the **Install** chip in the header (a how-to on iPhone).
- Share links: **Post on X** and **Copy result** include the game link tagged `utm_source=x` / `copy`.
