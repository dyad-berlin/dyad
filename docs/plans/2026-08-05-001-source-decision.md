# Content source decision

Closes the gate opened by `2026-08-05-001-feat-content-delivery-decoupling-plan.md`, unit U6.
Evidence: `2026-08-05-001-spike-notes.md`.
Decided: 2026-08-28. Decided by: Theodore. Drafted with Claude.

Answers marked **PROPOSAL** are the drafter's, not the founder's, and are the ones to overwrite.

---

## The verdict

**The atproto spike does not pass its gate. The source is the admin plane over Postgres — Branch B.**

Six of eight exit criteria pass, one is partial, one fails. KTD8 says any unmet criterion is a fail, and the record honours that rather than relitigating the bar after seeing the score. The 3-working-day time-box was separately set aside by founder decision and plays no part here; the decision rests on criterion 8 alone.

What passed is worth stating precisely, because it is the part that carries forward. The read path resolves handle → DID → PDS, lists and gets records, renders byte-identical output to the module adapter, cold-starts clean under `nodejs_compat` where the identity provider's undici chain does not, publishes to visible in 62.5 s p95 against a 300 s bound, serves last-known-good through a simulated outage, and sits 150× inside the PDS rate limit — with zero new runtime dependencies. None of that is in doubt.

What failed is criterion 8: the essay author publishes one edition end-to-end, through a tool that exists today, without a developer present. No such tool exists. The collection is `social.dyad.unfolding.entry`, an NSID dyad minted, so no third-party client knows the shape and none will. Every publish in the spike ran as `node scripts/spike-atproto.mjs publish <entry>.json` — a developer holding hand-written JSON. This was named as Branch A's principal risk before the spike started, and the spike confirmed it rather than retiring it.

The honest summary is that the spike succeeded at what testing can settle and failed at what it cannot. **The read path is sound; the authoring path does not exist.** Those two facts are separable, and the decision turns entirely on the second.

### Why the failure is decisive rather than waivable

Criterion 8 could have been waived the way the time-box was, on the argument that the read path passed everything testable and an editor is buildable. It is not waived, for a reason that survives three months of hindsight:

R1 and R2 — the requirements this entire plan exists to satisfy — say publishing an essay requires no commit, PR, or build. Criterion 8 is not an extra hurdle bolted onto the spike; it *is* R1, tested. A source that cannot be published to without a developer has not decoupled anything, it has only moved where the developer types. Waiving criterion 8 would mean declaring the plan's own requirement optional at the moment it became inconvenient.

And the build that a waiver defers does not shrink. Under Branch A, the authoring surface must be written from nothing: an editor that emits the custom record shape, a write path holding credentials for the repo, and a cron Worker for reconciliation on top. Under Branch B, most of the editor already exists in this repo.

### What Branch A would have delivered, weighed honestly (KTD9)

KTD9 requires this weighing, because the founder's reason for the spike was rehearsal for member-published prompts, not a claim that atproto is the better content source.

