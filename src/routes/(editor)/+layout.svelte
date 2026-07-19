<script lang="ts">
	import type { LayoutData } from './$types';
	import FeedbackModal from '$lib/components/FeedbackModal.svelte';
	import MeetingFeedbackModal from '$lib/components/MeetingFeedbackModal.svelte';

	let { data, children }: { data: LayoutData; children: any } = $props();
</script>

<main class="editor-layout">
	{@render children()}
</main>

<FeedbackModal />

<!-- The feedback gate (hooks.server.ts) also covers the (editor) group: it sets
	pendingFeedbackFormId and 403s /api/* with { error: 'gated' }. Without the modal
	rendered here, a gated member in the editor would hit perpetual autosave/publish
	failures (and the raw 'gated' token) with no way to clear the obligation. Mirror
	(app)/+layout.svelte so the obligation is satisfiable from the editor too. -->
{#if data.pendingFeedback}
	<MeetingFeedbackModal
		formId={data.pendingFeedback.formId}
		meetingId={data.pendingFeedback.meetingId}
		initialState={data.pendingFeedback.state}
		vocabulary={data.pendingFeedback.vocabulary}
		meetingContext={data.pendingFeedback.meetingContext}
		lapsed={data.membership !== null && !data.membership.active}
	/>
{/if}

<style>
	.editor-layout {
		min-height: 100vh;
		background: var(--bg-canvas);
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0 var(--space-4) var(--space-4);
	}
</style>
