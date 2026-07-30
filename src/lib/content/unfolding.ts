// Unfolding — dyad's weekly newsletter. One entry here is one published
// essay at /newsletter/[slug]. Extracted to a single data module because
// the same entries back both the archive index and the individual pages.
//
// We publish weekly and are only getting started: this file holds
// published posts only. Drafts pulled from the zine live on the
// unfolding-drafts-full branch (fork only — never opens upstream) until
// their week comes.

export interface UnfoldingEntry {
	slug: string;
	kicker: string; // zine chapter this essay is drawn from
	title: string;
	dek?: string; // optional subtitle, shown under the title
	quote: string;
	quoteAttr?: string; // omitted when the quote is dyad's own words
	date: string; // ISO date, published date
	paragraphs: string[];
	// Hero image path within the "newsletter assets" Supabase bucket. Falls
	// back to the textured placeholder panel when unset.
	heroImage?: string;
	heroCredit?: string; // photo credit, shown bottom-right under the image
	heroCreditUrl?: string; // link target for heroCredit, e.g. the artist's profile
}

// Newest posted entry always goes first — the archive page takes featured +
// grid order directly from this array (no date sort).
export const unfoldingEntries: UnfoldingEntry[] = [
	{
		slug: 'a-systemic-diagnosis-zine',
		kicker: 'Problem · diagnosis (Zine version, for review)',
		title: 'From symptoms to systems: Diagnosing the harm of social web landscape',
		quote: 'A problem well stated is a problem half solved.',
		quoteAttr: 'Charles F. Kettering',
		date: '2026-07-29',
		paragraphs: [
			'Climate online has grown increasingly commodified, and hostile. The desire to connect and exchange, once held as the emancipatory promise of the World Wide Web, is now met by systems that capture and translate our lives into data, extracting from our relationships, expressions, and attention in ways that mirror colonial patterns of exploitation. For many of us, the internet has become a source of stress, overwhelm, and abuse. These harms fall first and hardest on people who are marginalized by collective structures of oppression, but the systems that produce them reorder life for everyone.',
			"The scale and scope of the harm is difficult to overstate here. From loneliness and declining mental health, to information warfare, political polarization, the erosion of trust in institutions, and democratic instability, the effects of opaque and self-serving social technology corporations' operations increasingly reach far beyond the screen. The move from our own lived experience into a deeper study of how these systems work brought about the realization that these platforms are not accidentally producing these outcomes.",
			'They are working exactly as they were built to work. Once behavioral data was identified as a new frontier of extraction, platforms developed increasingly sophisticated ways to capture, repurpose, and sell it, with consent reduced to an unreadable ritual demanded as the price of participation. In the process, they ceased to be social technologies serving the people who use them and became surveillance machinery built to profit from prediction, attention capture, and ultimately, behavior manipulation.',
			'In this state of disillusionment, we kept peeling back the layers. From seemingly small design decisions to the metrics beneath them, the revenue models they serve, and in effect, the ownership and governance structures that allows for and perpetuate this extractive behavior. We encountered incentives, concentrations of power, and forms of decision-making that remained largely invisible to the people most affected by them.',
			'This brought us to a simple conviction: The problem with the status quo of social technologies is systemic, and so must be the response.',
			'We are therefore not interested in one-off interventions, nor in building a gentler interface on top of the same underlying logic. Our approach here is to surface what is least seen. Who owns the platforms we meet on? What incentives does that ownership create? What kinds of design decisions follow from those incentives? What behaviors do those designs allow for, reward, or distort? Who benefits from the system as it runs now? Who is harmed by it? Who can inspect its workings, contest its decisions, and shape it back?',
			'Looking to previous struggles for liberation, civil rights, and social justice, we find a common lesson. Durable change begins by understanding the forces that produce a problem, and is carried forward through sustained collective action. It is within this long arc that we position our work and our commitment to building social technology in service of community and collective sensemaking, with safeguards embedded in its code and operations through open-source infrastructure, collective ownership, and participatory governance.'
		],
		heroImage: 'newsletter cover asset, post 2.jpg',
		heroCredit: 'Volume Rendering CT Scans by voxel123',
		heroCreditUrl: 'https://www.flickr.com/photos/voxel123/'
	},
	{
		slug: 'conversation-is-a-fundamental-technology',
		kicker: 'Origin story · post 1',
		title: 'Conversation: A primal technology for sensemaking',
		quote: 'We humanize what is going on in the world and in ourselves only by speaking of it.',
		quoteAttr: 'Hannah Arendt, Men in Dark Times',
		date: '2026-07-20',
		paragraphs: [
			'Over the past two years now, we have been meticulously at work. Working first to understand how we arrived at a digital environment that feels so intrusive, hostile, exhausting, and then to build new world precious, full of life by virtue of serving the life within. Dyad is the product of such care and intention.',
			'We did not like how being social online felt. We lacked the humanity the platforms we meet on allowed for. We are stripped down to a certain version of ourselves, and not the version we wanted to come forth. The complexity of our experiences, the intricacy of making sense of them, and with that, discovering and nurturing the meaning of our lives.',
			'Where do you go online to expand, deepen, texture?',
			'A face to face conversation is part of the oral culture we only recently parted ways with. Stories and conversations have so long been how we weave parts of us together. With Dyad, we want to give way to more of them, initiated and discovered on our collectively consented terms.',
			'Dyad started as Dare. We designed an ugly duckling version of what we had in mind online and invited people to curated conversations. A topic, a question and four to eight people who wanted to meet to talk about it. Our first users, two hundred of them, have taken something so humble, and turned it into something extraordinary.',
			'Over a hundred conversations, all across Berlin. We were flooded with people who had felt what we felt to begin with. We connected, conversed, and brought layers to our thinking behind the product, the editorial, and our public programming.',
			'Dyad is now on its private beta and opens in Berlin for face to face conversations. We have a vision for an ecosystem in service to community and collective sensemaking. That is to say, Dyad, the web app to start and surface face to face conversations, is only the beginning.'
		],
		heroImage: 'newsletter cover asset, post 1.webp',
		heroCredit: 'Charts Of The Soul by illustrator Peter Goodfellow for Omni magazine, 1983.'
	}
];

export function getUnfoldingEntry(slug: string): UnfoldingEntry | undefined {
	return unfoldingEntries.find((e) => e.slug === slug);
}
