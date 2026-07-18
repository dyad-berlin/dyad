<script lang="ts">
	import { onMount } from 'svelte';
	import { copy } from '$lib/copy';

	// Master–detail: the sidebar picks a topic, the pane shows only that topic.
	// The hash carries the selection so every topic stays deep-linkable.
	const sections = new Set([
		'start',
		'support-us',
		'about-why',
		'about-governance',
		'about-care',
		'privacy',
		'bylaws',
		'agreements',
		'standards',
		'process-decision',
		'process-joining',
		'process-wrong',
		'guide-proposal',
		'guide-objection',
		'guide-leaving'
	]);

	let active = $state('support-us');
	let pane = $state<HTMLElement | undefined>();

	function fromHash() {
		const h = (location.hash || '').replace('#', '');
		active = sections.has(h) ? h : 'support-us';
	}

	function select(id: string) {
		active = id;
		// Keep the URL shareable without triggering the browser's own scroll-to-id
		// (the target only renders after this assignment anyway).
		history.replaceState(null, '', '#' + id);
		pane?.scrollIntoView({ block: 'start' });
	}

	onMount(fromHash);
</script>

<svelte:window onhashchange={fromHash} />

<svelte:head>
	<title>Documentation · dyad.</title>
	<meta
		name="description"
		content="Everything that defines dyad as an organization: the governing documents, the processes, and practical guides for members."
	/>
</svelte:head>

