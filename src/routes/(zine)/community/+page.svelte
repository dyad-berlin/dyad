<script lang="ts">
	import { useTocScroll } from '$lib/utils/use-toc-scroll.svelte';
	import { copy } from '$lib/copy';

	const ids = ['intro', 'who', 'belonging', 'care'];
	const toc = useTocScroll(ids);
	const activeId = $derived(toc.activeId);
	const isPast = (id: string) => toc.isPast(id);
</script>

<svelte:head>
	<title>Community · dyad.</title>
	<meta name="description" content="dyad is a community of people who seek to meet others and do it their way — built participatorily, with care for human development and flourishing." />
</svelte:head>

<div class="page">

	<div class="page-intro">
		<p class="section-label">Community</p>
		<h1 class="page-title">A place made by the people in it.</h1>
	</div>

	<div class="page-body">

		<nav class="toc">
			<p class="toc-label">In this section</p>
			<ol class="toc-list">
				<li><a href="#who" class:active={activeId === 'who'} class:past={isPast('who')}>Who dyad is for</a></li>
				<li><a href="#belonging" class:active={activeId === 'belonging'} class:past={isPast('belonging')}>Belonging &amp; membership</a></li>
				<li><a href="#care" class:active={activeId === 'care'} class:past={isPast('care')}>Trust, safety &amp; community care</a></li>
			</ol>
		</nav>

		<div class="prose">

			<section id="intro">
				<p class="intro-text">We have been building dyad voluntarily, because we feel passionate about a way of meeting each other we could not find anywhere: chosen, unhurried, in person, on your own terms. We do not ask for trust — we work to earn it, in service to connection, collective sensemaking and community.</p>
			</section>

			<section id="who">
				<h2 class="section-h2">Who dyad is for</h2>
				<p>dyad is for people who seek to meet others and want to do it their way. You bring a conversation — something that has been on your mind. We surface the people thinking about it too. You meet them in person.</p>
				<p>The environment is nurtured, built and designed by a team that genuinely cares about doing it participatorily, and cares about human development and flourishing. That is not a slogan; it is the way the place is run, and the governance pages show exactly how.</p>
			</section>

			<section id="belonging">
				<h2 class="section-h2">Belonging &amp; membership</h2>
				<p>Becoming a member is by request — a few honest sentences, read by members against our community standards. The small friction is deliberate, and it is about alignment, never identity: there is no community for everyone, and this one is for people curious about others, who respect the interdependencies that make our lives rich.</p>
				<p>Membership does not require paying. Members who choose to pay — {copy.membership.monthlySolidarityPrice}, {copy.membership.cadenceMonthlyPrice} or {copy.membership.monthlySupporterPrice} a month, whichever fits your life — are how the work stays independent: no ads, no data sales, nobody to answer to but the people in the room.</p>
				<p>Members are not customers. The rules, the program, the culture — members make them with us. There are two roles: <strong>members</strong>, who have a voice in the decisions that shape the community, and <strong>stewards</strong> — members entrusted with keeping things healthy: upholding shared norms, facilitating moderation, carrying out what was decided together.</p>
			</section>

			<section id="care">
				<h2 class="section-h2">Trust, safety &amp; community care</h2>
				<p>Meeting strangers requires a place that takes care seriously. We hold space deliberately: clear community standards written with members, moderation done in the open by the agreed rules, and no member ever removed by one person's unilateral decision.</p>
				<p class="care-link-line"><a href="/community-care" class="care-link">Read how we practice trust, safety &amp; community care →</a></p>
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

	.care-link-line { margin-top: 24px; }

	.care-link {
		font-family: var(--font-serif);
		color: rgba(240, 236, 230, 0.8);
		text-decoration: none;
		border-bottom: 1px solid rgba(240, 236, 230, 0.25);
		padding-bottom: 2px;
		transition: border-color 0.15s;
	}
	.care-link:hover { border-color: rgba(240, 236, 230, 0.7); }
</style>
