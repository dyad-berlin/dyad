---
name: reviewing-feedback
description: Review and triage user feedback from the dyad.berlin app. Use when the user asks to check feedback, review bug reports, or triage feature requests.
---

# Reviewing Feedback

Triage user feedback submitted through the in-app feedback system.

## Mental model: the feedback table is an INBOX, not a store

Every item is triaged to exactly one outcome, and then **the source row is deleted** so the
inbox never accumulates a stale backlog of half-reviewed todos:

1. **Actionable dyad.berlin item** → create a **Notion ticket**, then delete the row.
2. **Item carrying a durable lesson** (a value, a recurring UX principle) → capture the learning
   (a memory, a doc, or CONCEPTS.md), then delete the row.
3. **dyad-canvas item** → delete. `dyad-canvas` is a *separate product*; its feedback is out of
   scope here. Bulk-delete with `delete-canvas`.
4. **Not worth acting on** → delete (optionally note why in the ticket's stead, then delete).

Nothing stays in `reviewed` limbo. If it mattered, it's a ticket or a learning; if not, it's gone.

> Archiving instead of deleting is a future option — once the app reaches a stable version. It
> needs a migration first: `feedback_status_check` currently allows only
> `new/reviewed/in_progress/resolved/wont_fix` (no `archived`).

## Where the real feedback lives: PRODUCTION

`.env.local` points at the **local** dev stack (empty). Real feedback is in production. Always
triage with `--prod`, which loads a git-ignored `.env.prod.local`
(prod `PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`):

```bash
npm run feedback -- --prod                 # triage view: new dyad items, oldest first, stale flagged
npm run feedback -- --prod --app canvas    # canvas items (to review before delete-canvas)
npm run feedback -- --prod --all           # everything, any status, any app
npm run feedback -- --prod --json          # machine-readable (adds app / ageDays / stale)
npm run feedback -- --prod --stale         # only items older than the stale threshold
npm run feedback -- --prod --months 6      # override stale threshold (default 3)
```

Without `--prod` the tool targets local dev, so no accidental prod deletes. When `--prod` is set
it prints `🌐 Targeting PRODUCTION` to stderr.

## Triage commands

```bash
npm run feedback -- --prod update <id> <status> [notes]   # status: new|reviewed|in_progress|resolved|wont_fix
npm run feedback -- --prod delete <id> [<id>...]           # hard-delete one or more rows
npm run feedback -- --prod delete-canvas                   # hard-delete ALL canvas items
```

## Session flow

1. **See the shape.** `npm run feedback -- --prod` prints a summary header: total, how many are
   stale (`>N months`), how many are canvas.
2. **Offer the prune first.** Before any code cross-checking or ticketing, show the operator the
   list and ask which items to ignore — they often know an item is irrelevant/obsolete and can save
   the whole investigation. Don't cross-check items the operator would drop on sight.
3. **Clear canvas.** Skim `--app canvas`, then `delete-canvas`.
3. **Handle stale items (`⚠️ STALE`).** These are auto-flagged (>3mo). Do **not** create a ticket
   from a stale item on sight — the app has changed. Re-confirm it still reproduces on the current
   version. If it's already fixed or obsolete, delete it. This is the guard against reopening dead
   issues.
4. **For each remaining item**, decide: ticket, learning, or delete (see mental model). Before
   ticketing a bug, check whether it's already resolved on `main` (grep the code / recent commits) —
   the CSV/inbox often lags the deployed app.
5. **Create the Notion ticket**, then **delete the row**. Ticketing without deleting recreates the
   stale-backlog problem.

## Notion ticket target

Database **"Bug & feedback tickets"** under *DYAD → PRODUCT, PRIVATE BETA*
(data source `c5960ce2-963e-424e-8569-a12d33c26c26`). Create pages with the Notion MCP
(`notion-create-pages`, `parent: { data_source_id: ... }`). Properties:

| Property | Value |
|----------|-------|
| Name | Short imperative title (rephrase user's words; don't paste raw) |
| Type | `bug` / `feature` / `report` / `other` |
| Status | `Not started` |
| Priority | `urgent` / `high` / `normal` / `low` |
| App | `dyad` |
| Submitted | feedback `created_at` (date) |
| Source feedback id | the feedback `id` (traceability after the row is deleted) |
| Context | `page_url` from context (where it was reported) |

Put the verbatim user description + reproduction context in the page body.

## Reading context

Each item's `context` JSONB may include: `page_url`/`url`, `user_agent`, `app_version`
(the deployed build's git short SHA — compare against `git log` to judge whether the report
predates a fix), `recentErrors`
(console errors before submission — often the smoking gun for a bug), and for canvas items
`focusedCardId`, `cardCount`, `camera`, `viewport`. The list view surfaces url + browser +
deduped errors inline; use `--json` for the full object.

## Types

🐛 `bug` · ✨ `feature` · 🚩 `report` (user flagged content/conduct — handle with care, may be
safeguarding-relevant) · 💬 `other` (often praise or vague — usually a learning or a delete).

## Guidelines

- Read the full description before deciding.
- Check `recentErrors` for bugs — often reveals the cause.
- Re-confirm anything `⚠️ STALE` before ticketing; prefer delete for the obsolete.
- Batch similar items into one ticket.
- Every triaged row ends deleted — don't leave items sitting in `reviewed`.
