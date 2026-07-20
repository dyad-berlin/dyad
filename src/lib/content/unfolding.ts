// Unfolding — dyad's weekly newsletter. One entry here is one published
// essay at /unfolding/[slug]. Extracted to a single data module because
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
}

export const unfoldingEntries: UnfoldingEntry[] = [
	{
		slug: 'conversation-is-a-fundamental-technology',
		kicker: 'Origin story · post 1',
		title: 'Conversation is a fundamental technology for sensemaking',
		quote: 'We humanize what is going on in the world and in ourselves only by speaking of it.',
		quoteAttr: 'Hannah Arendt, Men in Dark Times',
		date: '2026-06-08',
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
