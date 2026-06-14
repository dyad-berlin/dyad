/**
 * Substrate-agnostic identity for dyad. Account-less members enter and
 * participate in scopes by presenting a credential to a registered provider;
 * dyad core never names a substrate. ember is one provider (providers/ember.ts).
 */

export type { ScopeSession, IdentityProvider, EstablishResult } from './types.js';
export { getProviders, getProvider } from './registry.js';
export { loadScopeSessions } from './sessions.js';
export { buildAppIdentity, type AppIdentity } from './app-identity.js';
export { claimInjectionEnabled, scopedReadClient, scopedWriteContext } from './data-access.js';
export { resolveIdentityId } from './identities.js';
export { mintIdentityJwt, createClaimClient } from './claims.js';
export {
	listCornerConversations,
	getCornerConversation,
	respondToCornerConversation,
	type CornerConversation,
	type CornerConversationDetail,
	type CornerResponse,
	type RespondResult
} from './corner.js';