<div class="docs">
	<aside class="side">
		<a href="/" class="side-wordmark">DYAD</a>
		<nav aria-label="Documentation">
			<button class="side-link side-top" class:active={active === 'support-us'} onclick={() => select('support-us')}>Become a supporter</button>

			<p class="side-head">Community</p>
			<button class="side-link" class:active={active === 'about-why'} onclick={() => select('about-why')}>Our origin story</button>
			<button class="side-link" class:active={active === 'about-care'} onclick={() => select('about-care')}>Community care</button>
			<button class="side-link" class:active={active === 'privacy'} onclick={() => select('privacy')}>Privacy commitments</button>
			<button class="side-link" class:active={active === 'process-joining'} onclick={() => select('process-joining')}>Becoming a member</button>
			<button class="side-link" class:active={active === 'guide-leaving'} onclick={() => select('guide-leaving')}>How to leave</button>

			<p class="side-head">Governance</p>
			<button class="side-link" class:active={active === 'bylaws'} onclick={() => select('bylaws')}>Bylaws</button>
			<button class="side-link" class:active={active === 'agreements'} onclick={() => select('agreements')}>Member Agreements</button>
			<button class="side-link" class:active={active === 'standards'} onclick={() => select('standards')}>Community Standards</button>
			<button class="side-link" class:active={active === 'about-governance'} onclick={() => select('about-governance')}>How we practice</button>
			<button class="side-link side-sub" class:active={active === 'process-decision'} onclick={() => select('process-decision')}>How a decision is made</button>
			<button class="side-link side-sub" class:active={active === 'process-wrong'} onclick={() => select('process-wrong')}>When something goes wrong</button>
			<button class="side-link side-sub" class:active={active === 'guide-proposal'} onclick={() => select('guide-proposal')}>How to submit a proposal</button>
			<button class="side-link side-sub" class:active={active === 'guide-objection'} onclick={() => select('guide-objection')}>How to object well</button>
		</nav>
	</aside>

	<main class="body" bind:this={pane}>
		{#if active === 'start'}
			<section>
				<h1>Documentation</h1>
				<p>Welcome to dyad's documentation. You do not need to be a member to read any of this. If you are considering joining, this is a good place to learn how the community works, how membership functions, which documents govern us, and how we make decisions together. Everything that defines dyad as an organization lives here.</p>
				<p><strong>Community</strong> holds our origin story, community care, our privacy commitments, and how becoming a member works. <strong>Governance</strong> holds the three working documents that formally define us (the Bylaws, the Member Agreements, and the Community Standards) and how we practice, with step-by-step guides for taking part in decisions. <strong>Become a supporter</strong> holds what dyad is, why it exists, what we stand for, and why we ask.</p>
				<p>All three governing documents are working documents. They are starting points rather than final destinations, and they change through the consent process they describe. Ratifying them with the founding members is the first consent round.</p>
				<p>If you have a question that is not answered here, write to <a href="mailto:hello@dyad.berlin">hello@dyad.berlin</a>.</p>
				<h3>Attribution and licence</h3>
				<p>These documents adapt, with gratitude, from the published governance work of <a href="https://www.subvert.fm/">Subvert Cooperative</a>, <a href="https://inclusiveorg.net/">Inclusive Organizing</a>, <a href="https://blackskyweb.xyz/">Blacksky</a>, Glitch, and the <a href="https://democratictech.fund/">Democratic Tech Fund</a>'s Code of Co-operation. In the same spirit, dyad's governing documents are shared under <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>: adapt them for your own community, with attribution.</p>
			</section>
		{:else if active === 'support-us'}
			<section>
				<p class="doc-kicker">Become a supporter</p>
				<h2>Become a supporter</h2>

				<h3>What dyad is</h3>
				<p>dyad is a web application to start and surface face to face conversations, held and governed by the community that uses it. You bring a conversation, something that has been on your mind. We surface the people thinking about it too. You meet them in person, chosen and unhurried, on your own terms.</p>

				<h3>Why it exists</h3>
				<p>We did not like how being social online felt. The platforms we met on left little room for our humanity, no room for the complexity of what we carry or the meaning we make of it together. So we built a way back to something older: conversation, in person, as how we find our way.</p>
				<p>We are in service to connection and collective sensemaking, and to a horizon where the capability and the wealth a community generates stay with the community.</p>

				<h3>What we stand for</h3>
				<p>We take care as seriously as the awareness teams working the door and the floor at the clubs that raised half of Berlin. Someone is always looking out. Nobody is judged for what they need. Harm is met with support first, and punishment last.</p>
				<ul>
					<li><strong>Self-determination.</strong> Nobody here decides for you what help looks like, who you are, or what you should want. You choose your rate, your pace, and your exit. We ask. We do not assume.</li>
					<li><strong>Transparency.</strong> Governance you cannot see is not governance. Every decision is logged where members can read it, and once membership sustains it, the founders' pay becomes an open line item too. We do not ask for your trust. We work to earn it.</li>
					<li><strong>Interdependency.</strong> We understand, acknowledge and respect the interdependencies that make our lives rich. Nobody meets, thinks, or builds alone here, and the health of the community is everyone's work, not one team's.</li>
					<li><strong>Economic democracy.</strong> The mission governs the money, not the other way around. Paying is a choice, never a condition of belonging, and what a community generates stays with the community.</li>
				</ul>
				<p>We do not allow harassment, discrimination, coercion, or the exploitation of anyone's trust for someone else's extraction. In Berlin this is not abstract, and we name it plainly in our <button class="inline-link" onclick={() => select('standards')}>Community Standards</button>, along with exactly what happens when it occurs.</p>

				<h3>Why support us</h3>
				<p>dyad is an independent startup, built so far by a team working voluntarily. Paying is a choice, and when you choose to, your contribution is what keeps dyad answering to the people in the room instead of to advertisers or investors chasing growth at any cost.</p>
				<p>If five hundred of us choose to support dyad financially by the end of August, at whatever rate fits your life, €7, €12, or €17 a month, we stay independent in pursuing the future we are already seeding: a social technology in service to connection and collective sensemaking, held by the people who build and use it. Becoming a supporting member is one of the clearest ways to shape what happens next.</p>
				<p class="doc-note">Becoming a member does not go through a gate where we accept or decline you. You read and agree to the <button class="inline-link" onclick={() => select('standards')}>Community Standards</button> and the <button class="inline-link" onclick={() => select('agreements')}>Member Agreements</button>, choose a rate that fits you, or none, and you are in.</p>
				<p><a class="support-cta" href="/become-a-member">Become a member →</a></p>
			</section>
		{:else if active === 'about-why'}
			<section>
				<p class="doc-kicker">Community</p>
				<h2>Our origin story</h2>
				<p>Over the past two years now, we have been meticulously at work. Working first to understand how we arrived at a digital environment that feels so intrusive, hostile, exhausting, and then, working on something precious, full of life by virtue of serving the life within. Dyad is the product of such care and intention.</p>
				<p>We did not like how being social online felt. The platforms we meet on left little room for our humanity. We are stripped down to a certain version of ourselves, and not the version we wanted to come forth. There was no room for the complexity of our experiences, the intricacy of making sense of them, and with that, discovering and nurturing the meaning of our lives. Where do you go online to expand, deepen, texture?</p>
				<p>A face to face conversation is part of the oral culture we only recently parted ways with. Stories and conversations have so long been how we weave parts of us together. And we wanted to give way to more of them.</p>
				<h3>Where dyad comes from</h3>
				<p>Dyad started as Dare. We designed an ugly duckling version of what we had in mind online and invited people to curated conversations. A topic, a question and four to eight people who wanted to meet for that. Our first users, two hundred of them, have taken something so humble, the private alpha of our product, and turned it into something extraordinary.</p>
				<p>Over a hundred conversations, all across Berlin. We were flooded with people who had felt what we felt to begin with. We connected, conversed, and brought layers to our thinking behind the product.</p>
				<p>Dyad is now in its private beta and opens in Berlin for one-on-one conversations. We have a vision for an ecosystem in service to connection and collective sensemaking that brightens up our eyes every time we zoom out and circle back. That is to say, Dyad, the app to start and surface face to face conversations is only the beginning.</p>
				<h3>Decisions worth voicing</h3>
				<p>Although simple at face value, there is not a single decision that went into the making of Dyad that we have not deliberately thought about. A select few are worth voicing.</p>
				<p>Dyad is a hyper local, curated network. This is among the many decisions we took to bend the overwhelm of the internet. The March 2026 verdicts against Meta and YouTube are the culmination of decades of work on digital rights and privacy and affirm that platform design is intentional and liable to its effects. With that, we situate ourselves within a countermovement to the commodification and surveillance of our social lives.</p>
				<p>How a platform is owned decides what it becomes. Social platforms begin with a niche, do great service, and end up extractive because traditional corporate models cannot keep operational decisions separate from shareholder interests. We are building dyad so that the mission governs the money, not the other way around: participatorily, with the people who use it, and in the open. It is our acts rather than our words that make the difference with such critical considerations.</p>
				<p>Dyad is built on a framework that follows the open and decentralised original intentions of the web. The fact that we do not yet own the data we create online and how little we know and can affect of the collection, archival, and usage of this information is absolutely bonkers. We nest ourselves in the movement towards open, decentralised infrastructure that makes these matters right.</p>
				<p>We feel that in speaking our minds as we build Dyad, we give the most honest insider view into what is happening inside the community. If you feel spoken to, join us still early in the way and let's talk.</p>
				<p>With care and joy,<br>Luna</p>
			</section>
		{:else if active === 'about-governance'}
			<section>
				<p class="doc-kicker">Governance</p>
				<h2>How we practice</h2>
				<p>Online spaces have become places we live in, but not places we govern. Rules change without participation, moderation happens behind closed doors, and the people most affected rarely shape decisions. dyad does it differently, and it starts small enough to actually do it.</p>
				<h3>How we practice</h3>
				<p>We begin with the least governance that is real: four practices, running from day one.</p>
				<ul>
					<li><strong>Proposals, open to every member.</strong> Any member can propose a change to how the community works. A proposal is a few written sentences, not a procedure.</li>
					<li><strong>Consent, not voting.</strong> A proposal passes unless someone raises a reasoned objection, meaning a specific claim that it causes harm or breaks an agreement we made. Preferences are input rather than vetoes. Nothing needs a majority, and nobody can block a proposal on taste alone.</li>
					<li><strong>A public decision log.</strong> Every proposal, objection, and outcome is written down where all members can read it. Governance you cannot see is not governance.</li>
					<li><strong>State of dyad, quarterly.</strong> The team shares what it decided and why, including, once membership sustains it, what the founders are paid.</li>
				</ul>
				<p>We add more structure only when a real and recurring pain demands it, and never in advance. That is the whole model.</p>
				<h3>Who decides what</h3>
				<p>Not everything goes through a consent round. Some decisions need to move at the speed of the day, and forcing them through process would serve nobody. Decisions live in three lanes.</p>
				<ul>
					<li><strong>Members decide together.</strong> Community standards and moderation policy. Who can join and how. What gets programmed and curated. The community budget. Removing a member, which is never one person's call and always a review by members with a right to appeal.</li>
					<li><strong>The team decides.</strong> Money, hiring, product direction, and legal matters. Members are told what was decided and why, at the State of dyad, in writing, and they are never surprised by it after the fact.</li>
					<li><strong>Whoever holds the role acts.</strong> Hosting an event, moderating by the agreed standards, welcoming someone new. Consent applies to the rules, not to every action taken inside them.</li>
				</ul>
				<p>One lever keeps the lanes honest: if enough members petition on any topic, including the team's own decisions, the team must answer in writing within 14 days.</p>
				<p>The mechanics live in the governing documents in this documentation: the <button class="inline-link" onclick={() => select('bylaws')}>Bylaws</button>, the <button class="inline-link" onclick={() => select('agreements')}>Member Agreements</button>, and the <button class="inline-link" onclick={() => select('standards')}>Community Standards</button>. The step-by-step decision flow is under <button class="inline-link" onclick={() => select('process-decision')}>Processes</button>.</p>
			</section>
		{:else if active === 'about-care'}
			<section>
				<p class="doc-kicker">Community</p>
				<h2>Community care</h2>

				<h3>Holding space online</h3>
				<p>The exhaustion, hostility, harm, and erosion of trust we have experienced and witnessed online are not abstract to us. They have been foundational parts of why Dyad exists.</p>
				<p>The places where we meet others online are part of public life. They may not look like streets, libraries, or community spaces, but they increasingly serve similar functions. People gather there, speak there, organize there, disagree there, find belonging there, and become visible to one another there. Yet our language, principles, and practices for public space, civic responsibility, and communal care have not caught up.</p>
				<p>Communal living has always come with shared understandings, boundaries, agreements, and forms of accountability. The digital realm will not be an exception. Consideration of safeguarding cannot be secondary.</p>
				<p>The current status quo exists in large part because a handful of platforms moved fast and broke things before public awareness and the institutions traditionally responsible for the public interest could catch up. Taking stock of the first twenty years of interactive life online, we need accountable practices, serious follow-through, and structures that do not leave care dependent on goodwill alone.</p>
				<p>We looked closely at Blacksky and Glitch as we began shaping the first set of practices we want to experiment with. So in all our effort to be good hosts, we begin with responsibility, not certainty.</p>

				<h3>Centering those who are most exposed</h3>
				<p>We are inspired by Glitch's principle that safety infrastructure should be designed from the margins inward, not the centre outward. Designing for the most exposed member raises the floor for everyone, while designing for the average member protects only those already protected. This means paying particular attention to the experiences of people who are more likely to encounter harassment and discrimination.</p>

				<h3>Structural safeguards &amp; processes</h3>
				<p>We have placed our trust in technology companies enough times to know that goodwill and original intentions are not a sufficient safeguard. Founders change, teams change, investors arrive, and priorities shift. Rather than asking members to trust us indefinitely, we aim to create a system that requires as little blind trust as possible.</p>
				<p>Open source infrastructure, transparent governance, and community participation are all attempts to distribute power, increase accountability, and reduce dependence on any single group of people; including ourselves.</p>

				<h3>Shared stewardship</h3>
				<p>Healthy communities are maintained by the people who participate in them. While the team currently holds the responsibility for moderation, we do not believe trust and safety should remain the responsibility of a small group indefinitely.</p>
				<p>We are interested in developing mechanisms through which members can help maintain community standards, participate in moderation processes, provide feedback on difficult cases, and contribute to the evolution of the community. Our goal is to create a culture in which stewardship is shared and responsibility for the health of the community gradually becomes distributed across the people who inhabit it.</p>

				<h3>Transparency &amp; iterations</h3>
				<p>No trust and safety system will ever be done and complete. As the community grows, new challenges will emerge and existing approaches will need to evolve. We understand that trust is not something that can be claimed; it is something that must be earned repeatedly through accountability and practice.</p>
				<p>With our first year of operations, we will publish disaggregated data in our transparency reports, on reports made, actions taken, and their outcomes, broken down by the identity dimensions relevant to intersectional harm.</p>

				<h3>Community guidelines</h3>
				<p>Dyad exists to help people meet for meaningful in-person conversations. The purpose of our guidelines is not ideological conformity. It is to create the conditions for encounters across difference, which cannot happen without a baseline of mutual care.</p>
				<p>We ask members to approach one another with curiosity, reciprocity, respect, consent, and accountability. Members should be able to disagree, ask difficult questions, and bring different experiences into conversation without being harassed, coerced, exposed, or exploited.</p>
				<p>We do not allow harassment, discrimination, coercion, abuse, doxing, privacy violations, non-consensual behavior, spam, impersonation, weaponized reporting, or unsafe conduct. We also do not allow behavior that targets people on the basis of race, gender, sexuality, disability, nationality, religion, class, body, or other protected or vulnerable dimensions of identity. These categories will become more specific as we learn from actual reports and community feedback.</p>

				<h3>Moderation</h3>
				<p><strong>Reporting.</strong> Members will be able to report content, behavior, or in-person encounters that violate our guidelines. Reports should include context where possible, so moderators can understand what happened without relying on assumptions. We will encourage reporting through the proper channels rather than public escalation that may amplify harm.</p>
				<p><strong>Moderation labels.</strong> Reports will be reviewed against a small set of moderation labels, each with a public definition, examples, possible consequences, and a path to appeal. Blacksky's model is grounded in the principle that communities closest to harm are best positioned to name it, and we are drawing from this approach.</p>
				<p><strong>Team review &amp; consequences.</strong> Our team is currently responsible for reviewing reports, assessing harm, and deciding whether action is needed. Consequences should be proportionate and may include a warning, temporary restriction, removal from a community, suspension, or removal from the wider community. Unclear cases will not be decided alone or in haste; we will document our reasoning.</p>
				<p><strong>Appeals.</strong> Members affected by a moderation decision should be told what action was taken, why it was taken, and how they can contest it. Appeals should be reviewed by someone other than the person who made the original decision wherever possible.</p>
				<p>The formal enforcement process, step by step, lives in the <button class="inline-link" onclick={() => select('standards')}>Community Standards</button>.</p>

				<h3>In-person safety &amp; privacy</h3>
				<p>Dyad exists to help people meet offline, so trust and safety cannot stop at the screen. Location, consent, no-shows, unwanted contact, and unsafe behavior around meetings all require careful handling. Our starting point is to reveal location gradually, allow members to report unsafe conduct around meetings, and treat post-conversation feedback as part of participation.</p>
				<p>Trust and safety cannot mean surveillance in softer language. Our refusal to collect unnecessary personal data is part of our commitment to member autonomy. We will not sell personal data, use it for advertising, or collect more than we need to operate the service responsibly.</p>

				<h3>Living guidelines</h3>
				<p>These guidelines are living documents. They will change as the community grows, as new harms become visible, and as we learn what our current process fails to see. Updates to guidelines, labels, moderation processes, and appeals will be recorded in a public changelog, so members can follow the evolution of the process with ease.</p>
			</section>
		{:else if active === 'privacy'}
			<section>
				<p class="doc-kicker">Community</p>
				<h2>Privacy commitments</h2>
				<p class="doc-note">The plain-language version of how we treat your data. The legal version lives in the <a href="/datenschutz">Datenschutzerklärung</a>; if the two ever disagree, tell us, because they should not.</p>
				<ul>
					<li><strong>We hold as little as possible.</strong> Our safety architecture depends on it: we cannot leak, sell, or be forced to hand over what we never collected. We collect only what the service needs to run responsibly.</li>
					<li><strong>We never sell personal data, and we never use it for advertising.</strong> There are no advertisers to serve and there never will be.</li>
					<li><strong>Disclosure only with your consent, or where the law compels us.</strong> Every use of that legal exception is logged and explained to members afterwards, under the Bylaws' reserved powers.</li>
					<li><strong>Trust and safety will not become surveillance in softer language.</strong> We look for patterns of harm through reports and aggregated signals, not by tracking people.</li>
					<li><strong>Your data does not lock you in.</strong> Sign-in works without our database provider, including with an open, portable network identity, and leaving dyad does not strand anything that is yours.</li>
				</ul>
			</section>
		{:else if active === 'bylaws'}
			<section>
				<p class="doc-kicker">Governance · governing document · 01 · v0.1 · a working document</p>
				<h2>Bylaws</h2>
				<p class="doc-note">These Bylaws are a working document. They are a starting point rather than a final destination, and they change through the consent process they themselves describe. This is the one document that governs all the others: it says who decides what, and how the rules can change.</p>

				<h3>1. Purpose</h3>
				<p>dyad exists for people who seek to meet others and want to do it their way, in an environment nurtured, built and designed by a team that genuinely cares about doing it participatorily, cares about human development and flourishing, and stays in service to connection, collective sensemaking and community. These Bylaws exist so that the people who make dyad alive, its members, genuinely co-design it, and so that the line between what members decide and what the team decides is public, explicit, and never arbitrary. Our horizon is an ecosystem in service to connection and collective sensemaking, in which the capability and the wealth a community generates stay with the community.</p>

				<h3>2. Principles</h3>
				<ul>
					<li><strong>Consent over control.</strong> Within member domains, a decision passes unless someone raises a reasoned objection. It does not need a majority, and it cannot be imposed by decree.</li>
					<li><strong>Plain language.</strong> Every governing document is written to be read. If a rule cannot be explained simply, it is not ready.</li>
					<li><strong>Reversibility.</strong> Every rule can be unmade the same way it was made.</li>
					<li><strong>Minimum viable governance.</strong> We add structure only when a real and recurring pain demands it, and never in advance.</li>
					<li><strong>Honesty about power.</strong> dyad is an independent startup, built so far by a team working voluntarily. Members do not own the company. What members do own is the community's rules, culture, and program, and this document is the team's binding commitment to that. We do not ask for trust; this document is how we work to earn it.</li>
				</ul>

				<h3>3. Decision rights</h3>
				<ul>
					<li><strong>Strategic decisions are made by the team.</strong> These cover fundraising, hiring, pricing, runway, product direction, brand, and funded partnerships. Members are informed of every strategic decision, together with its reasoning, at the quarterly State of dyad.</li>
					<li><strong>Tactical decisions are made by members, by consent.</strong> These cover community standards and moderation policy, membership criteria and onboarding, programming and curation, the community budget, and the removal of a member through the review process in the Community Standards.</li>
					<li><strong>Operational actions are taken by whoever holds the role.</strong> A person holding a role acts within agreed policy without asking a group. Consent applies to policies, not to individual actions.</li>
				</ul>

				<h3>4. The consent process</h3>
				<ol>
					<li>Any active member posts a proposal in a tactical domain to the proposal channel.</li>
					<li>The consent round runs for 72 hours. Bylaws amendments run for two weeks.</li>
					<li>The proposal passes unless an active member raises a reasoned objection, meaning a specific claim that the proposal causes harm or breaks an existing agreement. Preferences and taste are input, not vetoes.</li>
					<li>Objections are resolved by amending the proposal, or the proposal is withdrawn.</li>
					<li>Every outcome, whether passed, amended, or withdrawn, is recorded in the public decision log.</li>
				</ol>

				<h3>5. The petition</h3>
				<p>If ⟨20%⟩ of active members co-sign a petition on any topic, including a strategic one, the team must answer it in writing within 14 days and discuss it at the next State of dyad. The team keeps the strategic decision, but it cannot keep silence.</p>

				<h3>6. Reserved powers</h3>
				<p>The team retains, at all times: removals required by law, urgent action against a credible safety threat, and protection of member data. Every use of reserved powers is logged and explained to members after the fact.</p>

				<h3>7. Transparency obligations</h3>
				<ul>
					<li>Quarterly State of dyad: strategic decisions and their reasoning, membership numbers, and, once membership sustains it, the founder wage as an open line item.</li>
					<li>The decision log is public to all members.</li>
					<li>All governing documents are versioned with a changelog.</li>
				</ul>

				<h3>8. Amending these Bylaws</h3>
				<p>Bylaws amendments are proposed like any proposal, but the consent round runs two weeks and requires the participation of at least ⟨25%⟩ of active members to be valid. The team cannot amend the Bylaws unilaterally, and neither can any single member.</p>

				<h3>9. How governance grows</h3>
				<p>Governance deepens in phases tied to real thresholds rather than promises. In Phase 0, a founding cohort of roughly 8 to 15 governance-active members ratifies these documents and runs the consent process, the decision log, and a small community budget pilot. In Phase 1, at around ⟨100⟩ paying members, member-reviewers take over membership applications and a standards and moderation working group forms. In Phase 2, at around 250 paying members, the founder draws a living wage declared openly as a line item, the community budget scales, the petition threshold drops to ⟨10%⟩, and the first stewards are elected for fixed, recallable terms. In Phase 3, the members decide by consent whether dyad's community side takes formal legal form. Nothing in Phase 3 is promised, except that the question itself belongs to the members when the time comes.</p>

				<h3>10. Definitions</h3>
				<dl>
					<dt>Member</dt><dd>A person admitted under the Member Agreements. One member, one voice.</dd>
					<dt>Active member</dt><dd>A member who has engaged with dyad in the past 12 months. Paying is not part of this definition. Only active members count toward consent rounds, panels, petitions, and quorums.</dd>
					<dt>Steward</dt><dd>A member holding a named responsibility, such as moderation, hosting, or onboarding. Stewards act within agreed policy. They hold roles, not rank.</dd>
					<dt>Proposal</dt><dd>A written suggestion to change something in a tactical domain, posted to the proposal channel.</dd>
					<dt>Consent</dt><dd>The absence of reasoned objection after a full consent round. Consent does not mean enthusiasm or majority approval. It means the group considers the proposal safe to try.</dd>
					<dt>Reasoned objection</dt><dd>A specific claim that a proposal causes harm or breaks an existing agreement. A preference is input; it is not an objection.</dd>
					<dt>Consent round</dt><dd>The 72-hour window in which active members may object to a proposal. Bylaws changes run for two weeks instead.</dd>
					<dt>Decision log</dt><dd>The public, append-only record of every proposal, objection, outcome, and use of reserved powers.</dd>
					<dt>Petition</dt><dd>The members' lever on strategic topics. When the signature threshold is reached, the team must respond in writing within 14 days.</dd>
					<dt>Review panel</dt><dd>Members drawn by lot, joined by one steward, who decide suspensions, removals, and appeals. No individual removes a member alone, and that includes the founders.</dd>
				</dl>
			</section>
		{:else if active === 'agreements'}
			<section>
				<p class="doc-kicker">Governance · governing document · 02 · v0.1 · a working document</p>
				<h2>Member Agreements</h2>
				<p class="doc-note">Who can join, how joining works, and your personal deal with dyad. The Bylaws are the constitution; this document covers the practical day-to-day of being a member. It can be updated by the team with 14 days' notice, and if you disagree with a change you can leave before it applies to you.</p>

				<h3>1. Who can become a member</h3>
				<p>There is no community for everyone in the world. This one is for people who value and seek a community of people curious about others, people who understand, acknowledge and respect the interdependencies that make our lives rich. The request-to-join step exists to welcome people who align with our Community Standards. It considers what you value, never who you are. Membership does not require paying.</p>
				<p>Membership is open to anyone who seeks that and who agrees to the Community Standards and these Member Agreements, and completes onboarding: the definitions, the Bylaws in brief, and a welcome conversation with an existing member.</p>

				<h3>2. How applications are reviewed</h3>
				<p>Applications are reviewed by ⟨2⟩ member-reviewers, recruited from the membership and compensated for their time, against the published criteria above. Reviewers judge only against the criteria, and never against personal taste, artistic merit, follower counts, or status. Until there are enough members to fill this role, the founding cohort reviews applications.</p>

				<h3>3. If an application is declined</h3>
				<p>A first decline comes with specific guidance on what was missing. A second decline unlocks an appeal, in writing or in person, to the reviewers plus one steward. Reapplying is always allowed, at any time.</p>

				<h3>4. Active status</h3>
				<p>You are an active member, with a voice in consent rounds, panels, and the budget, for as long as you have engaged with dyad at least once in the past ⟨12 months⟩. Attending, proposing, voting, and contributing all count, and the bar is deliberately low. Paying is not a condition of voice: a paying member and a non-paying member hold exactly one voice each.</p>
				<p>Members who drift away become inactive. Their voice pauses, quorums do not count them, and nothing else changes. Re-engaging restores active status automatically, with no reapplication and no questions asked.</p>

				<h3>5. What membership includes</h3>
				<ul>
					<li>Access to dyad's spaces, events, and programs;</li>
					<li>One voice, equal to every other member's, in all tactical domains under the Bylaws;</li>
					<li>Eligibility for member roles: reviewer, panelist, steward, host;</li>
					<li>The transparency rights in the Bylaws: the decision log and the quarterly State of dyad.</li>
				</ul>

				<h3>6. What you agree to</h3>
				<ul>
					<li>Follow the Community Standards and the Bylaws;</li>
					<li>Keep other members' non-public information confidential;</li>
					<li>If you choose to pay, and paying is a choice rather than a condition of membership, keep your contribution current at the rate you picked: {copy.membership.monthlySolidarityPrice}, {copy.membership.cadenceMonthlyPrice}, or {copy.membership.monthlySupporterPrice} monthly, {copy.membership.cadenceAnnualPrice} yearly, or {copy.membership.cadenceLifetimePrice} lifetime. The rate is your call, and we ask no questions about it.</li>
				</ul>

				<h3>7. What membership is not</h3>
				<ul>
					<li>Membership is not equity. Members do not own shares of dyad, have no claim on its assets or profits, and a contribution is not an investment with expectation of return.</li>
					<li>Membership is personal and non-transferable.</li>
					<li>Membership is not employment. Compensated member roles are agreed separately, case by case.</li>
					<li>Your voice operates through the Bylaws' mechanisms of consent rounds, panels, and petitions, and not through directing dyad's staff or operations individually.</li>
				</ul>

				<h3>8. Changes to this agreement</h3>
				<p>dyad may update this agreement with 14 days' written notice summarizing the changes. If you do not agree, you may end your membership before the changes take effect. Changes to contribution rates never apply retroactively, and existing members keep their rate for ⟨12 months⟩ after any increase.</p>

				<h3>9. Leaving and ending membership</h3>
				<p>Membership is voluntary, and you can leave at any time. Contributions already made are not refunded. Members who leave in good standing are always welcome back. dyad can end your membership only through the enforcement process in the Community Standards, and never unilaterally.</p>

				<h3>10. If dyad changes hands</h3>
				<p>If dyad is acquired, merged, or dissolved, this commitment survives: members are notified before the public, the community's decision log and agreements remain accessible to members, and any successor either honors the Bylaws or releases members from this agreement.</p>
			</section>
		{:else if active === 'standards'}
			<section>
				<p class="doc-kicker">Governance · governing document · 03 · v0.1 · a working document</p>
				<h2>Community Standards</h2>
				<p class="doc-note">This document says what we do not tolerate, where these rules apply, and exactly what happens when something goes wrong, step by step, so that enforcement never depends on one person's mood. Members amend it by consent round.</p>

				<h3>1. Who this community is for</h3>
				<p>dyad is for people who seek to meet others and want to do it their way. You bring a conversation, something that has been on your mind. We surface the people thinking about it too. You meet them in person.</p>
				<p>There is no community for everyone in the world. This one is for people who value and seek a community of people curious about others, people who understand, acknowledge and respect the interdependencies that make our lives rich. The rules that follow exist to protect exactly that.</p>

				<h3>2. The baseline</h3>
				<p>dyad is built on mutual respect and the dignity of everyone in the room: members, guests, hosts, and the people who work on dyad. Disagreement is welcome; contempt is not.</p>

				<h3>3. Commitments we make to one another</h3>
				<ul>
					<li><strong>We listen.</strong> When something has happened and someone is uncomfortable, our first choice is dialogue. We ask questions before making statements, we give people time to respond, and we adjust our behaviour when asked to, even when we do not fully understand why. Repeating behaviour after it has been addressed is itself disrespectful.</li>
					<li><strong>We practise active consent.</strong> This matters doubly in a community built on meeting in person. We ask before photographing or recording anyone at a meeting or event. We ask how people would like to be greeted. We respect everyone's right to end a conversation or leave a meeting at any time, without needing to explain why.</li>
					<li><strong>We engage in good faith, across languages.</strong> Berlin is a many-language city and many members are not conversing in their first language. We engage with what people actually said rather than with our assumptions, we never conflate fluency with intelligence or commitment, and we are patient with first mistakes and less patient with repetition.</li>
					<li><strong>We care for capacity.</strong> We respect people's limits, we do not pressure anyone to participate beyond what is sustainable, and we do not shame anyone for stepping back for a while. Care work is named and shared; it must not fall invisibly on the same people.</li>
				</ul>

				<h3>4. Prohibited conduct</h3>
				<ul>
					<li><strong>Hate and supremacy:</strong> content or conduct promoting the inherent superiority or inferiority of any group. This includes white supremacy and Nazism together with their recognized symbols and dog-whistles, anti-LGBTQ+ bigotry, misogyny, ableism, and religious hatred. In Berlin this is not abstract, and we name it.</li>
					<li><strong>Harassment:</strong> doxxing, stalking, credible threats, and targeted intimidation of any member or guest.</li>
					<li><strong>Misrepresentation:</strong> deceiving the community about who you are or what you made. This includes presenting someone else's work, or an undisclosed AI fabrication, as your own.</li>
					<li><strong>Exploitation of the commons:</strong> using dyad's spaces, member list, or trust for extraction, such as undisclosed selling, data harvesting, or recruitment into schemes.</li>
				</ul>

				<h3>5. Where these standards apply, and whom they cover</h3>
				<p>Our authority covers dyad's spaces: the app, meetings and events, online channels, and anywhere someone represents dyad publicly. They cover everyone present in those spaces: members, guests, hosts, partners at our events, and the team itself. We are not tasked with policing members' outside lives. dyad will act on off-community conduct only when it creates a direct, material risk to members' safety or to dyad's mission or legal standing.</p>

				<h3>6. Reporting a concern</h3>
				<p>Anyone can report content, behaviour, or an in-person encounter that violates these standards. Reports go to a steward, or to <a href="mailto:hello@dyad.berlin">hello@dyad.berlin</a>, in writing or in person. A report can also be made through a trusted third party, who can pass it on without naming you.</p>
				<p>Where you feel comfortable, include what happened, when and where, any witnesses, and what outcome you are hoping for. We acknowledge every report within 48 hours, we do not share your identity without your consent, and we keep you informed of progress.</p>
				<p>A report made in good faith that turns out not to be a violation is never held against the person who made it. Using the reporting system as a weapon against another member is itself a violation of these standards.</p>

				<h3>7. The enforcement process</h3>
				<p>Our aim is repair rather than punishment: repair of the harm done to a person, and of the trust that makes meeting strangers possible. Responses are proportionate, weighing the severity and pattern of the behaviour, its impact on the person harmed and the community, and the openness of the person responsible to acknowledging the harm. A first-time mistake is treated differently from repeated conduct. At the same time, we act decisively to protect safety.</p>
				<ol>
					<li><strong>Notice.</strong> A steward names the concern to the member privately, with reference to the specific standard. Most issues end here.</li>
					<li><strong>Conversation.</strong> If the concern recurs, there is a documented conversation about what changes and by when.</li>
					<li><strong>Review panel.</strong> Suspension or removal requires a panel of ⟨3⟩ active members, drawn by lot with conflicts excluded, plus one steward. No member is ever removed by the unilateral decision of a single person, and that includes the founders.</li>
					<li><strong>Right to be heard.</strong> The member speaks to the panel, in writing or in person, before any final decision is made.</li>
					<li><strong>Appeal.</strong> One appeal to a freshly drawn panel. Its decision holds for ⟨12 months⟩, and after that reapplying is open.</li>
				</ol>
				<p>Every case that reaches the review panel or beyond is recorded in the decision log, anonymized where safety requires it.</p>

				<h3>8. Exceptions</h3>
				<p>Removals required by law and urgent action against credible safety threats bypass this process. They are executed by the team under the Bylaws' reserved powers, then logged and explained.</p>

				<h3>9. Dignity of the people who work on dyad</h3>
				<p>The people building and hosting dyad are part of this community, not customer service. Abusive communication toward them violates these Standards exactly as it would toward any member.</p>
			</section>
		{:else if active === 'process-decision'}
			<section>
				<p class="doc-kicker">Governance · how we practice</p>
				<h2>How a decision is made</h2>
				<p>A proposal passes unless someone gives a reason that it causes harm or breaks an agreement. Preferences are input rather than vetoes. Every rule made this way can be unmade the same way.</p>
				<ol>
					<li><strong>Idea.</strong> Something should change. Any member may raise it.</li>
					<li><strong>Proposal.</strong> Written in a few plain sentences in the proposal channel: what changes, and why.</li>
					<li><strong>Consent round, 72 hours.</strong> Members read it. Anyone may object, with a reason. Bylaws changes run for two weeks.</li>
					<li><strong>Outcome.</strong> With no reasoned objection, the change is made and recorded in the decision log. With a reasoned objection, the proposer resolves it and the round runs again, or the proposal is withdrawn. That is logged as well.</li>
				</ol>
				<p>The full flow, together with who decides what, lives on the <a href="/governance">participatory governance page</a> as a diagram.</p>
			</section>
		{:else if active === 'process-joining'}
			<section>
				<p class="doc-kicker">Community</p>
				<h2>Becoming a member</h2>
				<h3>Who dyad is for</h3>
				<p>dyad is for people who seek to meet others and want to do it their way. You bring a conversation — something that has been on your mind. We surface the people thinking about it too. You meet them in person.</p>
				<p>The environment is nurtured, built and designed by a team that genuinely cares about doing it participatorily, and cares about human development and flourishing. That is not a slogan; it is the way the place is run, and the governance pages show exactly how.</p>
				<h3>How to join</h3>
				<p>There is no gate here where we decide to accept you or not. Joining is about alignment, not approval, and the alignment is yours to confirm.</p>
				<ol>
					<li><strong>Read and agree.</strong> The Community Standards and the Member Agreements, in full. Both are short enough to actually read.</li>
					<li><strong>Choose a rate, or none.</strong> Membership does not require paying. If you choose to, pick whatever fits your life.</li>
					<li><strong>Create your account.</strong> You are a member from that moment, with a voice equal to everyone else's.</li>
				</ol>
				<p><a class="support-cta" href="/become-a-member">Become a member →</a></p>
				<h3>Belonging &amp; membership</h3>
				<p>Membership does not require paying. Members who choose to pay — €7, €12 or €17 a month, whichever fits your life — are how the work stays independent: no ads, no data sales, nobody to answer to but the people in the room.</p>
				<p>Members are not customers. The rules, the program, the culture — members make them with us. There are two roles: <strong>members</strong>, who have a voice in the decisions that shape the community, and <strong>stewards</strong> — members entrusted with keeping things healthy: upholding shared norms, facilitating moderation, carrying out what was decided together.</p>
			</section>
		{:else if active === 'process-wrong'}
			<section>
				<p class="doc-kicker">Governance · how we practice</p>
				<h2>When something goes wrong</h2>
				<p>Enforcement is a procedure, not a mood. The five steps, from a private notice through a documented conversation, a review panel drawn by lot, the right to be heard, and an appeal, are written out in <button class="inline-link" onclick={() => select('standards')}>Community Standards, section 4</button>. No member is ever removed by the unilateral decision of a single person.</p>
			</section>
		{:else if active === 'guide-proposal'}
			<section>
				<p class="doc-kicker">Governance · how we practice</p>
				<h2>How to submit a proposal</h2>
				<p>Write a few plain sentences in the proposal channel: what should change, and why. You do not need a template, a seconder, or permission. If your proposal touches a tactical domain (standards, membership, programming, the community budget), the consent round starts when you post it. If it touches a team domain, it becomes a question the team answers in writing, and if enough members co-sign it as a petition, the team must answer within 14 days.</p>
			</section>
		{:else if active === 'guide-objection'}
			<section>
				<p class="doc-kicker">Governance · how we practice</p>
				<h2>How to object well</h2>
				<p>An objection is a gift when it is specific. Say which harm the proposal causes, or which existing agreement it breaks. "I would not do it this way" is a preference, and preferences are welcome as input, but they do not stop a proposal. If your objection is reasoned, the proposer must resolve it before the change can pass, so the clearer you are, the faster the resolution.</p>
			</section>
		{:else if active === 'guide-leaving'}
			<section>
				<p class="doc-kicker">Community</p>
				<h2>How to leave</h2>
				<p>Membership is voluntary, and you can leave at any time from your account, with no notice period and no conversation required. Contributions already made are not refunded. If you drift away instead of leaving, your voice simply pauses, and returning restores it automatically. Members who leave in good standing are always welcome back.</p>
			</section>
		{/if}
	</main>
</div>

<style>
	.docs {
		display: grid;
		grid-template-columns: 240px 1fr;
		gap: 56px;
		max-width: 1080px;
		margin: 0 auto;
		padding: 48px 48px 96px;
	}

	/* ── Sidebar ── */
	.side {
		border-right: 1px solid rgba(240, 236, 230, 0.08);
		padding-right: 32px;
	}
	.side-wordmark {
		display: block;
		font-family: var(--font-serif);
		font-size: 18px;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: rgba(240, 236, 230, 0.9);
		text-decoration: none;
		margin: 0 0 28px;
	}
	.side nav {
		position: sticky;
		top: 32px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}
	.side-top {
		font-weight: 500;
		color: rgba(240, 236, 230, 0.85) !important;
		margin-bottom: 8px;
	}
	.side-head {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(240, 236, 230, 0.35);
		margin: 20px 0 6px;
	}
	.side-link {
		font-family: var(--font-serif);
		font-size: 0.85rem;
		font-weight: 300;
		color: rgba(240, 236, 230, 0.5);
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		padding: 3px 0;
		line-height: 1.4;
		transition: color 0.15s;
	}
	.side-link:hover { color: rgba(240, 236, 230, 0.9); }
	.side-sub { padding-left: 14px; font-size: 0.8rem; }
	.side-link.active { color: rgba(240, 236, 230, 0.95); }

	/* ── Body ── */
	.body { min-width: 0; scroll-margin-top: 88px; }
	.body section { padding: 8px 0 40px; }

	h1 {
		font-family: var(--font-serif);
		font-size: 2rem;
		font-weight: 500;
		color: rgba(240, 236, 230, 0.9);
		margin: 0 0 20px;
	}
	h2 {
		font-family: var(--font-serif);
		font-size: 1.4rem;
		font-weight: 400;
		color: rgba(240, 236, 230, 0.88);
		margin: 0 0 16px;
	}
	h3 {
		font-family: var(--font-serif);
		font-size: 1rem;
		font-weight: 500;
		color: rgba(240, 236, 230, 0.8);
		margin: 28px 0 8px;
	}
	.doc-kicker {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(240, 236, 230, 0.35);
		margin: 0 0 10px;
	}
	.doc-note {
		font-family: var(--font-serif);
		font-style: italic;
		font-weight: 300;
		color: rgba(240, 236, 230, 0.5);
		border-left: 2px solid rgba(240, 236, 230, 0.12);
		padding: 4px 0 4px 20px;
		margin: 0 0 8px;
		line-height: 1.65;
		max-width: 62ch;
	}
	.support-cta {
		display: inline-block;
		font-family: var(--font-serif);
		font-size: 0.95rem;
		font-weight: 500;
		color: rgba(240, 236, 230, 0.92);
		background: rgba(240, 236, 230, 0.06);
		border: 1px solid rgba(240, 236, 230, 0.18);
		border-radius: 6px;
		padding: 10px 18px;
		text-decoration: none;
		margin: 4px 0 12px;
		transition: background 0.15s, border-color 0.15s;
	}
	.support-cta:hover {
		background: rgba(240, 236, 230, 0.12);
		border-color: rgba(240, 236, 230, 0.32);
	}
	p, li, dd {
		font-family: var(--font-serif);
		font-size: 0.92rem;
		font-weight: 300;
		color: rgba(240, 236, 230, 0.62);
		line-height: 1.7;
		max-width: 65ch;
	}
	p { margin: 0 0 14px; }
	ul, ol { padding-left: 22px; margin: 0 0 14px; }
	li { margin-bottom: 8px; }
	li strong, p strong { color: rgba(240, 236, 230, 0.8); font-weight: 500; }
	a { color: rgba(240, 236, 230, 0.8); text-decoration: underline; text-underline-offset: 3px; }
	a:hover { color: rgba(240, 236, 230, 1); }
	.inline-link {
		font-family: inherit;
		font-size: inherit;
		font-weight: inherit;
		color: rgba(240, 236, 230, 0.8);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.inline-link:hover { color: rgba(240, 236, 230, 1); }
	.deeper { margin-top: 24px; }
	dl { margin: 0; max-width: 65ch; }
	dt {
		font-family: var(--font-serif);
		font-weight: 500;
		color: rgba(240, 236, 230, 0.8);
		margin-top: 12px;
	}
	dd { margin: 2px 0 0; }

	@media (max-width: 860px) {
		.docs { grid-template-columns: 1fr; gap: 24px; padding: 24px 20px 64px; }
		.side { border-right: none; border-bottom: 1px solid rgba(240, 236, 230, 0.08); padding: 0 0 20px; }
		.side nav { position: static; }
	}
</style>
