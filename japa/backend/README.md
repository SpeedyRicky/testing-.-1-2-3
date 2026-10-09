# Backend reference (deferred to M2+)

The game client has **no network code** today and is fully playable offline.
This folder is a tested reference for the three things a backend is for:

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /api/config` | Remote config: CRS tables, draw ranges, exchange-rate range, each with a `verified_on` date | Reference |
| `POST /api/analytics` | Anonymous, whitelisted, batched run events for balancing | Reference |
| `POST /api/payment/initialize`, `/webhook`, `/api/player/sync_tokens` | Paystack checkout, signed webhook, one-time claim | Reference, **do not wire into the client yet** |

```
npm install
npm test        # 6 tests: signature, replay, amount mismatch, one-time claim, price, analytics
PAYSTACK_SECRET_KEY=sk_test_... npm start
```

## Read this before building the payment path

**Google Play policy.** Part 1 proposed hosting a "free, ad-free" game with no purchase button, then telling players
inside the game to go to a website and buy items for use in the game. For digital items consumed in an app,
Google Play's Payments policy generally requires Play Billing and restricts steering users to other payment methods,
outside of specific programs (alternative or user-choice billing, external offers) that vary by region and change.
An in-app "visit the website to buy" prompt is the kind of thing that gets an app removed.
Check the current Play Console policy and which programs cover Nigeria before building any client side of this.
Options that are clearly safe: a one-time paid unlock via Play Billing, a paid price for the whole game, or no monetization.

**Design.** An "Undo Bad Luck" card that reverses a failure is pay-to-win in a game about people under financial
pressure. Cosmetic items, a paid pathway pack, or a one-time unlock fit better.

## What changed from part 1

- Paystack endpoint is `https://api.paystack.co/transaction/initialize` (part 1 used `https://paystack.co`).
- Webhook signature is verified over the **raw request bytes** with a constant-time compare. Part 1 re-serialised
  `req.body`, which changes the bytes and makes valid webhooks fail (or, worse, tempts people to loosen the check).
- State changes are single-statement and idempotent (see `schema.sql`); amounts are checked; the server owns prices.
- Analytics accepts a whitelist of numeric/short fields only.

## Still missing on purpose

- `playerId` is not a credential. Before any real claim path, issue a per-install secret at registration and require it.
- A Postgres `Store` implementation (the in-memory store documents the interface; `schema.sql` has the queries).
- Rate limiting, request logging without secrets, and Paystack IP allow-listing if your host supports it.
- Never commit `PAYSTACK_SECRET_KEY`; part 1 had a fallback test key in source.
