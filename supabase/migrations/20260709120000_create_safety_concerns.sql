-- safety_concerns: the unified, confidential safeguarding record. Any participant
-- of a gathering (1-on-1 or group) can file a concern about a co-participant.
-- Confidentiality is enforced here, not just in the UI:
--   * INSERT is constrained so the actor is the reporter AND both reporter and
--     reported actually shared the slot (co-participants), and no self-reports.
--   * There is NO SELECT/UPDATE/DELETE policy for authenticated users, so with RLS
--     on, users can read nothing. Only the service-role admin plane (which bypasses
--     RLS) can read — that is the steward-only guarantee (see src/lib/server/
--     supabase-admin.ts, admin-auth.ts). The reported person can never see rows.
-- Headcount-independent by construction: it keys off slot participation, not the
-- 1-on-1-vs-group path, so a group that dwindles to a pair keeps the same guarantee.
-- Origin: docs/brainstorms/2026-07-08-group-feedback-requirements.md (R1-R3, R6).

CREATE TABLE safety_concerns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES time_slots(id),
  meeting_id UUID REFERENCES meetings(id),  -- optional finer context
  reporter_id UUID NOT NULL REFERENCES identities(id),
  reported_id UUID NOT NULL REFERENCES identities(id),
  kind TEXT NOT NULL CHECK (kind IN ('no_show', 'felt_unsafe', 'other')),
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_report CHECK (reporter_id != reported_id),
  CONSTRAINT detail_length CHECK (detail IS NULL OR char_length(detail) <= 2000)
);

-- Steward lookups: per-person history, newest first; and by gathering.
CREATE INDEX idx_safety_concerns_reported ON safety_concerns(reported_id, created_at DESC);
CREATE INDEX idx_safety_concerns_slot ON safety_concerns(slot_id);

-- Was p_actor a participant of any meeting on this slot? SECURITY DEFINER so the
-- INSERT policy can see meetings the reporter can't directly read.
CREATE OR REPLACE FUNCTION app.is_slot_participant(p_actor UUID, p_slot UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app
AS $$
  SELECT EXISTS (
    SELECT 1 FROM meetings m
    WHERE m.slot_id = p_slot
      AND p_actor IN (m.participant_a, m.participant_b)
  );
$$;

ALTER TABLE safety_concerns ENABLE ROW LEVEL SECURITY;

-- The ONLY user-facing verb: a participant files a concern about a co-participant.
-- No SELECT/UPDATE/DELETE policy exists → users can never read or change concerns.
CREATE POLICY "Participant files a concern about a co-participant"
  ON safety_concerns FOR INSERT TO authenticated
  WITH CHECK (
    app.current_user_id() = reporter_id
    AND reporter_id != reported_id
    AND app.is_slot_participant(reporter_id, slot_id)
    AND app.is_slot_participant(reported_id, slot_id)
  );

-- Insert only for authenticated (RLS governs which rows). No SELECT grant — reads
-- go through the service-role admin client, which bypasses RLS.
GRANT INSERT ON safety_concerns TO authenticated;
REVOKE SELECT, UPDATE, DELETE ON safety_concerns FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION app.is_slot_participant(UUID, UUID) TO authenticated;

COMMENT ON TABLE safety_concerns IS
  'Confidential safeguarding reports about a meeting participant. Steward-only read (service role); users may only INSERT about a co-participant. Never revealed to the reported person. See docs/brainstorms/2026-07-08-group-feedback-requirements.md.';
