-- Join requests from provider identities (the waitlist for substrates like
-- atproto, where no email exists to invite). A row is created only after the
-- person has proven control of the identity through the substrate's own auth
-- flow AND explicitly asked to join: the ask is the consent to store the
-- (public) handle and the opaque substrate id. No identities row exists until
-- an operator approves.
--
-- Service-role only: written by the app's waitlist endpoint, read and decided
-- from the admin plane. RLS is enabled with no policies, so anon/authenticated
-- reach nothing.

CREATE TABLE IF NOT EXISTS join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  substrate text NOT NULL,
  substrate_id text NOT NULL,
  handle text,
  scope text NOT NULL REFERENCES scopes(scope),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  approved boolean,
  UNIQUE (substrate, substrate_id, scope)
);

ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON join_requests FROM anon, authenticated;
