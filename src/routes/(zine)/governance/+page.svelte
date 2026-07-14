<script lang="ts">
	import { useTocScroll } from '$lib/utils/use-toc-scroll.svelte';

	const ids = ['intro', 'documents', 'practice', 'flow', 'who-decides'];
	const toc = useTocScroll(ids);
	const activeId = $derived(toc.activeId);
	const isPast = (id: string) => toc.isPast(id);
</script>

<svelte:head>
	<title>Participatory Governance · dyad.</title>
	<meta name="description" content="How dyad practices participatory governance: a minimum viable set of practices, a simple decision flow, and plain-language documents." />
</svelte:head>

<div class="page">

	<div class="page-intro">
		<p class="section-label">Participatory Governance</p>
		<h1 class="page-title">"To maintain the faith that democracy requires, people need to experience co-governance in their daily lives."</h1>
		<p class="page-attr">Nathan Schneider</p>
	</div>

	<div class="page-body">

		<nav class="toc">
			<p class="toc-label">In this section</p>
			<ol class="toc-list">
				<li><a href="#documents" class:active={activeId === 'documents'} class:past={isPast('documents')}>The documents we begin with</a></li>
				<li><a href="#practice" class:active={activeId === 'practice'} class:past={isPast('practice')}>How we practice</a></li>
				<li><a href="#flow" class:active={activeId === 'flow'} class:past={isPast('flow')}>How a decision is made</a></li>
				<li><a href="#who-decides" class:active={activeId === 'who-decides'} class:past={isPast('who-decides')}>Who decides what</a></li>
			</ol>
		</nav>

		<div class="prose">

			<section id="intro">
				<p class="intro-text">Online spaces have become places we live in, but not places we govern. Rules change without participation, moderation happens behind closed doors, and the people most affected rarely shape decisions. dyad does it differently, and it starts small enough to actually do it.</p>
			</section>

			<section id="documents">
				<h2 class="section-h2">The documents we begin with</h2>

				<p>Governance here begins with documents, because writing things down is how a community can hold its own rules. There are six of them, all in plain language, all public, all versioned. Ratifying them with the founding members is the first consent round.</p>

				<div class="docs-grid">
					<div class="doc">
						<h3>Charter</h3>
						<p>The constitution. Who decides what, and how the rules change. Only members can amend it.</p>
					</div>
					<div class="doc">
						<h3>Community Standards</h3>
						<p>What we do not tolerate, where it applies, and the step-by-step process when something goes wrong, including appeals.</p>
					</div>
					<div class="doc">
						<h3>Membership Criteria</h3>
						<p>Who can join and how joining works. Published criteria, no taste judgments, a ladder instead of a wall.</p>
					</div>
					<div class="doc">
						<h3>Member Agreement</h3>
						<p>Your personal deal with dyad: what membership includes, what it is not, and how it can change, always with notice and with your right to leave first.</p>
					</div>
					<div class="doc">
						<h3>Governance Roadmap</h3>
						<p>How governance deepens as the community grows, in phases tied to real thresholds rather than promises.</p>
					</div>
					<div class="doc">
						<h3>Glossary</h3>
						<p>Ten terms, from member and steward to proposal, objection and consent, defined before we use them. Most governance disagreements are definitional, and this prevents them.</p>
					</div>
				</div>
			</section>

			<section id="practice">
				<h2 class="section-h2">How we practice</h2>

				<p>We begin with the least governance that is real: four practices, running from day one.</p>

				<div class="practices">
					<div class="practice-item">
						<h3>Proposals, open to every member</h3>
						<p>Any member can propose a change to how the community works. A proposal is a few written sentences, not a procedure.</p>
					</div>
					<div class="practice-item">
						<h3>Consent, not voting</h3>
						<p>A proposal passes unless someone raises a reasoned objection, meaning a specific claim that it causes harm or breaks an agreement we made. Preferences are input rather than vetoes. Nothing needs a majority, and nobody can block a proposal on taste alone.</p>
					</div>
					<div class="practice-item">
						<h3>A public decision log</h3>
						<p>Every proposal, objection, and outcome is written down where all members can read it. Governance you cannot see is not governance.</p>
					</div>
					<div class="practice-item">
						<h3>State of dyad, quarterly</h3>
						<p>The team shares what it decided and why, including, once membership sustains it, what the founders are paid.</p>
					</div>
				</div>

				<blockquote class="pull-quote">We add more structure only when a real and recurring pain demands it, and never in advance. That is the whole model.</blockquote>
			</section>

			<section id="flow">
				<h2 class="section-h2">How a decision is made</h2>

				<div class="flow" role="img" aria-label="Decision flow: idea, then written proposal, then 72 hours for objections, then either it passes and is logged, or a reasoned objection leads to amending the proposal and trying again.">
					<div class="flow-step">
						<p class="flow-stage">1 · Idea</p>
						<p class="flow-desc">Something should change. Anyone may raise it.</p>
					</div>
					<div class="flow-arrow" aria-hidden="true">↓</div>
					<div class="flow-step">
						<p class="flow-stage">2 · Proposal</p>
						<p class="flow-desc">Written in a few plain sentences in the proposal channel: what changes, and why.</p>
					</div>
					<div class="flow-arrow" aria-hidden="true">↓</div>
					<div class="flow-step">
						<p class="flow-stage">3 · Consent round · 72 hours</p>
						<p class="flow-desc">Members read it. Anyone may object, with a reason.</p>
					</div>
					<div class="flow-split">
						<div class="flow-branch">
							<p class="flow-branch-label">No reasoned objection</p>
							<div class="flow-step pass">
								<p class="flow-stage">It passes</p>
								<p class="flow-desc">The change is made and recorded in the decision log.</p>
							</div>
						</div>
						<div class="flow-branch">
							<p class="flow-branch-label">Reasoned objection</p>
							<div class="flow-step amend">
								<p class="flow-stage">Amend &amp; retry</p>
								<p class="flow-desc">The proposer resolves the objection and the round runs again, or the proposal is withdrawn. This is logged as well.</p>
							</div>
						</div>
					</div>
				</div>

				<p class="flow-note">Every rule made this way can be unmade the same way. Nothing is permanent except the log.</p>
			</section>

			<section id="who-decides">
				<h2 class="section-h2">Who decides what</h2>

				<p>Not everything goes through a consent round. Some decisions need to move at the speed of the day, and forcing them through process would serve nobody. Decisions live in three lanes.</p>

				<div class="decision-types">
					<div class="decision-type">
						<h3>Members decide together</h3>
						<p>Community standards and moderation policy. Who can join and how. What gets programmed and curated. The community budget. Removing a member, which is never one person's call and always a review by members with a right to appeal.</p>
					</div>
					<div class="decision-type">
						<h3>The team decides</h3>
						<p>Money, hiring, product direction, and legal matters. Members are told what was decided and why, at the State of dyad, in writing, and they are never surprised by it after the fact.</p>
					</div>
					<div class="decision-type">
						<h3>Whoever holds the role acts</h3>
						<p>Hosting an event, moderating by the agreed standards, welcoming someone new. Consent applies to the rules, not to every action taken inside them.</p>
					</div>
				</div>

				<p class="valve-note">One lever keeps the lanes honest: if enough members petition on <em>any</em> topic, including the team's own decisions, the team must answer in writing within 14 days.</p>
			</section>

		</div>
	</div>
