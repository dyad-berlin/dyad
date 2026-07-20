-- Public-profile trust stat: how many conversations a member has completed.
--
-- meetings RLS is participants-only, so a visitor's client can't count another
-- member's completed meetings directly. A DEFINER function exposes exactly one
-- aggregate — the count of state='completed' meetings — and nothing else about
-- those meetings (no ids, no times, no counterparts).

CREATE OR REPLACE FUNCTION count_completed_meetings(p_profile_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM meetings
  WHERE state = 'completed'
    AND (participant_a = p_profile_id OR participant_b = p_profile_id);
$$;

REVOKE EXECUTE ON FUNCTION count_completed_meetings(UUID) FROM public;
GRANT EXECUTE ON FUNCTION count_completed_meetings(UUID) TO authenticated;
