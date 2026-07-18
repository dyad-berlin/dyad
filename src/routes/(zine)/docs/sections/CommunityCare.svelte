<script lang="ts">
	let { select }: { select: (id: string) => void } = $props();
</script>

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
