// Unfolding — dyad's weekly newsletter. One entry here is one published
// essay at /newsletter/[slug]. Extracted to a single data module because
// the same entries back both the archive index and the individual pages.
//
// We publish weekly and are only getting started: this file holds
// published posts only. Drafts pulled from the zine live on the
// unfolding-drafts-full branch (fork only — never opens upstream) until
// their week comes.

// The entry type lives with the content boundary, not the data module, so it
// survives this module's eventual retirement. Type-only import: no runtime
// cycle with content.ts importing the data below.
import type { UnfoldingEntry } from '$lib/services/content';

export type { UnfoldingEntry };

// Newest posted entry always goes first — the archive page takes featured +
// grid order directly from this array (no date sort).
export const unfoldingEntries: UnfoldingEntry[] = [
	{
		slug: 'ownership',
		kicker: 'Steward Ownership',
		title: 'Collective ownership to mature our sense of progress',
		quote: 'Ownership determines whose interests prevail.',
		quoteAttr: 'Marjorie Kelly',
		date: '2026-08-04',
		heroImage: 'newsletter cover asset, post 3.webp',
		heroCredit: 'Mercer Hotel bees by Bobby Doherty for At Large Magazine',
		paragraphs: [
			"In July 2024, [The Consilience Project](https://consilienceproject.org/) published one of the clearest, most consequential accounts of the progress narrative shaping this late-stage capitalist era. They question the belief that technological innovation, economic growth, markets, and our institutions together produce a steady improvement in human life, as well as the incentives sustaining this story and the risks created by its narrow definition. When progress is measured primarily through economic and military growth, it downplays the scale of its side effects and treats social and ecological costs as collateral, weakening the very conditions on which life and wellbeing depend. Their conclusion that our current idea of progress is immature and developmentally incomplete offers fertile ground for the deep, long-term thinking this moment demands of all changemaking efforts.",
			"Looking through this lens at why social platforms, many of them built to solve genuine problems or serve relational needs, have become sources of widespread harm, ownership appears closest to the heart of the problem. It is where the incentives shaping behaviour inside the organisation, and the behaviours the platform itself goes on to reward, normalise, and scale, are set. Ownership determines who has the power to define pace and progress, whose interests are represented when tradeoffs arise, who receives the economic benefits, and who is left to carry the costs. It shapes what an organisation is ultimately structured to stay true to.",
			"In the corporate ownership model that dominates the technology ecosystem, ownership, and therefore steering power, is concentrated among a narrow group of founders and funders. Their priorities have formal standing inside the organisation, while the people whose participation, and relationships make the platform valuable have little structural influence over its trajectory. When the interests of these groups conflict, the structure gives the financial interests of shareholders priority over the wellbeing and rights of all other stakeholders. The companies change, but the logic remains the same. Internalise profit and externalise the costs onto society and the living world.",
			"We have seen this play out enough for a term to be coined for it. The marvellous, quick-witted digital rights activist and science fiction author Cory Doctorow calls it *enshittification*. With it, he names the process by which platforms first create value for users and lock them in, then create value for business customers and lock them in, before progressively extracting from both. The point is not simply that platforms deteriorate, but that they are deliberately made worse without meaningful accountability. The most consequential truth to confront here is that they do it because they can. Internally, they are answerable to an ownership model that makes growth and financial return binding, while treating nearly everything else as a means to those ends. Externally, the institutions meant to hold this power to account are increasingly entangled with it.",
			"A different ownership architecture offers a response at the source. Collective ownership changes who has standing when decisions are made, bringing the people who create and sustain a platform's value into the structures that define progress, establish priorities, and decide which tradeoffs can be accepted. Steward ownership adds another safeguard by separating control from capital. Steering power remains with people connected to the organisation and its purpose, while profit becomes a means of sustaining that purpose rather than an end to be extracted by owners. The consequences of a decision become harder to push outward when the people carrying them have a place in making it, and when the structure itself limits how much value and power can be privately accumulated.",
			"At Dyad, we are putting this commitment into practice by building governance alongside the product and preparing for a transition to steward ownership from the outset. Active community members will gain a role in shaping its rules, priorities, and direction. This means giving up the conventional promise of an eventual sale for private gain, because we believe value created collectively should not be captured by a few. None of this guarantees wiser decisions, but it changes the baseline by giving those affected real standing and making accountability part of the organisation rather than a matter of goodwill.",
			"We offer this not as a finished answer, but as an invitation for the innovative thinking that has transformed products and interfaces over the past three decades to reach the level of ownership itself. To mature our sense of progress, we need to move away from individualistic structures organised around private accumulation and unilateral control, and toward communal forms of ownership and governance that recognise our interdependence, distribute power, and allow those affected to help determine the direction. Progress cannot remain something defined by a few, imposed on many, and judged by how much value can be privately captured. It must become something we shape, govern, and hold in common."
		]
	},
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
