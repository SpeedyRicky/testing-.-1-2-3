'use strict';
// In-memory implementation of the Store interface, for local dev and tests.
// A Postgres implementation should run the equivalent single-statement queries
// documented in schema.sql so each state change is atomic.

class MemoryStore {
  constructor() {
    this.transactions = new Map(); // reference -> {playerId, itemSku, amountKobo, status}
    this.analytics = [];
  }

  async createPending({ reference, playerId, itemSku, amountKobo }) {
    if (this.transactions.has(reference)) throw new Error('duplicate reference');
    this.transactions.set(reference, { playerId, itemSku, amountKobo, status: 'pending' });
  }

  // Idempotent: returns true only on the single pending -> successful transition,
  // and only if the amount Paystack reports equals the amount we asked for.
  async markSuccessful(reference, amountKobo) {
    const t = this.transactions.get(reference);
    if (!t || t.status !== 'pending' || t.amountKobo !== amountKobo) return false;
    t.status = 'successful';
    return true;
  }

  // Atomic claim: every successful purchase is handed out exactly once.
  async claimPurchases(playerId) {
    const claimed = [];
    for (const t of this.transactions.values()) {
      if (t.playerId === playerId && t.status === 'successful') {
        t.status = 'synchronized';
        claimed.push(t.itemSku);
      }
    }
    return claimed;
  }

  async addAnalytics(events) {
    this.analytics.push(...events);
  }
}

module.exports = { MemoryStore };
