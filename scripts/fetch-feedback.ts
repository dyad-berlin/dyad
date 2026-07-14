/**
 * Feedback triage tool.
 *
 * The `feedback` table is treated as a transient INBOX, not a store. Every item
 * is triaged to one of three outcomes and then the row is deleted, so nothing
 * lingers as a stale todo:
 *   - actionable dyad.berlin item  -> a Notion ticket, then delete the row
 *   - item carrying a durable lesson -> extract the learning, then delete the row
 *   - dyad-canvas item (separate product) -> delete (ignored here)
 *
 * Deletion is destructive by design for now. Once the app reaches a stable
 * version we may add an `archived` status instead (needs a migration: the
 * feedback_status_check constraint currently allows only
 * new/reviewed/in_progress/resolved/wont_fix).
 *
 * Usage:
 *   npm run feedback                         # triage view: new dyad items, oldest first, stale flagged
 *   npm run feedback -- --all                # all items (any status, any app)
 *   npm run feedback -- --app canvas         # canvas items only
 *   npm run feedback -- --app all            # both apps
 *   npm run feedback -- --status reviewed    # filter by status
 *   npm run feedback -- --type bug           # filter by type (bug|feature|report|other)
 *   npm run feedback -- --stale              # only items older than the stale threshold
 *   npm run feedback -- --months 6           # override stale threshold (default 3)
 *   npm run feedback -- --json               # machine-readable output (adds app/ageDays/stale)
 *   npm run feedback -- --limit 50
 *
 *   npm run feedback -- update <id> <status> [notes]
 *   npm run feedback -- delete <id> [<id>...]     # hard-delete one or more rows
 *   npm run feedback -- delete-canvas             # hard-delete ALL canvas items (ignored product)
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Real user feedback lives in PRODUCTION. `.env.local` points at the local dev
// stack (127.0.0.1:54321), which is empty — so triage needs a way to target prod.
// Pass `--prod` (or set FEEDBACK_ENV=prod) to load prod credentials from a
// git-ignored `.env.prod.local`. Without it, we target whatever `.env.local`
// points at (local dev), so nothing destructive can hit prod by accident.
//
// `.env.prod.local` should contain:
//   PUBLIC_SUPABASE_URL=https://<prod-ref>.supabase.co
//   SUPABASE_SECRET_KEY=sb_secret_...        (new API-key interface; preferred)
const useProd = process.argv.includes('--prod') || process.env.FEEDBACK_ENV === 'prod';
if (useProd) {
	const r = dotenv.config({ path: '.env.prod.local', quiet: true });
	if (r.error) {
		console.error('❌ --prod set but .env.prod.local not found (create it with prod PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY).');
		process.exit(1);
	}
} else {
	// Load .env.local first, then .env as fallback (dotenv never overrides a set var).
	dotenv.config({ path: '.env.local', quiet: true });
	dotenv.config({ quiet: true });
}

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
// Prefer the new-interface secret key (sb_secret_...); fall back to the legacy
// service_role JWT, then the publishable/anon key (read-only under RLS).
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseKey =
	secretKey ||
	process.env.SUPABASE_PUBLISHABLE_KEY ||
	process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
	process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
	console.error('Missing environment variables:');
	console.error('  PUBLIC_SUPABASE_URL');
	console.error('  SUPABASE_SECRET_KEY (sb_secret_…, required for delete) or a publishable/anon key');
	process.exit(1);
}

const usingPrivilegedKey = Boolean(secretKey);
const supabase = createClient(supabaseUrl, supabaseKey);

if (useProd) console.error('🌐 Targeting PRODUCTION (--prod). Deletes are irreversible.');

/** Items older than this many months are auto-flagged as possibly stale. */
const DEFAULT_STALE_MONTHS = 3;

type FeedbackStatus = 'new' | 'reviewed' | 'in_progress' | 'resolved' | 'wont_fix';
const VALID_STATUSES: FeedbackStatus[] = ['new', 'reviewed', 'in_progress', 'resolved', 'wont_fix'];

interface FeedbackItem {
	id: string;
	type: 'bug' | 'feature' | 'report' | 'other';
	description: string;
	context: Record<string, unknown>;
	created_at: string;
	canvas_id: string | null;
	user_id: string;
	status: FeedbackStatus;
	reviewed_at: string | null;
	notes: string | null;
}

const TYPE_EMOJI: Record<string, string> = {
	bug: '🐛',
	feature: '✨',
	report: '🚩',
	other: '💬'
};

