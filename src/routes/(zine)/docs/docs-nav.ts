import type { Component } from 'svelte';

import SupportUs from './sections/SupportUs.svelte';
import OriginStory from './sections/OriginStory.svelte';
import CommunityCare from './sections/CommunityCare.svelte';
import Privacy from './sections/Privacy.svelte';
import Joining from './sections/Joining.svelte';
import Leaving from './sections/Leaving.svelte';
import Bylaws from './sections/Bylaws.svelte';
import Agreements from './sections/Agreements.svelte';
import Standards from './sections/Standards.svelte';
import HowWePractice from './sections/HowWePractice.svelte';
import DecisionProcess from './sections/DecisionProcess.svelte';
import WhenWrong from './sections/WhenWrong.svelte';
import ProposalGuide from './sections/ProposalGuide.svelte';
import ObjectionGuide from './sections/ObjectionGuide.svelte';
import Team from './sections/Team.svelte';

// Master–detail registry. Each topic is declared once here: the sidebar, the
// hash-validation set, and the detail pane all derive from this list, so adding
// a topic touches one place, not three.
//
// - `group` places the topic in a sidebar heading ('top' is the lone title link).
// - `sub` renders the sidebar link indented (a sub-topic under Governance).
// - Array order is the sidebar order.
//
// Section components optionally receive a `select` callback so inline links can
// switch topics without leaving the page.
export type DocGroup = 'top' | 'about' | 'community' | 'governance';

export interface DocSection {
	id: string;
	title: string;
	group: DocGroup;
	sub?: boolean;
	// Heterogeneous registry: most panes are static markup with no props, a few
	// accept a `select` callback for inline cross-links. `Component` alone rejects
	// the no-prop panes (their empty props type is not widening-compatible), so
	// the field stays permissive here and the `select` contract lives on the
	// components that use it.
	component: Component<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export const docSections: DocSection[] = [
	{ id: 'support-us', title: 'Become a member', group: 'top', component: SupportUs },

	{ id: 'about-why', title: 'Our origin story', group: 'about', component: OriginStory },
	{ id: 'team', title: 'Team', group: 'about', component: Team },

	{ id: 'about-care', title: 'Community care', group: 'community', component: CommunityCare },
	{ id: 'privacy', title: 'Privacy commitments', group: 'community', component: Privacy },
	{ id: 'process-joining', title: 'Becoming a member', group: 'community', component: Joining },
	{ id: 'guide-leaving', title: 'How to leave', group: 'community', component: Leaving },

	{ id: 'bylaws', title: 'Bylaws', group: 'governance', component: Bylaws },
	{ id: 'agreements', title: 'Member Agreements', group: 'governance', component: Agreements },
	{ id: 'standards', title: 'Community Standards', group: 'governance', component: Standards },
	{ id: 'about-governance', title: 'How we practice', group: 'governance', component: HowWePractice },
	{ id: 'process-decision', title: 'How a decision is made', group: 'governance', sub: true, component: DecisionProcess },
	{ id: 'process-wrong', title: 'When something goes wrong', group: 'governance', sub: true, component: WhenWrong },
	{ id: 'guide-proposal', title: 'How to submit a proposal', group: 'governance', sub: true, component: ProposalGuide },
	{ id: 'guide-objection', title: 'How to object well', group: 'governance', sub: true, component: ObjectionGuide }
];

export const sectionIds = new Set(docSections.map((s) => s.id));
