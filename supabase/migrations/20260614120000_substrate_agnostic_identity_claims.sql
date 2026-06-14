-- Substrate-agnostic identity + scope claims (prototype seam).
--
-- Goal: let RLS authorize on a portable identity id and a set of active scopes
-- carried in the request JWT claims, so any upact substrate (Supabase Auth,
-- ember, OIDC, ...) flows through the same authorization path. The app mints a
-- short-lived JWT from the resolved Upactor carrying:
--    app_identity_id : the identities.id (UUID) to authorize as
--    app_scopes      : JSON array of scope slugs active for this request
-- and PostgREST exposes them at current_setting('request.jwt.claims').
--
-- app.current_user_id() already returns identities.id (not auth.uid()); this
-- migration only changes WHERE that id comes from: prefer the claim, fall back
-- to the Supabase-Auth lookup so existing logged-in users are unaffected.

-- 1. Identity: prefer the claim, fall back to the Supabase session.
CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_identity_id',
      ''
    )::uuid,
    (SELECT id FROM identities WHERE substrate = 'supabase' AND substrate_id = (auth.uid())::text)
  )
$$;

-- 2. Active scopes for this request, from the app_scopes claim (empty if none).
CREATE OR REPLACE FUNCTION app.current_scopes()
RETURNS TEXT[]
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT jsonb_array_elements_text(
        NULLIF(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_scopes'
      )
    ),
    ARRAY[]::text[]
  )
$$;

REVOKE EXECUTE ON FUNCTION app.current_scopes() FROM public;
GRANT EXECUTE ON FUNCTION app.current_scopes() TO authenticated, anon;

-- 3. Privileged identity provisioning, substrate-agnostic. Creating an identity
-- row is inherently privileged (like minting an auth.users row); it is the ONLY
-- elevated step in the account-less data path. Everything else goes through RLS
-- under the minted claim. Lives in `public` so supabase-js can call it via rpc().
CREATE OR REPLACE FUNCTION public.ensure_identity(p_substrate TEXT, p_substrate_id TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM identities WHERE substrate = p_substrate AND substrate_id = p_substrate_id;
  IF v_id IS NULL THEN
    INSERT INTO identities (substrate, substrate_id)
      VALUES (p_substrate, p_substrate_id)
      ON CONFLICT (substrate, substrate_id) DO NOTHING
      RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      SELECT id INTO v_id FROM identities WHERE substrate = p_substrate AND substrate_id = p_substrate_id;
    END IF;
  END IF;
  RETURN v_id;
END
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_identity(TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.ensure_identity(TEXT, TEXT) TO authenticated, anon;

-- 4. Finish the seam: move prompt_comments authorship off raw auth.uid() onto
-- app.current_user_id() (which now honours the claim). Behaviour is identical
-- for Supabase users (identities.id mirrors auth.uid()), and now also works for
-- a claim-authorized ember identity.
DROP POLICY IF EXISTS "Authors manage own comments" ON prompt_comments;
CREATE POLICY "Authors manage own comments"
  ON prompt_comments FOR ALL
  TO authenticated
  USING (author_id = app.current_user_id())
  WITH CHECK (author_id = app.current_user_id());

-- 5. Claim-scoped reads: a request whose app_scopes claim contains a corner may
-- read that corner's published conversations and their responses. Additive
-- (RLS policies are OR'd), so it broadens access only for requests carrying a
-- validly-signed claim — which only this app can mint (it holds the JWT secret).
DROP POLICY IF EXISTS "Claim-scoped corner prompts read" ON prompts;
CREATE POLICY "Claim-scoped corner prompts read"
  ON prompts FOR SELECT
  TO authenticated
  USING (
    state = 'published'
    AND hidden_at IS NULL
    AND audience_scope = ANY (app.current_scopes())
  );

DROP POLICY IF EXISTS "Claim-scoped corner comments read" ON prompt_comments;
CREATE POLICY "Claim-scoped corner comments read"
  ON prompt_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM prompts p
      WHERE p.id = prompt_comments.prompt_id
        AND p.state = 'published'
        AND p.hidden_at IS NULL
        AND p.audience_scope = ANY (app.current_scopes())
    )
  );
