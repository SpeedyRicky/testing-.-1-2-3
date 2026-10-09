'use strict';
const crypto = require('crypto');
const express = require('express');

const PRICE_KOBO = { undo_bad_luck_card: 10000 }; // N100. Server decides price, never the client.
const PLAYER_ID = /^[A-Za-z0-9-]{4,40}$/;
const ANALYTICS_FIELDS = ['phase', 'node', 'action', 'stress', 'strain'];

function verifySignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || typeof signature !== 'string') return false;
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createApp({ store, paystack, secret, remoteConfig }) {
  if (!secret) throw new Error('PAYSTACK_SECRET_KEY is required');
  const app = express();

  // The webhook must see the exact bytes Paystack signed, so it gets a raw body
  // parser BEFORE the JSON parser. Re-serialising parsed JSON breaks the HMAC.
  app.post('/api/payment/webhook', express.raw({ type: '*/*', limit: '100kb' }), async (req, res) => {
    if (!verifySignature(req.body, req.get('x-paystack-signature'), secret)) {
      return res.status(401).send('invalid signature');
    }
    let event;
    try { event = JSON.parse(req.body.toString('utf8')); } catch { return res.status(400).send('bad json'); }
    if (event.event === 'charge.success' && event.data) {
      const { reference, amount } = event.data;
      await store.markSuccessful(reference, amount); // false on replays; still 200 so Paystack stops retrying
    }
    return res.status(200).send('ok');
  });

  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // Remote config: rules that change in real life (verify dates!) without a store release.
  app.get('/api/config', (_req, res) => res.json(remoteConfig));

  // Anonymous, batched, whitelisted analytics. No free-text fields.
  app.post('/api/analytics', async (req, res) => {
    const { playerId, events } = req.body || {};
    if (!PLAYER_ID.test(String(playerId)) || !Array.isArray(events) || events.length === 0 || events.length > 100) {
      return res.status(400).json({ error: 'invalid payload' });
    }
    const clean = events.map((e) => {
      const row = { playerId, at: Date.now() };
      for (const k of ANALYTICS_FIELDS) if (e && k in e) row[k] = typeof e[k] === 'number' ? e[k] : String(e[k]).slice(0, 100);
      return row;
    });
    await store.addAnalytics(clean);
    return res.json({ accepted: clean.length });
  });

  app.post('/api/payment/initialize', async (req, res) => {
    const { playerId, itemSKU } = req.body || {};
    const amountKobo = PRICE_KOBO[itemSKU];
    if (!PLAYER_ID.test(String(playerId)) || !amountKobo) return res.status(400).json({ error: 'invalid request' });
    const reference = `japa_${itemSKU}_${crypto.randomBytes(8).toString('hex')}`;
    try {
      await store.createPending({ reference, playerId, itemSku: itemSKU, amountKobo });
      const checkoutUrl = await paystack.initialize({
        email: `${playerId.toLowerCase()}@players.example.com`, // Paystack needs a valid-looking email
        amount: amountKobo, reference, metadata: { playerId, itemSKU },
      });
      return res.json({ status: 'success', checkoutUrl, reference });
    } catch (err) {
      console.error('initialize failed:', err.message);
      return res.status(502).json({ error: 'payment provider unavailable' });
    }
  });

  // NOTE: playerId alone is not a credential. Before shipping, bind claims to a
  // per-install secret issued at registration.
  app.post('/api/player/sync_tokens', async (req, res) => {
    const { playerId } = req.body || {};
    if (!PLAYER_ID.test(String(playerId))) return res.status(400).json({ error: 'invalid request' });
    const items = await store.claimPurchases(playerId);
    return res.json({ status: 'synchronized', unlocked_sachet_cards: items.filter((s) => s === 'undo_bad_luck_card').length });
  });

  return app;
}

module.exports = { createApp, verifySignature, PRICE_KOBO };