The rehearsal value is real and it has already been banked. `src/lib/server/atproto/xrpc.ts` is a working, tested, zero-dependency read client, and the spike answered the one genuinely open question — whether a hand-rolled atproto read path survives workerd, where `@prefig/upact-atproto` caused three production incidents (#133, #136, #139). That answer is now evidence rather than hope, and it did not require winning the gate to obtain.

What Branch A would have added beyond that rehearsal is a publish path with no interoperability. An unregistered custom NSID takes atproto's lock-in and returns none of its network effects: no AppView indexes the records, no client renders them, no third-party editor writes them. Branch A's distinctive benefit over Branch B reduces to "the content lives in a repo dyad could in principle move", which the admin plane also provides via `pg_dump`, without a PDS to operate.

KTD9 is equally clear about what the spike does *not* transfer to member prompts: the consent model, moderation, deletion propagation, the GDPR posture on member media, and operating against N arbitrary member PDSes rather than one first-party account. Choosing Branch B costs the member-prompts feature none of the transferable work — the XRPC client stays in the tree.

**Disposition of the spike code:** the atproto adapter, XRPC client, blob mirror and their tests stay in-tree, gated behind `CONTENT_SOURCE=atproto`. Unset, nothing changes. It is a working reference implementation for the member-prompts read path and deleting it would throw away the only workerd-verified atproto client dyad has. `scripts/spike-atproto.mjs` stays too, with the caveat already recorded in the spike notes: its `measure` command overwrites the record at whatever slug it is given, and it has no `delete`.

---

## The Branch B choice, and why it is not really three

U6 anticipated this convergence and asked that it be stated plainly rather than dressed as an open choice. It is stated plainly.

**Separate content repo — eliminated on tooling, not hosting.** The sovereign version of this path (Codeberg, Forgejo) has no confirmed editor. Decap, Keystatic and Pages CMS are all built around GitHub OAuth and GitHub Apps; support for anything else is unverified. The non-sovereign version puts dyad's public writing record on GitHub, and `raw.githubusercontent.com` is additionally unusable since GitHub's May 2025 limits, which ignore tokens on the raw domain. This path fails criterion 8 for the same reason Branch A does — no editor exists — with the sovereignty cost on top.

**Self-hosted headless CMS — eliminated on standing cost.** Directus and Strapi both have strong editors. Both are a service to run, patch, back up and pay for, indefinitely, for three essays and four Wiggling voices. The CMS-CDN default also threatens R4 unless every asset path is audited. See *Correctness of the elimination* below for the condition under which this returns.

**Admin plane over Postgres — chosen.** Everything it needs is already running and already operated. No new service, no new host, no new vendor, and no new sovereignty question.

The plan scored the admin plane's principal risk as "editor UX is substantial build effort." That was the correct assessment when written and it is now the weakest of the four risks, because most of the editor already exists:

| Piece | Already in the repo |
|---|---|
| Rich text editor | `src/lib/components/PromptEditor.svelte` — TipTap, toolbar, Svelte 5 runes bridge |
| Structure validation | `src/lib/server/validate-tiptap-content.ts` |
| Safe render | `src/lib/utils/tiptap-html.ts` — fixed tag/attribute allowlist, protocol allowlist, no DOMPurify |
| Admin CRUD precedent | `/admin/copy` over `copy_overrides` — service-role, cached read, fail-to-default |
| Media | `StorageService`, the "newsletter assets" bucket, `storageUrl()` |
| Runtime cache | `CachedContentService`, KV, last-known-good — built at U3, source-agnostic |

An essay is structurally a conversation body plus metadata, which is what the plan observed when it recorded this option as the fallback. The remaining build is an admin route, a table, and a `SupabaseContentService` — not an editor from scratch.

### The body variant, which the plan already budgeted

The Problem Frame identified that both recent essays needed a renderer change in the same PR to ship: `bb7337a` added `heroCreditUrl` and its render branch, `0dd04f7` added the entire inline-markup grammar. A decoupling that froze today's `paragraphs: string[]` plus the two-token grammar in `segments.ts` would leave the author still needing a developer for that class of edit — decoupled in name only.

KTD2 budgets one contract change for exactly this, at U7. Branch B spends it on TipTap JSON rendered through `tiptap-html.ts`: the one permitted `{@html}` use under R6, output of a safe-by-construction renderer that already exists and is already tested. This is the reason Branch B clears criterion 8 where the other three candidates do not — the editor and the renderer are the same pipeline, and dyad already owns both ends of it.

### Correctness of the elimination

Stated so a reader can check the reasoning rather than trust it. Branch B by elimination is sound **only while** the editor build stays small, which rests on reusing the TipTap pipeline. If that reuse turns out not to hold — if essay bodies need structure the conversation editor cannot express, or the admin route grows past a few hundred lines — then the admin plane's build cost converges on the CMS's, and a self-hosted Directus deserves a second look on the strength of its editor. That is the trigger to revisit, and it is a U7 discovery, not a U6 one.

### R9 scored — draft, preview, unpublish without deploy

R9 replaces the editorial gate that the PR flow provided. `f5edfd7` and `2dbfa2f` both caught real errors before production; removing PRs from the publish path removes that review, and R9 is what replaces it.

| | Branch A: atproto | Content repo | **Admin plane** | Self-hosted CMS |
|---|---|---|---|---|
| Draft state | Not in the record shape; would need a `visibility` field the custom NSID does not have, or a second collection | Branch or PR | **A `state` column, exactly as `prompts` already does — `draft` / `published`** | Built in |
| Shareable preview | Nothing renders an unpublished record; would need a preview route reading the repo directly | Deploy previews, if the content repo triggers builds — which reintroduces the build R1 removes | **Admin-authenticated preview route reading the draft row; Cloudflare Access already gates it** | Built in |
| Unpublish without deploy | Delete the record, then explicit KV invalidation — persisting values mean deletion alone is not enough (KTD4) | Commit a revert, then invalidate | **Flip `state`, invalidate — the same two-step, on infrastructure already operated** | Built in |
| Editorial review | None | PR review, the mechanism being removed | **None by default — see below** | Workflow states in Directus/Strapi |

The admin plane scores best on the first three and is honest about the fourth: nothing in Branch B forces a second pair of eyes before publish. The draft state plus the preview route makes review *possible*; it does not make it *required*. **Decided (founder, 2026-08-28): accepted.** dyad has two people, and a required-approval workflow between them is ceremony rather than a gate. What replaces the PR is the draft-then-preview habit, not an enforced state machine. If the team grows past that, add an `approved_by` column — but not before it is load-bearing.

---

## The four questions U6 must answer

### 1. Where authoring happens, and through which tool

**A new admin route, `/admin/unfolding`, using the existing TipTap editor.** Carried directly from criterion 8: the tool did not exist, so the decision is to build the one that costs least, and the pieces are listed in the table above.

**PROPOSAL — scope of the first version.** A listing of essays with their state, a create/edit form (metadata fields plus a TipTap body), a hero-image upload through the existing `StorageService`, a preview route, and publish/unpublish flipping `state` with KV invalidation on both. Deliberately absent from v1: scheduled publishing, revision history, multi-author attribution, and any approval workflow. Each is a real feature and none is needed for three essays a quarter.

**PROPOSAL — Wiggling authoring.** The same route, a second tab. R2 gives Wiggling the same no-deploy requirement, and its shape is small enough that a separate surface would be overhead.

### 2. Who operates whatever runs

**Nothing new runs. That is most of why this branch won.**

Branch A required a standalone cron Worker for reconciliation — its own deploy, its own KV binding, its own failure mode outside the Pages project — because Pages Functions have no `scheduled` handler. Branch B needs none: the admin plane writes and invalidates KV in the same request, so there are no out-of-band writes to reconcile. KTD7's cron requirement was a consequence of the content living somewhere dyad does not control writes to. It does not survive the branch change, and U7's implementation notes should drop it for Branch B.

What is operated, and by whom: Supabase (already, the founder), Cloudflare Pages and the KV namespace (already, the founder), Cloudflare Access gating the admin plane (already, the founder). The delta is one table and one route inside systems that already have an owner.

### 3. Who operates the PDS

**Moot — Branch B was chosen, so dyad operates no PDS for content.**

Recorded because it is the question that would have been hardest under Branch A, and because it will return. The spike ran against `fiore.dyad.social`, the founder's personal account, on `bsky.social` — US-hosted, and a personal account standing in for an institutional one. Neither is a production posture. Branch A would have forced a choice between a dyad-owned `bsky.social` account (US controller, contradicting the sovereignty posture in `DESIGN.md`), a hosted EU provider (a vendor dependency for the one asset meant to survive vendor changes), or self-hosting a PDS (infrastructure with no current owner).

That question returns in full when member-published prompts are planned, and the strategy note of 2026-07-22 already frames it: a member-identity PDS is the *identity* leg of a Supabase-off migration, not the app-data leg, and the recommendation there is relying-party-first before hosting anything. This decision is consistent with that and does not prejudge it. **This decision is about content only. It says nothing about identity.**

### 4. How Wiggling voices are represented

**A second table, `wiggling_voices`, not a variant of the essay row.**

The two content types share nothing but the port. `WigglingVoice` is `{ src, poster, name, episode }` — four strings, no body, no slug, no date; `UnfoldingEntry` has eleven fields and a rich body. Forcing them into one polymorphic table would mean nullable columns on both sides and a discriminator, to save one migration.

**PROPOSAL — the shape:**

```sql
create table wiggling_voices (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  src          text not null,   -- reel path within the video bucket
  poster       text not null,   -- poster-frame path, resolved via storageUrl()
  episode      text not null,   -- outbound link to the full conversation
  state        text not null default 'draft',
  position     int  not null,   -- display order; the module encoded it as array order
  archived_at  timestamptz,     -- how Kaspar was held out, and then restored
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
```

Three notes on why. `position` exists because the module's ordering is array order and the port must not lose it — the essays solve this with `date`, and voices have no date. `archived_at` exists because the history has already exercised it: the Kaspar entry was held out of the module while there was no `kaspar.mp4` in the bucket, and restored as the fourth voice once the reel existed (#183). "Written, finished, not currently shown" is a real state and it is not `draft` — the entry was ready, its asset was not. And `src`/`poster` stay *paths*, not URLs, resolved through `storageUrl()` and `videoBase` at read time — R4 says no third-party asset reaches a visitor's browser, and storing a bare path makes that structural rather than a rule someone must remember.

**PROPOSAL — one open sub-question for U7.** The essays table needs the same `position`-versus-`date` decision resolved in the other direction: essays sort by `date` today, and if an editor ever needs to pin an essay out of date order, that is a column. Not adding it now.

---

## What this changes for contributors

One line for `CLAUDE.md`, after U7 ships and before U8 deletes the modules:

> **Newsletter and Wiggling content is edited at `/admin/unfolding`, not in the repo.** `src/lib/content/unfolding.ts` and `wiggling.ts` are retired at U8; until then the module adapter remains the default and the admin source is gated.

And a values cost, carried over from U8 and repeated here so it is not discovered later: essays leave the working tree. dyad's public writing stops being versioned alongside its code. Git history remains the archive of everything published up to cutover, and Postgres owns the record after it — which means the essays now depend on database backups rather than on every clone of the repo. That is the price of R1, it was accepted when the plan was written, and it is accepted here.

---

## Consequences for U7 and U8

- U7 implements `SupabaseContentService` behind the existing port, plus `/admin/unfolding`, plus the TipTap body variant per KTD2.
- **The reconciliation cron Worker is dropped.** It existed only for Branch A's out-of-band writes. Publish invalidates KV directly, in-request.
- The write path stated at U7 stands unchanged in shape: publish → shape-guard and length validation → mirror media (KTD5) → write the row → explicit KV invalidation.
- Media mirroring keeps its KTD5 guards — MIME allowlist, magic-byte verification — but the source is now an admin upload rather than a PDS blob. The guards were verified in the spike and the code is worth keeping; the `blob-mirror.ts` fetch-from-PDS half is not on this path and stays with the atproto adapter.
- U8's 503-not-404 distinction is confirmed as needed by direct observation: the spike's outage test served a 500 for an uncached slug. Not new scope, but no longer hypothetical.
- The XRPC timeout branch has no test. If the atproto client is kept in-tree — and it is — that gap should be closed with a unit test rather than left as the one upstream failure mode whose behaviour is assumed.