const STATUS_EMOJI: Record<string, string> = {
	new: '🆕',
	reviewed: '👀',
	in_progress: '🔧',
	resolved: '✅',
	wont_fix: '❌'
};

function ageDays(createdAt: string): number {
	return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
}

/** dyad-canvas is a separate product; canvas_id present means it is a canvas item. */
function appOf(item: FeedbackItem): 'canvas' | 'dyad' {
	return item.canvas_id ? 'canvas' : 'dyad';
}

interface ListOptions {
	limit: number;
	typeFilter: string | null;
	statusFilter: string | null;
	appFilter: 'dyad' | 'canvas' | 'all';
	staleOnly: boolean;
	staleMonths: number;
	jsonOutput: boolean;
}

function parseListArgs(args: string[]): ListOptions {
	const o: ListOptions = {
		limit: 100,
		typeFilter: null,
		statusFilter: 'new', // default: only fresh inbox items
		appFilter: 'dyad', // default: this repo's product only
		staleOnly: false,
		staleMonths: DEFAULT_STALE_MONTHS,
		jsonOutput: false
	};

	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === '--limit' && args[i + 1]) o.limit = parseInt(args[++i], 10);
		else if (a === '--type' && args[i + 1]) o.typeFilter = args[++i];
		else if (a === '--status' && args[i + 1]) o.statusFilter = args[++i];
		else if (a === '--app' && args[i + 1]) o.appFilter = args[++i] as ListOptions['appFilter'];
		else if (a === '--months' && args[i + 1]) o.staleMonths = parseInt(args[++i], 10);
		else if (a === '--stale') o.staleOnly = true;
		else if (a === '--all') {
			o.statusFilter = null;
			o.appFilter = 'all';
		} else if (a === '--json') o.jsonOutput = true;
	}
	return o;
}

async function fetchFeedback(args: string[]) {
	const o = parseListArgs(args);
	const staleThresholdDays = o.staleMonths * 30;

	let query = supabase
		.from('feedback')
		.select('id, type, description, context, created_at, canvas_id, user_id, status, reviewed_at, notes')
		.order('created_at', { ascending: true }) // oldest first: triage the backlog tail
		.limit(o.limit);

	if (o.typeFilter) query = query.eq('type', o.typeFilter);
	if (o.statusFilter) query = query.eq('status', o.statusFilter);
	if (o.appFilter === 'dyad') query = query.is('canvas_id', null);
	else if (o.appFilter === 'canvas') query = query.not('canvas_id', 'is', null);

	const { data, error } = await query;
	if (error) {
		console.error('Error fetching feedback:', error.message);
		process.exit(1);
	}

	let items = (data || []) as FeedbackItem[];
	if (o.staleOnly) items = items.filter((it) => ageDays(it.created_at) >= staleThresholdDays);

	if (o.jsonOutput) {
		const enriched = items.map((it) => ({
			...it,
			app: appOf(it),
			ageDays: ageDays(it.created_at),
			stale: ageDays(it.created_at) >= staleThresholdDays
		}));
		console.log(JSON.stringify(enriched, null, 2));
		return;
	}

	if (items.length === 0) {
		console.log('No feedback found for that filter. Try --all or --app canvas.');
		return;
	}

	// Summary header, so a session starts with the shape of the queue.
	const canvasCount = items.filter((it) => appOf(it) === 'canvas').length;
	const staleCount = items.filter((it) => ageDays(it.created_at) >= staleThresholdDays).length;
	const label = o.appFilter === 'all' ? 'all apps' : o.appFilter;
	console.log(`\n📬 Feedback triage — ${items.length} items (${label}, status: ${o.statusFilter ?? 'any'})`);
	console.log(`   ${staleCount} stale (>${o.staleMonths}mo)${canvasCount ? `, ${canvasCount} canvas (delete with: delete-canvas)` : ''}`);
	console.log('='.repeat(64) + '\n');

	for (const item of items) {
		const days = ageDays(item.created_at);
		const stale = days >= staleThresholdDays;
		const date = new Date(item.created_at).toISOString().slice(0, 10);
		const typeEmoji = TYPE_EMOJI[item.type] ?? '❓';
		const statusEmoji = STATUS_EMOJI[item.status] ?? '❓';
		const appTag = appOf(item) === 'canvas' ? ' 🎨canvas' : '';
		const staleTag = stale ? `  ⚠️ STALE ${days}d — re-confirm before ticketing` : ` (${days}d)`;

		console.log(`${typeEmoji} [${item.type.toUpperCase()}] ${statusEmoji} ${item.status}${appTag} | ${date}${staleTag}`);
		console.log(`   ID: ${item.id}`);
		console.log(`   ${item.description.trim().replace(/\n+/g, ' ')}`);
		if (item.notes) console.log(`   📝 ${item.notes}`);

		const ctx = item.context;
		if (ctx && typeof ctx === 'object') {
			const bits: string[] = [];
			if (ctx.page_url) bits.push(String(ctx.page_url));
			else if (ctx.url) bits.push(String(ctx.url));
			if (ctx.userAgent || ctx.user_agent) {
				const ua = String(ctx.userAgent ?? ctx.user_agent);
				bits.push(ua.match(/(Chrome|Firefox|Safari|Edge)\/[\d.]+/)?.[0] ?? ua.slice(0, 40));
			}
			if (ctx.app_version) bits.push(`build ${ctx.app_version}`);
			if (bits.length) console.log(`   ↳ ${bits.join('  ·  ')}`);
			if (Array.isArray(ctx.recentErrors) && ctx.recentErrors.length > 0) {
				const errs = ctx.recentErrors as Array<{ message?: string }>;
				const unique = [...new Set(errs.map((e) => e.message).filter(Boolean))].slice(0, 2);
				if (unique.length) console.log(`   ⚠️ errors: ${unique.join(' | ')}`);
			}
		}
		console.log('');
	}

	console.log('='.repeat(64));
	console.log('Triage: `update <id> <status> [notes]`  ·  `delete <id>…`  ·  `delete-canvas`');
}

