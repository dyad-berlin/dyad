<script lang="ts">
	let { select }: { select: (id: string) => void } = $props();
</script>

<section>
	<p class="doc-kicker">Governance</p>
	<h2>How we practice</h2>
	<p>Online spaces have become places we live in, but not places we govern. Rules change without participation, moderation happens behind closed doors, and the people most affected rarely shape decisions. Dyad does it differently, and it starts small enough to actually do it.</p>
	<h3>How do we practice?</h3>
	<p>We begin with the least governance that is real: four practices, running from day one.</p>
	<ul>
		<li><strong>Proposals, open to every member.</strong> Any member can propose a change to how the community works. A proposal is a few written sentences, not a procedure.</li>
		<li><strong>Consent, not voting.</strong> A proposal passes unless someone raises a reasoned objection, meaning a specific claim that it causes harm or breaks an agreement we made. Preferences are input rather than vetoes. Nothing needs a majority, and nobody can block a proposal on taste alone.</li>
		<li><strong>A public decision log.</strong> Every proposal, objection, and outcome is written down where all members can read it. Governance you cannot see is not governance.</li>
		<li><strong>State of Dyad, quarterly.</strong> The team shares what it decided and why, including, once membership sustains it, what the founders are paid.</li>
	</ul>
	<p>We add more structure only when a real and recurring pain demands it, and never in advance. That is the whole model.</p>
	<h3>Who decides what?</h3>
	<p>Not everything goes through a consent round. Some decisions need to move at the speed of the day, and forcing them through process would serve nobody. Decisions live in three lanes.</p>
	<ul>
		<li><strong>Members decide together.</strong> Community standards and moderation policy. Who can join and how. What gets programmed and curated. The community budget. Removing a member, which is never one person's call and always a review by members with a right to appeal.</li>
		<li><strong>The team decides.</strong> Money, hiring, product direction, and legal matters. Members are told what was decided and why, at the State of Dyad, in writing, and they are never surprised by it after the fact.</li>
		<li><strong>Whoever holds the role acts.</strong> Hosting an event, moderating by the agreed standards, welcoming someone new. Consent applies to the rules, not to every action taken inside them.</li>
	</ul>
	<p>One lever keeps the lanes honest: if enough members petition on any topic, including the team's own decisions, the team must answer in writing within 14 days.</p>
	<p>The mechanics live in the governing documents in this documentation: the <button class="inline-link" onclick={() => select('bylaws')}>Bylaws</button>, the <button class="inline-link" onclick={() => select('agreements')}>Member Agreements</button>, and the <button class="inline-link" onclick={() => select('standards')}>Community Standards</button>.</p>

	<h3>How is a decision made?</h3>
	<p>A proposal passes unless someone gives a reason that it causes harm or breaks an agreement. Preferences are input rather than vetoes. Every rule made this way can be unmade the same way.</p>
	<ol>
		<li><strong>Idea.</strong> Something should change. Any member may raise it.</li>
		<li><strong>Proposal.</strong> Written in a few plain sentences in the proposal channel: what changes, and why.</li>
		<li><strong>Consent round, 72 hours.</strong> Members read it. Anyone may object, with a reason. Bylaws changes run for two weeks.</li>
		<li><strong>Outcome.</strong> With no reasoned objection, the change is made and recorded in the decision log. With a reasoned objection, the proposer resolves it and the round runs again, or the proposal is withdrawn. That is logged as well.</li>
	</ol>

	<h3>How do you submit a proposal?</h3>
	<p>Write a few plain sentences in the proposal channel: what should change, and why. You do not need a template, a seconder, or permission. If your proposal touches a tactical domain (standards, membership, programming, the community budget), the consent round starts when you post it. If it touches a team domain, it becomes a question the team answers in writing, and if enough members co-sign it as a petition, the team must answer within 14 days.</p>

	<h3>How do you object well?</h3>
	<p>An objection is a gift when it is specific. Say which harm the proposal causes, or which existing agreement it breaks. "I would not do it this way" is a preference, and preferences are welcome as input, but they do not stop a proposal. If your objection is reasoned, the proposer must resolve it before the change can pass, so the clearer you are, the faster the resolution.</p>

	<h3>When something goes wrong</h3>
	<p>Enforcement is a procedure, not a mood. The five steps, from a private notice through a documented conversation, a review panel drawn by lot, the right to be heard, and an appeal, are written out in <button class="inline-link" onclick={() => select('standards')}>Community Standards, section 4</button>. No member is ever removed by the unilateral decision of a single person.</p>
</section>
