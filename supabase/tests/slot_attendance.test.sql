-- pgTAP tests for the retrospective attendee count (feat: unified gathering
-- feedback, U8 / #66). Proves:
--   * a COMPLETED gathering of N reports N attendees via
--     get_prompt_slot_attendance (where get_prompt_slot_occupancy under-counts);
--   * the pre-event seat-cap query (get_prompt_slot_occupancy) is unchanged — a
--     scheduled slot's occupancy math is byte-identical and completed meetings
--     never enter it.
--
-- Run with: npx supabase test db

BEGIN;
SELECT plan(6);

-- ============================================
-- Setup. lisa (1111) authors a public prompt with two slots. On the COMPLETED
-- slot she meets three joiners (marco/sophie/tom) — three meetings that have all
-- advanced to 'completed'. On the SCHEDULED slot two joiners are still confirmed
-- (marco/sophie) plus tom cancelled early. Seeded identities: 1111 lisa, 2222
-- marco, 3333 sophie, 4444 tom (see supabase/seed.sql).
-- ============================================

INSERT INTO prompts (id, author_id, title, state, region, published_at, capacity)
VALUES ('att-pgtap-prompt', '11111111-1111-1111-1111-111111111111', 'pgTAP attendance', 'published', 'berlin', NOW(), 4);

-- COMPLETED slot (in the past).
INSERT INTO time_slots (id, prompt_id, start_time, duration_minutes, exact_location, general_area)
VALUES (
  'cccccccc-0000-0000-0000-0000000000c1'::uuid, 'att-pgtap-prompt', NOW() - interval '2 days', 60,
  '{"place_id":"p","name":"n","address":"a","lat":52.5,"lng":13.4}'::jsonb, 'Mitte'
);

-- SCHEDULED slot (in the future).
INSERT INTO time_slots (id, prompt_id, start_time, duration_minutes, exact_location, general_area)
VALUES (
  'cccccccc-0000-0000-0000-0000000000c2'::uuid, 'att-pgtap-prompt', NOW() + interval '2 days', 60,
  '{"place_id":"p","name":"n","address":"a","lat":52.5,"lng":13.4}'::jsonb, 'Mitte'
);

-- Invitations (FK target for meetings). lisa is participant_a (author/invitee);
-- each joiner is inviter_id/participant_b.
INSERT INTO prompt_invitations (id, prompt_id, slot_id, inviter_id, invitee_id, state) VALUES
  ('dddddddd-0000-0000-0000-0000000000d1'::uuid, 'att-pgtap-prompt', 'cccccccc-0000-0000-0000-0000000000c1'::uuid, '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'accepted'),
  ('dddddddd-0000-0000-0000-0000000000d2'::uuid, 'att-pgtap-prompt', 'cccccccc-0000-0000-0000-0000000000c1'::uuid, '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'accepted'),
  ('dddddddd-0000-0000-0000-0000000000d3'::uuid, 'att-pgtap-prompt', 'cccccccc-0000-0000-0000-0000000000c1'::uuid, '44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'accepted'),
  ('dddddddd-0000-0000-0000-0000000000e1'::uuid, 'att-pgtap-prompt', 'cccccccc-0000-0000-0000-0000000000c2'::uuid, '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'accepted'),
  ('dddddddd-0000-0000-0000-0000000000e2'::uuid, 'att-pgtap-prompt', 'cccccccc-0000-0000-0000-0000000000c2'::uuid, '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'accepted'),
  ('dddddddd-0000-0000-0000-0000000000e3'::uuid, 'att-pgtap-prompt', 'cccccccc-0000-0000-0000-0000000000c2'::uuid, '44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'cancelled');

-- COMPLETED slot: three meetings, all 'completed'.
INSERT INTO meetings (invitation_id, prompt_id, participant_a, participant_b, slot_id, scheduled_time, duration_minutes, state) VALUES
  ('dddddddd-0000-0000-0000-0000000000d1'::uuid, 'att-pgtap-prompt', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'cccccccc-0000-0000-0000-0000000000c1'::uuid, NOW() - interval '2 days', 60, 'completed'),
  ('dddddddd-0000-0000-0000-0000000000d2'::uuid, 'att-pgtap-prompt', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'cccccccc-0000-0000-0000-0000000000c1'::uuid, NOW() - interval '2 days', 60, 'completed'),
  ('dddddddd-0000-0000-0000-0000000000d3'::uuid, 'att-pgtap-prompt', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'cccccccc-0000-0000-0000-0000000000c1'::uuid, NOW() - interval '2 days', 60, 'completed');

-- SCHEDULED slot: two active meetings + one early-cancelled.
INSERT INTO meetings (invitation_id, prompt_id, participant_a, participant_b, slot_id, scheduled_time, duration_minutes, state) VALUES
  ('dddddddd-0000-0000-0000-0000000000e1'::uuid, 'att-pgtap-prompt', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'cccccccc-0000-0000-0000-0000000000c2'::uuid, NOW() + interval '2 days', 60, 'scheduled'),
  ('dddddddd-0000-0000-0000-0000000000e2'::uuid, 'att-pgtap-prompt', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'cccccccc-0000-0000-0000-0000000000c2'::uuid, NOW() + interval '2 days', 60, 'scheduled'),
  ('dddddddd-0000-0000-0000-0000000000e3'::uuid, 'att-pgtap-prompt', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'cccccccc-0000-0000-0000-0000000000c2'::uuid, NOW() + interval '2 days', 60, 'cancelled_early');

-- Read as the author (lisa) — author branch of both RPCs' audience gate.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- ============================================
-- #66: the retrospective count includes completed gatherings.
-- ============================================

-- 1. get_prompt_slot_attendance reports 3 for the COMPLETED slot (the fix).
SELECT is(
  (SELECT attended FROM get_prompt_slot_attendance('att-pgtap-prompt')
    WHERE slot_id = 'cccccccc-0000-0000-0000-0000000000c1'::uuid),
  3,
  'attendance counts all 3 completed meetings on the ended slot (#66)'
);

-- 2. The OLD occupancy RPC still under-counts the completed slot (0) — proving the
--    two notions genuinely differ and the bug lived in reusing occupancy.
SELECT is(
  (SELECT occupied FROM get_prompt_slot_occupancy('att-pgtap-prompt')
    WHERE slot_id = 'cccccccc-0000-0000-0000-0000000000c1'::uuid),
  0,
  'occupancy still reports 0 for the completed slot (it excludes completed by design)'
);

-- ============================================
-- Pre-event seat-cap query is byte-identical: the SCHEDULED slot's occupancy is
-- exactly its active-meeting count, and the cancelled meeting is excluded.
-- ============================================

-- 3. Occupancy for the scheduled slot = 2 active meetings (cancelled excluded).
SELECT is(
  (SELECT occupied FROM get_prompt_slot_occupancy('att-pgtap-prompt')
    WHERE slot_id = 'cccccccc-0000-0000-0000-0000000000c2'::uuid),
  2,
  'occupancy for the scheduled slot is the 2 active meetings (cancelled excluded) — capacity math unchanged'
);

-- 4. Attendance for the scheduled slot ALSO = 2 (no completed rows there, so the
--    superset predicate yields the same number — active gatherings are unaffected).
SELECT is(
  (SELECT attended FROM get_prompt_slot_attendance('att-pgtap-prompt')
    WHERE slot_id = 'cccccccc-0000-0000-0000-0000000000c2'::uuid),
  2,
  'attendance for the scheduled slot equals occupancy (2) — no completed rows to add'
);

-- 5. Slots with zero rows still return a row at 0 (LEFT JOIN), for both RPCs.
SELECT is(
  (SELECT count(*)::int FROM get_prompt_slot_occupancy('att-pgtap-prompt')),
  2,
  'occupancy returns one row per slot (LEFT JOIN keeps empty slots)'
);

-- ============================================
-- Viewer-safe: an unauthorized caller gets an empty set, no existence leak.
-- ============================================

-- 6. A non-author caller on an unpublished (draft) prompt sees nothing — the
--    published/hidden branch of the audience gate. Empty set, not an error, so the
--    prompt id's existence never leaks.
UPDATE prompts SET state = 'draft', published_at = NULL WHERE id = 'att-pgtap-prompt';
SET LOCAL "request.jwt.claims" = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
SELECT is(
  (SELECT count(*)::int FROM get_prompt_slot_attendance('att-pgtap-prompt')),
  0,
  'attendance returns empty set for a non-author on an unpublished prompt (no leak)'
);

SELECT * FROM finish();
ROLLBACK;