async function updateFeedback(id: string, status: FeedbackStatus, notes?: string) {
	const updateData: { status: FeedbackStatus; reviewed_at: string; notes?: string } = {
		status,
		reviewed_at: new Date().toISOString()
	};
	if (notes) updateData.notes = notes;

	const { error } = await supabase.from('feedback').update(updateData).eq('id', id);
	if (error) {
		console.error('Error updating feedback:', error.message);
		process.exit(1);
	}
	console.log(`✅ Updated ${id} → '${status}'`);
}

async function deleteFeedback(ids: string[]) {
	if (!usingPrivilegedKey) {
		console.error('❌ Delete requires a secret key (SUPABASE_SECRET_KEY); RLS blocks publishable/anon deletes.');
		process.exit(1);
	}
	const { data, error } = await supabase.from('feedback').delete().in('id', ids).select('id');
	if (error) {
		console.error('Error deleting feedback:', error.message);
		process.exit(1);
	}
	const deleted = (data || []).length;
	console.log(`🗑️  Deleted ${deleted} row(s)${deleted !== ids.length ? ` (${ids.length - deleted} not found)` : ''}.`);
}

async function deleteCanvas() {
	if (!usingPrivilegedKey) {
		console.error('❌ Delete requires a secret key (SUPABASE_SECRET_KEY); RLS blocks publishable/anon deletes.');
		process.exit(1);
	}
	const { data, error } = await supabase.from('feedback').delete().not('canvas_id', 'is', null).select('id');
	if (error) {
		console.error('Error deleting canvas feedback:', error.message);
		process.exit(1);
	}
	console.log(`🗑️  Deleted ${(data || []).length} canvas item(s) (dyad-canvas is a separate product).`);
}

async function main() {
	// Strip the global --prod flag so it doesn't get mistaken for the subcommand
	// or a filter (it's consumed separately at load time).
	const args = process.argv.slice(2).filter((a) => a !== '--prod');
	const cmd = args[0];

	if (cmd === 'update') {
		const [, id, status] = args;
		const notes = args.slice(3).join(' ') || undefined;
		if (!id || !status) {
			console.error('Usage: npm run feedback -- update <id> <status> [notes]');
			console.error(`Status: ${VALID_STATUSES.join(', ')}`);
			process.exit(1);
		}
		if (!VALID_STATUSES.includes(status as FeedbackStatus)) {
			console.error(`Invalid status '${status}'. Must be one of: ${VALID_STATUSES.join(', ')}`);
			process.exit(1);
		}
		await updateFeedback(id, status as FeedbackStatus, notes);
	} else if (cmd === 'delete') {
		const ids = args.slice(1).filter(Boolean);
		if (ids.length === 0) {
			console.error('Usage: npm run feedback -- delete <id> [<id>...]');
			process.exit(1);
		}
		await deleteFeedback(ids);
	} else if (cmd === 'delete-canvas') {
		await deleteCanvas();
	} else {
		await fetchFeedback(args);
	}
}

main();
