-- Read-path RPC: the co-participant roster of a gathering (feat: unified
-- gathering feedback, U6).
--
-- WHY THIS EXISTS. The post-gathering feedback form (/feedback/gathering/[id])
-- centres on "the people you were due to meet" — the OTHER participants of the
-- gathering. But participation's RLS is own-row-only (U1:
-- member_id = app.current_user_id()), so an authenticated caller cannot read a
-- co-participant's row directly. This SECURITY DEFINER function is the sanctioned
-- read path: it returns the roster (minus the caller) for a gathering the CALLER
-- participates in, and NOTHING for a non-participant — no error, no existence
-- leak. Mirrors the get_my_prompt_slots guard pattern (20260506220000):
-- caller-authorisation check first, empty set on failure.
--
-- Display name is resolved here the same way the steward surface resolves it
-- (U7 resolveDisplayName): profiles.username for Supabase-substrate members;
-- fall back to the identities substrate handle (substrate:substrate_id) for
-- provider identities (e.g. atproto) that have no profiles row, then the bare id
-- so a name is always present. No exact_location or other sensitive slot data is
-- exposed — only member id, name, host flag, and turnout.
--
-- KTD8 — keyed on app.current_user_id() (the vendor-neutrality wrapper), never
-- auth.uid() directly.
--
-- Origin: docs/plans/2026-07-15-001-feat-unified-gathering-feedback-plan.md (U6).

CREATE OR REPLACE FUNCTION get_gathering_roster(p_gathering UUID)
RETURNS TABLE (
  member_id UUID,
  display_name TEXT,
  is_host BOOLEAN,
  turned_up BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := app.current_user_id();
BEGIN
  -- Guard: the caller must be a participant of this gathering. Empty set (not an
  -- error) for a non-participant or an unauthenticated caller — no existence leak.
  IF v_caller IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM participation pp
    WHERE pp.gathering_id = p_gathering
      AND pp.member_id = v_caller
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    pa.member_id,
    COALESCE(
      NULLIF(pr.username, ''),
      i.substrate || ':' || i.substrate_id,
      pa.member_id::text
    ) AS display_name,
    pa.is_host,
    pa.turned_up
  FROM participation pa
  LEFT JOIN profiles pr ON pr.id = pa.member_id
  LEFT JOIN identities i ON i.id = pa.member_id
  WHERE pa.gathering_id = p_gathering
    AND pa.member_id <> v_caller
  -- Host first, then by resolved name (ordinals avoid OUT-param/column ambiguity).
  ORDER BY 3 DESC, 2;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_gathering_roster(UUID) FROM public;
GRANT EXECUTE ON FUNCTION get_gathering_roster(UUID) TO authenticated;

COMMENT ON FUNCTION get_gathering_roster(UUID) IS
  'Returns the co-participant roster (member_id, resolved display_name, is_host, turned_up) of a gathering, EXCLUDING the caller. Empty set for a non-participant (guarded; no existence leak). The sanctioned read path for the post-gathering feedback form, which cannot read co-participant participation rows under U1 own-row RLS. Mirrors get_my_prompt_slots.';
