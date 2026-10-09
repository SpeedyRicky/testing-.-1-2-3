-- Reference schema (PostgreSQL). Corrects part 1: unique references, CHECK
-- constraints, and single-statement state changes so concurrent requests
-- cannot double-credit a purchase.

CREATE TABLE players (
    player_id   VARCHAR(40) PRIMARY KEY,
    archetype   VARCHAR(30),                -- Tech_Bro, Nurse, Student, Trades ...
    pathway     VARCHAR(30),                -- Express_Entry, Study_Permit, SUV, LMIA ...
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE game_transactions (
    reference_id   VARCHAR(100) PRIMARY KEY,           -- unique: a replayed reference cannot create a second row
    player_id      VARCHAR(40) NOT NULL REFERENCES players(player_id),
    item_sku       VARCHAR(50) NOT NULL,
    amount_kobo    INT NOT NULL CHECK (amount_kobo > 0),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (payment_status IN ('pending', 'successful', 'synchronized', 'failed')),
    processed_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_player_status ON game_transactions (player_id, payment_status);

-- Webhook: pending -> successful, once, and only for the amount we asked for.
--   UPDATE game_transactions
--      SET payment_status = 'successful', processed_at = now()
--    WHERE reference_id = $1 AND payment_status = 'pending' AND amount_kobo = $2;
--   (rowCount = 0 means replay, unknown reference, or wrong amount.)
--
-- Claim: successful -> synchronized, atomically, returning what was claimed.
--   UPDATE game_transactions
--      SET payment_status = 'synchronized'
--    WHERE player_id = $1 AND payment_status = 'successful'
--    RETURNING item_sku;
--   (Part 1 did SELECT then UPDATE inside a transaction; under READ COMMITTED two
--    concurrent claims could both read the same rows and credit twice.)

-- Anonymous, whitelisted analytics. No free text, no personal data.
CREATE TABLE analytics_events (
    event_id    BIGSERIAL PRIMARY KEY,
    player_id   VARCHAR(40) NOT NULL,
    phase       SMALLINT,
    node        VARCHAR(100),
    action      VARCHAR(100),                -- e.g. failed_ielts, paid_agent_scam
    stress      SMALLINT CHECK (stress BETWEEN 0 AND 100),
    strain      SMALLINT CHECK (strain BETWEEN 0 AND 100),
    logged_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_action ON analytics_events (action);
CREATE INDEX idx_events_player ON analytics_events (player_id, logged_at);
