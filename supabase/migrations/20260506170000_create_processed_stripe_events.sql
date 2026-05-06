-- Stripe webhook idempotency table.
--
-- Every webhook event Stripe delivers carries an event.id that uniquely
-- identifies the delivery. When a delivery succeeds end-to-end (signature
-- verified, synchronous handler work completed, side effects fired), the
-- handler INSERTs the event.id here. Subsequent deliveries of the same
-- event.id (Stripe retries on 5xx, network blips) short-circuit on the
-- read and return 200 without re-processing.
--
-- Why service-role-only:
--
-- If `authenticated` or `anon` could INSERT, an attacker could pre-seed
-- arbitrary event IDs to silently make the next legitimate webhook with
-- that ID look like a duplicate, dropping the dyad-side state update on
-- the floor. The webhook would still return 200 to Stripe, hiding the
-- attack from operator dashboards. RLS-enabled with all grants revoked
-- from `authenticated` and `anon`; only `service_role` may SELECT or
-- INSERT. See plan 003 R4 for the full threat model.
--
-- Why no UPDATE / DELETE grant: append-only by design. The event id
-- arriving twice is the load-bearing invariant; we never want to allow
-- re-processing a previously-recorded event.

CREATE TABLE IF NOT EXISTS processed_stripe_events (
  stripe_event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE processed_stripe_events ENABLE ROW LEVEL SECURITY;

-- Defence in depth: revoke ALL from authenticated and anon, then grant
-- only what service_role needs. RLS is the second layer; explicit grants
-- are the first.
REVOKE ALL ON processed_stripe_events FROM authenticated;
REVOKE ALL ON processed_stripe_events FROM anon;

GRANT SELECT, INSERT ON processed_stripe_events TO service_role;
