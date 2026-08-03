// Wiggling — the page's strings. Mostly the principles section, which is
// content-shaped (a standfirst plus nine named paragraphs), so it lives in a
// content module beside the page rather than in copy.ts, following the
// src/lib/content/unfolding.ts pattern. It is page-private, hence beside the
// route instead of $lib/content.

// Label on each speaker's outbound full-episode link. Chrome rather than
// editorial copy, but zine strings stay out of copy.ts by precedent, so it
// lives here beside the rest of the page's text.
export const episodeLinkLabel = 'Watch on YouTube ↗';

export const principlesStandfirst =
	"What holds a conversation like this together, before it even begins — the same practice we've carried for three years, at Brafe Space and here.";

export interface Principle {
	name: string;
	body: string;
}

export const principles: Principle[] = [
	{
		name: 'Complexity & Ambiguity',
		body: 'We envision a world where we all can live safe, fulfilled, and free. There is not one answer or path to it. We have to navigate the complexity and ambiguity of the simultaneity of various (contradicting) possibilities.'
	},
	{
		name: 'No Outcome',
		body: 'We do not manifest nor do we pursue a certain outcome. We want to create space in which the manifestors of the future gain support, connection, perspectives, and evolve.'
	},
	{
		name: 'Unfolding',
		body: 'We work with the hypothesis that change comes from within and have chosen a path of inner development — to be able to connect more to ourselves, each other, and our environment. If you want to be part of it, you have to be willing to explore your inner self and face your blank spots.'
	},
	{
		name: 'Empathy & Compassion',
		body: 'This process might bring us to the edges of our meaning-making and question our identity. We are aware this is painful and therefore face this process with empathy and compassion rather than intellectual rigidity.'
	},
	{
		name: 'Subjective Experience',
		body: 'The focus of our space will be on the process of sharing subjective experiences of how we individually perceive and feel the world. In this we avoid sharing and judging opinions or detaching from ourselves when speaking about topics.'
	},
	{
		name: 'Bravery',
		body: 'Still, we will constantly try to find a balance between creating a safe enough environment, and at the same time being brave enough in the stretch, that we create through our shared diverse perspectives.'
	},
	{
		name: 'Lightheartedness',
		body: 'While an emergent process like this might feel hard and heavy at times, given the depths, relevance, and felt urgency of inner and outer topics, we strive for a loving experience, in which we can acknowledge our limitations and do not take ourselves too seriously.'
	},
	{
		name: 'Multiperspectivity',
		body: 'We are not promoting one or the other world view but giving different perspectives room is part of the journey. We commit to being truly diverse in the viewpoints that we share over time.'
	},
	{
		name: 'Safe-enoughness',
		body: 'We want to build a relational space for a heterogeneous group to connect deeply. This requires all of us to nurture a space in which everybody finds the confidence and safety to share, and to be honest with their own boundaries. For such a diverse community this includes the awareness and acknowledgement of intersectional experiences of relative privilege and discrimination.'
	}
];
