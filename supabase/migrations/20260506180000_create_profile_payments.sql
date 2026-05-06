-- Per-user payment state, scope-tight.
--
-- Why a separate table from `profiles`:
--
-- The existing `profiles` table has a broad `Authenticated users can read
-- profile summaries` policy that lets any authenticated user read any
-- profile row. Putting payment-related columns on `profiles` would expose
-- every member's Stripe customer ID, founding-circle status, membership
-- tier, and subscription id to every other member. `profile_payments` is
-- RLS-scoped per-user via `app.current_user_id() = user_id` so a member
-- can read their own payment state and nothing else.
--
-- Schema is intentionally extensible — plan 002 will add `is_founding`,
-- `membership_tier`, `stripe_subscription_id`, `membership_renewed_at` to
-- this same table in subsequent migrations.
--
-- Writes flow through a SECURITY DEFINER RPC so the webhook handler (using
-- the service-role client) can upsert without granting authenticated users
-- direct UPDATE access — see plan 003 R8.

CREATE TABLE IF NOT EXISTS profile_payments (
  user_id UUID PRIMARY KEY REFERENCES identities(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profile_payments_updated_at
  BEFORE UPDATE ON profile_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE profile_payments ENABLE ROW LEVEL SECURITY;

-- Member can read their own payment state.
CREATE POLICY "Member reads own payment state"
  ON profile_payments FOR SELECT TO authenticated
  USING (app.current_user_id() = user_id);

-- Service-role bypasses RLS by design; no explicit grant needed beyond what
-- the role already has. Authenticated users have NO INSERT/UPDATE/DELETE.
REVOKE INSERT, UPDATE, DELETE ON profile_payments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON profile_payments FROM anon;

-- SECURITY DEFINER upsert RPC — used by the lazy-customer helper from the
-- service role only. Returns the (possibly newly-inserted) stripe_customer_id
-- atomically. ON CONFLICT keeps the existing customer id when one is already
-- set, which guards against the race where two concurrent first-call attempts
-- both try to create a Stripe Customer (Stripe's idempotency key prevents
-- creating two customers; this guards the dyad-side write).
CREATE OR REPLACE FUNCTION app.upsert_profile_payment_customer(
  p_user_id UUID,
  p_stripe_customer_id TEXT
) RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  resolved TEXT;
BEGIN
  INSERT INTO profile_payments (user_id, stripe_customer_id)
  VALUES (p_user_id, p_stripe_customer_id)
  ON CONFLICT (user_id) DO UPDATE
    SET stripe_customer_id = COALESCE(profile_payments.stripe_customer_id, EXCLUDED.stripe_customer_id),
        updated_at = NOW()
  RETURNING stripe_customer_id INTO resolved;
  RETURN resolved;
END;
$$;

REVOKE EXECUTE ON FUNCTION app.upsert_profile_payment_customer(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.upsert_profile_payment_customer(UUID, TEXT) TO service_role;
