-- pgTAP tests for the derived-occurrence functions (feat: unified gathering
-- feedback, U1). app.gathering_happened / app.both_present live in the `app`
-- schema (not PostgREST-exposed), so they are tested in-DB here; RLS is tested
-- from real Supabase clients in tests/integration/gatherings-rls.test.ts.
--
-- Run with: npx supabase test db

BEGIN;
SELECT plan(9);

-- ============================================
-- Setup: one prompt + slot + gathering, four seeded identities as participants.
-- lisa/marco/sophie/tom are seeded (see supabase/seed.sql); their identities
-- rows exist (identities.id = auth.users.id).
-- ============================================

INSERT INTO prompts (id, author_id, title, state, region, published_at)
VALUES ('gath-pgtap-prompt', '11111111-1111-1111-1111-111111111111', 'pgTAP gathering', 'published', 'berlin', NOW());

INSERT INTO time_slots (id, prompt_id, start_time, duration_minutes, exact_location, general_area)
VALUES (
  'aaaaaaaa-0000-0000-0000-0000000000f1', 'gath-pgtap-prompt', NOW() + interval '1 day', 60,
  '{"place_id":"p","name":"n","address":"a","lat":52.5,"lng":13.4}'::jsonb, 'Mitte'
);

INSERT INTO gatherings (id, slot_id, prompt_id, host_id)
VALUES (
  'bbbbbbbb-0000-0000-0000-0000000000f1',
  'aaaaaaaa-0000-0000-0000-0000000000f1',
  'gath-pgtap-prompt',
  '11111111-1111-1111-1111-111111111111'
);

-- Four participants, all NOT turned up yet.
INSERT INTO participation (gathering_id, member_id, is_host, turned_up) VALUES
  ('bbbbbbbb-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', true,  false),
  ('bbbbbbbb-0000-0000-0000-0000000000f1', '22222222-2222-2222-2222-222222222222', false, false),
  ('bbbbbbbb-0000-0000-0000-0000000000f1', '33333333-3333-3333-3333-333333333333', false, false),
  ('bbbbbbbb-0000-0000-0000-0000000000f1', '44444444-4444-4444-4444-444444444444', false, false);

-- ============================================
-- gathering_happened across the turnout range
-- ============================================

-- 1. Zero turned up -> false.
SELECT is(
  app.gathering_happened('bbbbbbbb-0000-0000-0000-0000000000f1'),
  false,
  'gathering_happened is false when nobody turned up'
);

-- 2. One turned up -> false (a lone arrival is not a gathering).
UPDATE participation SET turned_up = true
  WHERE gathering_id = 'bbbbbbbb-0000-0000-0000-0000000000f1'
    AND member_id = '11111111-1111-1111-1111-111111111111';
SELECT is(
  app.gathering_happened('bbbbbbbb-0000-0000-0000-0000000000f1'),
  false,
  'gathering_happened is false when only one turned up'
);

-- 3. Exactly two turned up -> true (the n=2 / 1-on-1 case).
UPDATE participation SET turned_up = true
  WHERE gathering_id = 'bbbbbbbb-0000-0000-0000-0000000000f1'
    AND member_id = '22222222-2222-2222-2222-222222222222';
SELECT is(
  app.gathering_happened('bbbbbbbb-0000-0000-0000-0000000000f1'),
  true,
  'gathering_happened is true at exactly two turned up'
);

-- 4. N > 2 turned up -> true.
UPDATE participation SET turned_up = true
  WHERE gathering_id = 'bbbbbbbb-0000-0000-0000-0000000000f1'
    AND member_id IN ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444');
SELECT is(
  app.gathering_happened('bbbbbbbb-0000-0000-0000-0000000000f1'),
  true,
  'gathering_happened is true when all four turned up'
);

-- ============================================
-- Dwindle-to-pair (AE3 / #56): 4 participants, only 2 turned up -> still true.
-- ============================================

UPDATE participation SET turned_up = false
  WHERE gathering_id = 'bbbbbbbb-0000-0000-0000-0000000000f1'
    AND member_id IN ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444');
SELECT is(
  app.gathering_happened('bbbbbbbb-0000-0000-0000-0000000000f1'),
  true,
  'a 4-participant gathering with 2 turned up still counts as happened (dwindle-to-pair)'
);

-- ============================================
-- both_present
-- ============================================

-- 5. Both present (lisa + marco turned up) -> true.
SELECT is(
  app.both_present(
    'bbbbbbbb-0000-0000-0000-0000000000f1',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
  ),
  true,
  'both_present is true for two co-present participants'
);

-- 6. One absent (tom did not turn up) -> false.
SELECT is(
  app.both_present(
    'bbbbbbbb-0000-0000-0000-0000000000f1',
    '11111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444444'
  ),
  false,
  'both_present is false when one of the pair did not turn up'
);

-- 7. A non-participant id -> false.
SELECT is(
  app.both_present(
    'bbbbbbbb-0000-0000-0000-0000000000f1',
    '11111111-1111-1111-1111-111111111111',
    '55555555-5555-5555-5555-555555555555'
  ),
  false,
  'both_present is false when one id is not a participant'
);

-- 8. slot_id uniqueness rejects a second gathering for the same slot.
SELECT throws_ok(
  $$ INSERT INTO gatherings (slot_id, prompt_id, host_id)
     VALUES ('aaaaaaaa-0000-0000-0000-0000000000f1', 'gath-pgtap-prompt', '11111111-1111-1111-1111-111111111111') $$,
  '23505',
  NULL,
  'a second gathering for the same slot is rejected by the UNIQUE constraint'
);

SELECT * FROM finish();
ROLLBACK;
