-- Relock exact_location against anonymous reads.
--
-- Background: the baseline sets ALTER DEFAULT PRIVILEGES so every table
-- created by postgres is born with GRANT ALL to anon and authenticated.
-- 20260329_fix_time_slots_exact_location_access revoked authenticated's
-- table-level SELECT and re-granted safe columns — that fix held. But
-- 20260402_anon_published_prompts only ADDED a column grant for anon,
-- assuming anon started from zero; anon had already inherited full-table
-- SELECT (and every write privilege) from the default privileges at table
-- creation, so the column mask never applied to it. Net effect in prod:
-- anyone with the public anon key could SELECT exact_location for every
-- published conversation's slots, bypassing the "location revealed only
-- after acceptance" contract. RLS was never the gap — it correctly limited
-- anon to published prompts' rows; the leak was purely the column grant.
--
-- Fix: drop everything anon holds on the table, then grant exactly the
-- safe column set (the same list authenticated has, incl. retired_at from
-- 20260604). Also strip the write/DDL noise both roles inherited on the
-- time_slots_public view — it is a read surface.
--
-- Regression guard: tests/integration/exact-location-grants.test.ts fails
-- if this column ever becomes selectable again (default privileges will
-- re-open any RECREATED table, so the test — not this migration — is the
-- durable guard).

REVOKE ALL ON time_slots FROM anon;
GRANT SELECT (id, prompt_id, start_time, duration_minutes, general_area, general_area_lat, general_area_lng, accepted, created_at, retired_at)
  ON time_slots TO anon;

-- The view is SELECT-only for both roles; the write privileges are inherited
-- noise from the default privileges (harmless today via security_invoker +
-- base-table RLS, but no reason to keep them).
REVOKE ALL ON time_slots_public FROM anon, authenticated;
GRANT SELECT ON time_slots_public TO anon, authenticated;
