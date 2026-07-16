// Unfolding — dyad's essay series, drawn from the working zine
// (Dyad, Draft Edition). One entry here is one published essay at
// /unfolding/[slug]. Extracted to a single data module because the same
// entries back both the archive index and the individual essay pages.

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
		slug: 'already-in-motion',
		kicker: 'Execution',
		title: 'Already in motion',
		quote:
			'We need to keep the community high-trust while growing. The value of dyad depends on the quality of participation, not simply the number of users.',
		date: '2026-08-10',
		paragraphs: [
			'Any plan, no matter how principled or credible, ultimately relies on execution. dyad is not only an experiment in participatory governance, steward ownership, or community theory. To build a financially sustainable social technology company, we need to build a useful product, serve members well, earn revenue, manage risk, and move with an operational pace to make it, first, to break even and then to flourish.',
			'dyad is already in motion. We began in May 2025 with the simplest possible version of the idea: curated roundtables of four to eight people gathering in person around a shared question. We scouted local spaces, tested formats, built relationships, and received over 1,000 requests in the first three months in Berlin. That response gave us the signal to continue. People were not only asking for another app. They were looking for more creative, intentional, and human ways to meet.',
			'Our execution strategy is therefore not to invent demand from scratch. It is to convert an existing pull into a reliable product, a repeatable local operating model, and a financially sustainable company. We will do this through fast iterative cycles: launch, observe, measure, learn, adjust, and repeat.',
			'We will measure dyad by whether it creates real participation, not by whether it maximizes time spent online. Our core metric is the number of completed in-person conversations, but that alone is not enough.',
			'The purpose of these metrics is not to turn dyad into an engagement machine. It is to understand whether the system is working.',
			'A request to join is a signal. A completed conversation is stronger. A member who returns, hosts, invites others, and participates in governance is stronger still.',
			'We need to make the model legible. Collective ownership, participatory governance, and transparent building must become understandable enough for members, funders, partners, and the wider public to support.'
		]
	},
	{
		slug: 'dismantling-platform-capitalism',
		kicker: 'Possibilities',
		title: 'Dismantling platform capitalism',
		quote:
			'When a complex system is far from equilibrium, small islands of coherence in a sea of chaos have the capacity to shift the entire system to a higher order.',
		quoteAttr: 'Ilya Prigogine',
		date: '2026-08-03',
		paragraphs: [
			'Success to us has no link to a route to quick exit or short-term financial gains. It is about achieving longevity and a lasting impact on both culture and business. In our commitment to steward ownership, we want dyad to be a resilient institution that can outlast its members.',
			"When it comes to current online platforms, there's not much to feel hopeful about. It's easy to feel cynical and pessimistic. But we want to rekindle optimism. We want to prove that a better internet is possible.",
			'dyad is designed to work within the market we have, while building toward the one we want. We do not believe platform capitalism will be changed by critique alone. It has to be challenged by working alternatives that are useful, competitive, and structurally harder to corrupt.',
			'The problems we have described are not accidental. Shareholder primacy, misaligned incentives, network effects, enshittification, and the absence of meaningful accountability are features of the dominant platform model. If a company is financed, governed, and rewarded through extraction, it will eventually optimize for extraction.',
			'Our approach is to intervene at the structural level. Collective ownership changes who the company is accountable to. Participatory governance changes who has a say in the rules and priorities. Open, transparent building changes what can be scrutinized, adapted, and trusted. Together, these are not only ethical commitments. They are competitive advantages.',
			'If dyad proves viable, it creates a pressure point in the market. It shows that a social technology company can grow without advertising, govern with its members, and still build a product people use. And this matters, because incumbents are not only powerful through scale. They are powerful because many people believe there is no alternative.',
			'We want dyad to weaken that belief. By proving that different ownership, funding, governance, and infrastructural choices can work in practice, we hope to widen the imagination of what future companies can become. The aim is not simply to build a better platform. It is to better the ecosystem.'
		]
	},
	{
		slug: 'what-we-are-not-building',
		kicker: 'Dyad',
		title: 'What we are not building',
		quote: 'We become what we behold. We shape our tools and then our tools shape us.',
		quoteAttr: 'John Culkin',
		date: '2026-07-27',
		paragraphs: [
			'Every product embeds a theory of what people are for, whether anyone writes it down or not. We wrote ours down, and treat it as binding as anything we build toward.',
			'We do not track you. No cookie banner, no behavioral data collection. Collect less, infer less, manipulate less, and leave fewer openings for the product to become something we would not want to use ourselves.',
			'Conversations appear in a shared commons, ordered by time. If we ever introduce algorithms, they will be transparent, adjustable, and legible to members. We will not build black-box ranking systems that silently decide what people see.',
			'No followers, no influencers, no public metrics, no popularity scores, no reputation games. Members are not here to build an audience. They are here to participate.',
			'No infinite scroll, no streaks, no growth hacks, no notification loops designed to pull people back. We are not building for retention at all costs. We are building for people to meet.',
			'Members are the customer. Attention is not the product. Personal data is not sold, rented, or used to target advertising.',
			'dyad is not a destination. It is bridging infrastructure, to support us in building communities in the cities where we live. Its purpose is fulfilled when people close the app and meet.'
		]
	},
	{
		slug: 'holding-space-online',
		kicker: 'Trust, Safety, Community Care',
		title: 'Holding space online',
		quote:
			'Really to care is to care as you would for a tree or a plant, watering it, studying its needs, looking after it with gentleness and tenderness.',
		quoteAttr: 'Krishnamurti',
		date: '2026-07-20',
		paragraphs: [
			'We started this zine with the harms that brought us here. The exhaustion, hostility, harm, and erosion of trust we have experienced and witnessed are not abstract to us. They have been foundational parts of why dyad exists.',
			'The places where we meet others online are part of public life. People gather there, speak there, organize there, disagree there, find belonging there, and become visible to one another there.',
			'Communal living has always come with shared understandings, boundaries, agreements, and forms of accountability. The digital realm will not be an exception.',
			"We are inspired by Glitch's principle that safety infrastructure should be designed from the margins inward, not the centre outward. Designing for the most exposed member raises the floor for everyone.",
			'We have placed our trust in technology companies enough times to know that goodwill and original intentions are not a sufficient safeguard. Rather than asking members to trust us indefinitely, we aim to create a system that requires as little blind trust as possible.',
			'Trust is not something that can be claimed. It is something that must be earned, repeatedly, through accountability and practice.',
			'So in all our effort to be good hosts, we begin with responsibility, not certainty.'
		]
	},
	{
		slug: 'how-a-decision-is-made',
		kicker: 'Governance',
		title: 'How a decision is made',
		quote:
			'To maintain the faith that democracy requires, people need to experience co-governance in their daily lives. They need to see it work and feel their own power.',
		quoteAttr: 'Nathan Schneider',
		date: '2026-07-13',
		paragraphs: [
			'Online spaces have become places we live in, but not places we govern. In communities, workplaces, and associations, we expect ways to be heard, disagree, decide, and revise decisions together. Online, that expectation rarely holds.',
			'To make self-governance practical, we need clear roles, open feedback channels, assemblies, public documentation, and defined decision rights.',
			'Our long-term theory of change begins with the ability to be with one another across difference. Not to collapse differences into agreement, but to stay in contact long enough to notice what our own vantage point cannot see.',
			'dyad is built around two roles with distinct relationships to governance: members and stewards. Members participate in the life of the platform and have a voice in the decisions that shape it. Stewards are members entrusted with maintaining its health, not as executives, but as custodians.',
			'Not every decision requires a vote from all members. Operational decisions — day-to-day development, moderation, community support — are handled by the team and stewards.',
			'Strategic decisions — priorities, partnerships, significant product or organizational directions — are made by stewards, informed by member input.',
			'Fundamental decisions — changes to the governance structure or bylaws, the election of stewards, and decisions about the future of dyad itself — require a vote from the membership.'
		]
	},
	{
		slug: 'ownership',
		kicker: 'Steward Ownership',
		title: 'Ownership',
		quote: 'Ownership determines whose interests prevail.',
		quoteAttr: 'Marjorie Kelly',
		date: '2026-07-06',
		paragraphs: [
			'Ownership structures shape incentives, incentives shape behavior, and behavior shapes outcomes. Most social platforms are ultimately accountable to shareholders, meaning their decisions are structurally pushed toward growth, engagement, and financial return.',
			'If we want different outcomes, we must begin with different ownership structures.',
			"dyad is committed to transitioning into steward ownership, separating control from capital so the company's purpose cannot be overridden by investor interests.",
			'Every company eventually faces the same question: whose interests are represented in decision making when tradeoffs arise? Ownership answers this question at the deepest level.',
			'In a conventional shareholder company, capital has formal standing that communities do not. For social technologies, this creates a structural mismatch — the people who help create a platform\'s value are often left outside the structures that govern it.',
			"This is why steward ownership matters to us. It separates control from capital, protects the company's purpose from purely extractive incentives, and creates a foundation on which more participatory forms of governance can grow.",
			'Steward ownership is a model in which a company is governed in service of its mission rather than in service of external owners. The company, in a meaningful sense, is held for its purpose.'
		]
	},
	{
		slug: 'zoom-in-meetup',
		kicker: 'Landscape · case study',
		title: 'Zoom in: a case study on Meetup',
		dek: 'When community infrastructure becomes an asset class.',
		quote: 'Meetup remains one of the strongest demonstrations that people want tools that help them gather in real life.',
		date: '2026-06-29',
		paragraphs: [
			'Meetup occupies a unique place in the history of social technologies. Founded in 2002, it was among the first platforms built explicitly to help people gather in person around shared interests, causes, and communities.',
			'For this reason, we anchor in the example of Meetup as an important predecessor. By the late 2010s, millions were using it to organize local communities. Yet despite the value created by organizers and members, the platform itself remained owned and governed elsewhere.',
			"In 2017, Meetup was acquired by WeWork for approximately $156 million. Following WeWork's well-documented collapse, Meetup was sold again in 2020. In 2024, it changed ownership for a third time through its acquisition by Bending Spoons.",
			"For community organizers, these ownership transitions were not abstract financial events. They translated into concrete changes to the conditions under which communities operated. In 2024, many organizers reported subscription price increases of up to three times previous rates, with less than a month's notice.",
			'One organizer described the change as a jump from $29 to $99 for a six-month subscription while managing a non-profit community of over 2,000 members. Others reported renewals increasing from roughly $90 to nearly $180 per billing cycle.',
			'The problem was not simply the increase itself. Organizers had spent years building member networks, event histories, local trust, and community infrastructure on the platform. Leaving was difficult because the community existed where the people already were.',
			"Meetup's story makes tangible many of these dynamics. Ownership changed repeatedly while the communities creating value remained largely absent from the decision-making process. Its history reveals the structural vulnerability that emerges when communities rely on infrastructure they neither own nor govern."
		]
	},
	{
		slug: 'a-systemic-diagnosis',
		kicker: 'Problem · diagnosis',
		title: 'A systemic diagnosis',
		quote: 'Ownership is a choice. Governance is a choice. Funding is a choice. Metrics are a choice. And they can be redesigned.',
		date: '2026-06-22',
		paragraphs: [
			'Climate online has grown increasingly commodified, and hostile. The desire to connect and exchange, once held as the emancipatory promise of the World Wide Web, is now met by systems that capture and translate our lives into data.',
			'The scale and scope of the harm is difficult to overstate. From loneliness and declining mental health, to information warfare, political polarization, the erosion of trust in institutions, and democratic instability — the effects reach far beyond the screen.',
			'They are working exactly as they were built to work. With the identification of behavioral data as the new frontier of untapped resource, these platforms modified themselves from social technologies into surveillance machinery that profits from prediction, attention capture, and eventually, behavioral influence.',
			'This brought us to a simple conviction: the problem with the status quo of social technologies is systemic, and so must be the response.',
			'Most platforms are legally and financially accountable primarily to their shareholders, whose aggressive return expectations rely on growth at all cost. The cost is, without exception, accrued to those whose interests are not represented in the platform\'s decision-making: users, environment, and society at large.',
			'Platforms become more valuable as more people use them. The utility and convenience users experience on larger platforms makes it increasingly difficult to leave, even when trust declines or quality deteriorates.',
			'Coined by digital rights activist Cory Doctorow, "enshittification" describes the gradual degradation of platforms as value extraction for shareholders overtakes value creation for users. When growth is imperative and accountability is weak, it becomes the default trajectory.'
		]
	},
	{
		slug: 'embedding-care-into-the-infrastructure',
		kicker: "Problem · Luna's foreword",
		title: 'Embedding care into the infrastructure',
		quote: 'What I had experienced as abandonment was not a glitch. It was a structural omission.',
		date: '2026-06-15',
		paragraphs: [
			'dyad began from a state of disillusionment that came through my own experience with harassment online, and with the strange powerlessness I mistook, at first, as personal.',
			'At the very moment I needed support, orientation, and care, the platforms I relied on revealed the distance they had built between themselves and the people who depend on them. What I had experienced as abandonment was not a glitch. It was a structural omission.',
			'In a time of rising global tension, these systems were not helping us make sense of what was happening, or find our way through it. They were amplifying hostility, flattening complexity, rewarding outrage, and making it harder to tell what was true to act on.',
			'This brought us to a conviction. The individual, relational, and societal harms produced by incumbent social platforms are not accidental. They are part of how these systems are built to operate.',
			'Who owns the platforms we meet on? What incentives govern them? Who can shape their rules? These questions widened our understanding of where innovation is most needed in social technology and infrastructure.',
			'For generations, conversation has been one of our primary tools for finding our way. We have used it to make sense of what is happening, test what we think we know, remember what matters, and decide what to do next. It is not a soft alternative to action. It is often where action becomes possible.',
			'As you enter it, we invite you to set aside what you have come to expect from a social technology company. Collectively owned, transparent, and accountable social infrastructure is possible. dyad is an attempt, and this is our invitation to you.'
		]
	},
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
