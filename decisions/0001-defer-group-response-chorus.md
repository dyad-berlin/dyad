# 0001 — Defer group-conversation response sharing ("chorus")

- **Status:** Deferred — decision recorded, not implemented
- **Date:** 2026-06-03
- **Context:** Group conversations (PR #51, `feat/group-conversations-capacity`)
- **Related:** `DESIGN.md` § *Coordination, not communication*; `CLAUDE.md` § *Data Collection and Values*
- **This PR:** the visible, dedicated home for the chorus work. It currently contains only this decision record. Implementation lands here if and when the conditions below are met.

## Decision

Ship group conversations **without** letting participants read each other's written
**responses**. Group conversations keep dyad's one-way-message commitment:
participants see each other's *presence* (first name + count, via `ParticipantsStack`),
never each other's *response content*. The "chorus" — co-participants reading each
other's responses — is deferred and tracked here for visibility rather than buried.

## Why this is a real decision, not an unbuilt gate

Response visibility being author-only is a **structural commitment**, not an
oversight. `DESIGN.md`: *"A response is a one-way message"* — enforced by schema
absence (`prompt_comments` has no `parent_id`). Enabling chorus **reverses** that
commitment, so it is a deliberate design change and a founder/values call, not an
engineering one. (Note: "chorus" is our shorthand here; the codebase's only named
deferral, "inter-participant reveal," refers to group *feedback* — a separate thing.)

## Decision chain

1. **Goal** — ship group conversations: capacity, joiners filling a slot, group
   feedback, and instrumentation for the Fork B decision.
2. **Surfaced mid-build** — groups make it *possible* to reveal co-participants'
   written responses to each other.
3. **Blast-radius analysis** — bounded in code, but high-risk and values-laden (below).
4. **Decision** — ship groups **without** chorus.
5. **Follow-up** — chorus becomes this dedicated PR, visible and tracked.

## Blast radius

**Who can read a response today** (the two-party model):
- the response's own author;
- the prompt (conversation) author.

Enforced by RLS on `prompt_comments` — policies *"Authors manage own comments"* and
*"Prompt author reads comments"* (`supabase/migrations/20260502100400_rls_use_app_current_user_id.sql`).
No participant-, meeting-, or audience-based read path exists.

**What a change would touch:**

| Dimension | Risk | Detail |
|---|---|---|
| DB / RLS | High | A participant-aware SELECT path (new RLS policy or a count-style SECURITY DEFINER RPC). Easy to over-expose: across conversations, to *unconfirmed* responders, or *before* acceptance. |
| Service coupling | Subtle | `getCommentsForPrompt` (`src/lib/services/comment.ts`) does `select *` with no author filter and leans entirely on RLS to scope rows. Widening the policy silently widens every caller — must be audited, not just the new surface. |
| Loader / UI | Moderate | Conversation detail renders other bodies only inside `{#if isAuthor}`; non-authors see only their own response. A participant branch + a "responses from the group" surface + copy are needed. |
| Legal / values | **Blocker** | Revealing a response written when only the author could read it is a new disclosure of member content to an audience the writer didn't address — a `/datenschutz` surface and a consent/expectation problem. Per `CLAUDE.md` § *Data Collection and Values*, "would need a datenschutz disclosure" is a strong signal to reconsider. The `group_feedback` migration already punted the analogous reveal "to a founder call." |
| Tests | Moderate | New RLS behavioural coverage: participant-can-read, non-participant-cannot, cross-conversation isolation, pre-acceptance invisibility. |

## Conditions to revisit

Implement only with **all three**:

1. The **Fork B usage data** (instrumented in PR #51) supports investing here.
2. **Forward-only** disclosure plus explicit **consent copy** — no retroactive reveal
   of responses already written under author-only expectations.
3. A **participant-scoped read path** proven not to leak across conversations or
   before acceptance (RLS policy or SECURITY DEFINER RPC), covered by the behavioural
   tests above.

## Scope of this PR

Decision record only — no code. Kept as a draft so the deferral is visible in the PR
list; the implementation grows here once the conditions are met.
