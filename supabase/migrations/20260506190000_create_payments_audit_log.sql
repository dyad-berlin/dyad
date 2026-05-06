-- Append-only audit log of every Stripe transaction dyad processes.
--
-- Schema is deliberately minimal — opaque tokens, the kind that distinguishes
-- which feature surface generated the payment, the amount in cents, and the
-- timestamp. NO email, name, address, card data, wallet identity, payer
-- identifier of any kind. See plan 003 R11 (payment opacity contract).
--
-- ON DELETE SET NULL on user_id is intentional: when an identity is deleted,
-- the audit log row survives with an anonymized user_id link. The financial
-- record (kind, amount, timestamp) survives for accounting integrity, while
-- a deleted user becomes structurally indistinguishable in the audit log,
-- which aligns with the opacity contract.
--
-- Service-role-only access. RLS enabled with all grants revoked from
-- authenticated and anon. Member-facing surfaces that need a "your
-- contributions" view will read through a SECURITY DEFINER function that
-- scopes by user_id; this table itself stays operator-only.

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES identities(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_kind_created_at ON payments(kind, created_at DESC);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON payments FROM authenticated;
REVOKE ALL ON payments FROM anon;

GRANT SELECT, INSERT ON payments TO service_role;
