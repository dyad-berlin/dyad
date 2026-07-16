/**
 * Corner content access for account-less members, substrate-agnostic.
 *
 * All reads and writes go through whichever client the caller chose
 * (`data-access`), pinned to a single corner (scope). Author identity is always
 * the caller-resolved `identities.id`, never client input. Scope of "participate"
 * here: read the corner's conversations and post a one-way response. Starting
 * conversations, meetings, scheduling, and the feedback cycle stay account-bound.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface CornerConversation {
	id: string;
	title: string;
	published_at: string | null;
}

export interface CornerResponse {
	id: string;
	author_id: string;
	body: string;
	created_at: string;
}

export interface CornerConversationDetail {
	id: string;
	title: string;
	body: string;
	published_at: string | null;
	responses: CornerResponse[];
}

export async function listCornerConversations(
	client: SupabaseClient,
	scope: string
): Promise<CornerConversation[]> {
	const { data } = await client
		.from('prompts')
		.select('id, title, published_at')
		.eq('state', 'published')
		.is('hidden_at', null)
		.eq('audience_scope', scope)
		.order('published_at', { ascending: false })
		.limit(100);
	return (data ?? []) as CornerConversation[];
}

export async function getCornerConversation(
	client: SupabaseClient,
	scope: string,
	promptId: string
): Promise<CornerConversationDetail | null> {
	const { data: prompt } = await client
		.from('prompts')
		.select('id, title, body, published_at, audience_scope, state, hidden_at')
		.eq('id', promptId)
		.maybeSingle();
	if (!prompt || prompt.audience_scope !== scope || prompt.state !== 'published' || prompt.hidden_at !== null) {
		return null;
	}
	const { data: responses } = await client
		.from('prompt_comments')
		.select('id, author_id, body, created_at')
		.eq('prompt_id', promptId)
		.order('created_at', { ascending: true });
	return {
		id: prompt.id as string,
		title: prompt.title as string,
		body: prompt.body as string,
		published_at: prompt.published_at as string | null,
		responses: (responses ?? []) as CornerResponse[]
	};
}

export type RespondResult = { ok: true; responseId: string } | { ok: false; reason: string };

export async function respondToCornerConversation(
	client: SupabaseClient,
	scope: string,
	promptId: string,
	authorId: string,
	body: string
): Promise<RespondResult> {
	const trimmed = body.trim();
	if (trimmed.length === 0 || trimmed.length > 2000) {
		return { ok: false, reason: 'a response must be between 1 and 2000 characters' };
	}
	const conversation = await getCornerConversation(client, scope, promptId);
	if (!conversation) return { ok: false, reason: 'that conversation is not in this corner' };

	const { data, error } = await client
		.from('prompt_comments')
		.upsert({ prompt_id: promptId, author_id: authorId, body: trimmed }, { onConflict: 'prompt_id,author_id' })
		.select('id')
		.single();
	if (error || !data) return { ok: false, reason: error?.message ?? 'could not save response' };
	return { ok: true, responseId: data.id as string };
}