</div>

<style>
	/* Shared zine page chrome lives in the (zine) +layout.svelte. */
	.page-title {
		font-family: var(--font-serif);
		font-size: clamp(1.5rem, 3vw, 2.4rem);
		font-weight: 400;
		color: rgba(240, 236, 230, 0.88);
		margin: 0 0 16px;
		line-height: 1.3;
		letter-spacing: -0.01em;
		font-style: italic;
	}

	.intro-text {
		font-family: var(--font-serif);
		font-size: 1.1rem;
		font-weight: 300;
		font-style: italic;
		color: rgba(240, 236, 230, 0.55);
		line-height: 1.75;
		margin: 0 0 20px;
	}

	.pull-quote {
		font-family: var(--font-serif);
		font-size: 1.1rem;
		font-weight: 400;
		font-style: italic;
		color: rgba(240, 236, 230, 0.55);
		border-left: 2px solid rgba(240, 236, 230, 0.12);
		margin: 40px 0 0;
		padding: 4px 0 4px 24px;
		line-height: 1.65;
	}

	/* ── How we practice ── */
	.practices {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 24px;
		margin-top: 8px;
	}

	.practice-item {
		padding: 24px;
		border: 1px solid rgba(240, 236, 230, 0.06);
		border-radius: 4px;
	}

	.practice-item h3 {
		font-family: var(--font-serif);
		font-size: 1rem;
		font-weight: 400;
		color: rgba(240, 236, 230, 0.8);
		margin: 0 0 12px;
	}

	.practice-item p { font-size: 0.85rem !important; margin: 0 !important; }

	/* ── The decision flow ── */
	.flow {
		max-width: 560px;
		margin: 8px auto 0;
	}

	.flow-step {
		border: 1px solid rgba(240, 236, 230, 0.14);
		border-radius: 4px;
		padding: 18px 22px;
		background: rgba(240, 236, 230, 0.02);
	}

	.flow-stage {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(240, 236, 230, 0.75);
		margin: 0 0 6px;
	}

	.flow-desc {
		font-size: 0.85rem !important;
		margin: 0 !important;
		color: rgba(240, 236, 230, 0.55) !important;
	}

	.flow-arrow {
		text-align: center;
		color: rgba(240, 236, 230, 0.3);
		padding: 8px 0;
		font-size: 1rem;
	}

	.flow-split {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
		margin-top: 16px;
	}

	.flow-branch-label {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(240, 236, 230, 0.4);
		text-align: center;
		margin: 0 0 8px;
	}

	.flow-step.pass { border-color: rgba(127, 191, 158, 0.35); }
	.flow-step.pass .flow-stage { color: rgba(154, 208, 180, 0.9); }

	.flow-step.amend { border-color: rgba(240, 236, 230, 0.1); }

	.flow-note {
		text-align: center;
		font-style: italic;
		font-size: 0.85rem !important;
		color: rgba(240, 236, 230, 0.45) !important;
		margin-top: 24px !important;
	}

	/* ── Who decides what ── */
	.decision-types {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 24px;
		margin-top: 8px;
	}

	.decision-type {
		padding: 24px;
		border: 1px solid rgba(240, 236, 230, 0.06);
		border-radius: 4px;
	}

	.decision-type h3 {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(240, 236, 230, 0.4);
		margin: 0 0 12px;
	}

	.decision-type p { font-size: 0.85rem !important; margin: 0 !important; }

	.valve-note {
		font-style: italic;
		color: rgba(240, 236, 230, 0.5) !important;
		margin-top: 24px !important;
	}

	/* ── Documents ── */
	.docs-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 24px;
		margin-top: 8px;
	}

	.doc {
		padding: 24px;
		border: 1px solid rgba(240, 236, 230, 0.06);
		border-radius: 4px;
	}

	.doc h3 {
		font-family: var(--font-serif);
		font-size: 0.95rem;
		font-weight: 400;
		color: rgba(240, 236, 230, 0.8);
		margin: 0 0 10px;
	}

	.doc p { font-size: 0.82rem !important; margin: 0 !important; }

	@media (max-width: 760px) {
		.practices, .decision-types, .docs-grid, .flow-split { grid-template-columns: 1fr; gap: 16px; }
	}
</style>
