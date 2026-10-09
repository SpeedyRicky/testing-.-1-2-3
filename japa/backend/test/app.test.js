'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { createApp } = require('../src/app');
const { MemoryStore } = require('../src/memory_store');

const SECRET = 'sk_test_unit_secret';
const sign = (raw) => crypto.createHmac('sha512', SECRET).update(raw).digest('hex');

async function boot() {
  const store = new MemoryStore();
  const paystack = { initialize: async () => 'https://checkout.example/abc' };
  const app = createApp({ store, paystack, secret: SECRET, remoteConfig: { version: 1 } });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, headers = {}) => fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { store, server, base, post };
}

async function purchase(ctx, playerId = 'NG-991A') {
  const r = await (await ctx.post('/api/payment/initialize', { playerId, itemSKU: 'undo_bad_luck_card' })).json();
  return r.reference;
}

test('webhook: bad or missing signature is rejected, state unchanged', async () => {
  const ctx = await boot();
  const reference = await purchase(ctx);
  const raw = JSON.stringify({ event: 'charge.success', data: { reference, amount: 10000 } });
  assert.strictEqual((await ctx.post('/api/payment/webhook', raw)).status, 401);
  assert.strictEqual((await ctx.post('/api/payment/webhook', raw, { 'x-paystack-signature': 'ab'.repeat(64) })).status, 401);
  assert.strictEqual(ctx.store.transactions.get(reference).status, 'pending');
  ctx.server.close();
});

test('webhook: valid signature marks paid once; replays are harmless', async () => {
  const ctx = await boot();
  const reference = await purchase(ctx);
  // Odd spacing on purpose: re-serialising parsed JSON would change these bytes and break the HMAC.
  const raw = `{ "event":"charge.success",  "data":{"reference":"${reference}","amount":10000} }`;
  const h = { 'x-paystack-signature': sign(raw) };
  assert.strictEqual((await ctx.post('/api/payment/webhook', raw, h)).status, 200);
  assert.strictEqual((await ctx.post('/api/payment/webhook', raw, h)).status, 200);
  assert.strictEqual(ctx.store.transactions.get(reference).status, 'successful');
  ctx.server.close();
});

test('webhook: amount mismatch does not credit', async () => {
  const ctx = await boot();
  const reference = await purchase(ctx);
  const raw = JSON.stringify({ event: 'charge.success', data: { reference, amount: 100 } });
  await ctx.post('/api/payment/webhook', raw, { 'x-paystack-signature': sign(raw) });
  assert.strictEqual(ctx.store.transactions.get(reference).status, 'pending');
  ctx.server.close();
});

test('sync: a paid card is handed out exactly once', async () => {
  const ctx = await boot();
  const reference = await purchase(ctx);
  const raw = JSON.stringify({ event: 'charge.success', data: { reference, amount: 10000 } });
  await ctx.post('/api/payment/webhook', raw, { 'x-paystack-signature': sign(raw) });
  const first = await (await ctx.post('/api/player/sync_tokens', { playerId: 'NG-991A' })).json();
  const second = await (await ctx.post('/api/player/sync_tokens', { playerId: 'NG-991A' })).json();
  assert.strictEqual(first.unlocked_sachet_cards, 1);
  assert.strictEqual(second.unlocked_sachet_cards, 0);
  ctx.server.close();
});

test('initialize: unknown SKU and bad player id are rejected; client cannot set a price', async () => {
  const ctx = await boot();
  assert.strictEqual((await ctx.post('/api/payment/initialize', { playerId: 'NG-991A', itemSKU: 'free_money' })).status, 400);
  assert.strictEqual((await ctx.post('/api/payment/initialize', { playerId: "x'; DROP", itemSKU: 'undo_bad_luck_card' })).status, 400);
  const r = await (await ctx.post('/api/payment/initialize', { playerId: 'NG-991A', itemSKU: 'undo_bad_luck_card', amount: 1 })).json();
  assert.strictEqual(ctx.store.transactions.get(r.reference).amountKobo, 10000);
  ctx.server.close();
});

test('analytics: whitelists fields and caps batch size', async () => {
  const ctx = await boot();
  const ok = await ctx.post('/api/analytics', { playerId: 'NG-991A', events: [{ phase: 1, node: 'encounter_agent_01', action: 'paid_agent_scam', stress: 35, secret: 'leak' }] });
  assert.strictEqual((await ok.json()).accepted, 1);
  assert.ok(!('secret' in ctx.store.analytics[0]));
  const big = await ctx.post('/api/analytics', { playerId: 'NG-991A', events: Array(101).fill({ phase: 1 }) });
  assert.strictEqual(big.status, 400);
  ctx.server.close();
});
