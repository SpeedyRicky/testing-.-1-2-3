'use strict';
const { createApp } = require('./app');
const { MemoryStore } = require('./memory_store');

// Paystack's initialize endpoint (part 1 used https://paystack.co, which is wrong).
const paystack = {
  async initialize(payload) {
    const r = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await r.json();
    if (!r.ok || !body.status) throw new Error(body.message || `paystack ${r.status}`);
    return body.data.authorization_url;
  },
};

// Example only: every number here must be verified against IRCC and given a verified_on date.
const remoteConfig = { version: 1, verified_on: null, ngn_per_cad: 1400, draws: { min_cutoff: 450, max_cutoff: 540 } };

const app = createApp({ store: new MemoryStore(), paystack, secret: process.env.PAYSTACK_SECRET_KEY, remoteConfig });
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`japa backend reference listening on ${port}`));
