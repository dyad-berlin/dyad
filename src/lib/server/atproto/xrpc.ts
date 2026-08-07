/**
 * Hand-rolled atproto read client: handle→DID→PDS resolution and typed XRPC
 * GET helpers. Plain `fetch`, zero dependencies, by decision (plan KTD6): the
 * content path must not import `@prefig/upact-atproto` (its undici chain
 * caused three production incidents; see src/lib/server/identity/registry.ts)
 * and does not take `@atproto/api` (no verified workerd story, and it would
 * bring zod/multiformats/tlds to serve four unauthenticated GETs).
 *
 * All four endpoints used here are unauthenticated — confirmed from the
 * canonical lexicon JSON in bluesky-social/atproto; the prose docs say
 * otherwise and are wrong.
 */

const XRPC_TIMEOUT_MS = 10_000;
const PLC_DIRECTORY = 'https://plc.directory';

export class XrpcError extends Error {
	constructor(
		public status: number,
		/** GoTrue-style error name from the XRPC error body, e.g. 'RecordNotFound'. */
		public errorName: string | undefined,
		message: string
	) {
		super(message);
		this.name = 'XrpcError';
	}
}

interface DidDocumentService {
	id: string;
	type: string;
	serviceEndpoint: string;
}

interface DidDocument {
	id: string;
	service?: DidDocumentService[];
}

export interface AtprotoRecord {
	uri: string;
	cid: string;
	value: Record<string, unknown>;
}

async function fetchJson(url: string): Promise<unknown> {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(XRPC_TIMEOUT_MS),
		headers: { accept: 'application/json' }
	});
	if (!response.ok) {
		let errorName: string | undefined;
		try {
			const body = (await response.json()) as { error?: string };
			errorName = body.error;
		} catch {
			// non-JSON error body — status alone carries the signal
		}
		throw new XrpcError(response.status, errorName, `${url} → ${response.status}`);
	}
	return response.json();
}

/** Resolve a handle to its DID via com.atproto.identity.resolveHandle. */
export async function resolveHandle(handle: string, entryHost: string): Promise<string> {
	const url = `${entryHost.replace(/\/+$/, '')}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`;
	const body = (await fetchJson(url)) as { did?: string };
	if (typeof body.did !== 'string' || !body.did.startsWith('did:')) {
		throw new XrpcError(502, undefined, `resolveHandle returned no DID for ${handle}`);
	}
	return body.did;
}

/**
 * Resolve a DID document: PLC directory for did:plc, /.well-known/did.json
 * for did:web. Other methods are rejected — the content path only ever reads
 * a first-party repo whose DID method we choose.
 */
export async function resolveDidDocument(did: string): Promise<DidDocument> {
	let url: string;
	if (did.startsWith('did:plc:')) {
		// Raw interpolation is safe: a did:plc identifier is base32 after the
		// prefix, and colons are legal in a URL path segment.
		if (!/^did:plc:[a-z2-7]+$/.test(did)) {
			throw new XrpcError(400, undefined, `malformed did:plc identifier: ${did}`);
		}
		url = `${PLC_DIRECTORY}/${did}`;
	} else if (did.startsWith('did:web:')) {
		const host = did.slice('did:web:'.length);
		// Only bare-host did:web (no path segments) — enough for a PDS identity.
		if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
			throw new XrpcError(400, undefined, `unsupported did:web shape: ${did}`);
		}
		url = `https://${host}/.well-known/did.json`;
	} else {
		throw new XrpcError(400, undefined, `unsupported DID method: ${did}`);
	}
	return (await fetchJson(url)) as DidDocument;
}

/** The PDS service endpoint from a DID document (#atproto_pds). */
export function pdsEndpoint(doc: DidDocument): string {
	const service = doc.service?.find(
		(s) => s.id === '#atproto_pds' || s.id === `${doc.id}#atproto_pds`
	);
	if (!service || typeof service.serviceEndpoint !== 'string') {
		throw new XrpcError(502, undefined, `DID document for ${doc.id} names no #atproto_pds service`);
	}
	return service.serviceEndpoint.replace(/\/+$/, '');
}

/** Full resolution: handle or DID → PDS base URL plus the canonical DID. */
export async function resolveRepo(
	repo: string,
	entryHost: string
): Promise<{ did: string; pds: string }> {
	const did = repo.startsWith('did:') ? repo : await resolveHandle(repo, entryHost);
	const doc = await resolveDidDocument(did);
	return { did, pds: pdsEndpoint(doc) };
}

/** com.atproto.repo.listRecords — one page; the caller owns cursoring. */
export async function listRecords(
	pds: string,
	repo: string,
	collection: string,
	opts: { limit?: number; cursor?: string } = {}
): Promise<{ records: AtprotoRecord[]; cursor?: string }> {
	const params = new URLSearchParams({ repo, collection });
	params.set('limit', String(opts.limit ?? 100));
	if (opts.cursor) params.set('cursor', opts.cursor);
	const body = (await fetchJson(`${pds}/xrpc/com.atproto.repo.listRecords?${params}`)) as {
		records?: AtprotoRecord[];
		cursor?: string;
	};
	return { records: body.records ?? [], cursor: body.cursor };
}

/**
 * com.atproto.repo.getRecord — a missing rkey surfaces as a null return, not
 * a throw; every other failure (5xx, timeout, malformed) throws so the cache
 * layer can serve last-known-good.
 */
export async function getRecord(
	pds: string,
	repo: string,
	collection: string,
	rkey: string
): Promise<AtprotoRecord | null> {
	const params = new URLSearchParams({ repo, collection, rkey });
	try {
		return (await fetchJson(
			`${pds}/xrpc/com.atproto.repo.getRecord?${params}`
		)) as AtprotoRecord;
	} catch (err) {
		if (err instanceof XrpcError && err.status === 400 && err.errorName === 'RecordNotFound') {
			return null;
		}
		throw err;
	}
}
