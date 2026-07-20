<script lang="ts">
	import MembershipInvite from '$lib/components/MembershipInvite.svelte';

	let { select }: { select: (id: string) => void } = $props();
</script>

<section>
	<p class="doc-kicker">Become a member</p>
	<h2>Become a member</h2>

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
</section>

<MembershipInvite />
