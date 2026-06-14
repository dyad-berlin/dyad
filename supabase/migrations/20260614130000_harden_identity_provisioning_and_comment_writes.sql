-- Harden the account-less identity seam (red-team follow-up to 20260614120000).
--
-- Two findings:
--
-- 1. ensure_identity was EXECUTE-able by `anon`. The anon key is public, so
--    anyone could call this SECURITY DEFINER function directly and mint
--    arbitrary identities rows (substrate/substrate_id of their choosing) —
--    table spam, and squatting a substrate_id ahead of a real member. Identity
--    provisioning is privileged; it now runs only under the service role, which
--    the dyad server already holds (supabase-admin) and never ships to a client.
--
-- 2. "Authors manage own comments" checked only authorship on write, not that
--    the author may see the prompt being commented on. A claim-authorized ember
--    member scoped to corner A could INSERT a comment onto a prompt in corner B
--    by id. The write check now also requires the target prompt to be visible
--    to the requester: the EXISTS subquery on `prompts` is itself RLS-filtered
--    for the authenticated role, so a comment can only be written on a prompt
--    the requester can actually read (scope membership for ember, normal
--    visibility for a Supabase user).

-- 1. Provisioning is service-role only.
REVOKE EXECUTE ON FUNCTION public.ensure_identity(TEXT, TEXT) FROM public;
REVOKE EXECUTE ON FUNCTION public.ensure_identity(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_identity(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_identity(TEXT, TEXT) TO service_role;

-- 2. Comment writes are bound to prompt-read access.
DROP POLICY IF EXISTS "Authors manage own comments" ON prompt_comments;
CREATE POLICY "Authors manage own comments"
  ON prompt_comments FOR ALL
  TO authenticated
  USING (author_id = app.current_user_id())
  WITH CHECK (
    author_id = app.current_user_id()
    AND EXISTS (SELECT 1 FROM prompts p WHERE p.id = prompt_comments.prompt_id)
  );
