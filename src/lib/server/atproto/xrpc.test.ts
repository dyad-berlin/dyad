import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	resolveHandle,
	resolveDidDocument,
	pdsEndpoint,
	resolveRepo,
	listRecords,
	getRecord,
	XrpcError
} from './xrpc';

// Recorded fixtures, shaped from real bsky.social / plc.directory responses.
const DID = 'did:plc:ewvi7nxzyoun6zhxrhs64oiz';
const PDS = 'https://enoki.us-east.host.bsky.network';

const didDocument = {
	id: DID,
	service: [
		{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }
	]
};

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	fetchMock = vi.fn();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('resolveHandle', () => {
	it('resolves a handle to the expected DID against the recorded fixture', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ did: DID }));
		await expect(resolveHandle('atproto.com', 'https://bsky.social')).resolves.toBe(DID);
		const url = fetchMock.mock.calls[0][0] as string;
		expect(url).toBe(
			'https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=atproto.com'
		);
	});

	it('throws when the response carries no DID', async () => {
		fetchMock.mockResolvedValue(jsonResponse({}));
		await expect(resolveHandle('atproto.com', 'https://bsky.social')).rejects.toBeInstanceOf(
			XrpcError
		);
	});
});

describe('DID document resolution', () => {
	it('resolves a did:plc document via the PLC directory to the PDS endpoint', async () => {
		fetchMock.mockResolvedValue(jsonResponse(didDocument));
		const doc = await resolveDidDocument(DID);
		expect(fetchMock.mock.calls[0][0]).toBe(`https://plc.directory/${DID}`);
		expect(pdsEndpoint(doc)).toBe(PDS);
	});

	it('resolves a did:web document from /.well-known/did.json', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ ...didDocument, id: 'did:web:pds.example.org' }));
		await resolveDidDocument('did:web:pds.example.org');
		expect(fetchMock.mock.calls[0][0]).toBe('https://pds.example.org/.well-known/did.json');
	});

	it('rejects a did:web with path segments and unknown DID methods', async () => {
		await expect(resolveDidDocument('did:web:example.org:user:alice')).rejects.toBeInstanceOf(
			XrpcError
		);
		await expect(resolveDidDocument('did:ion:abc')).rejects.toBeInstanceOf(XrpcError);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('throws when the document names no #atproto_pds service', () => {
		expect(() => pdsEndpoint({ id: DID, service: [] })).toThrow(XrpcError);
	});

	it('accepts the fully-qualified service id form', () => {
		const doc = {
			id: DID,
			service: [
				{ id: `${DID}#atproto_pds`, type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }
			]
		};
		expect(pdsEndpoint(doc)).toBe(PDS);
	});
});

describe('resolveRepo', () => {
	it('short-circuits handle resolution when given a DID', async () => {
		fetchMock.mockResolvedValue(jsonResponse(didDocument));
		const result = await resolveRepo(DID, 'https://bsky.social');
		expect(result).toEqual({ did: DID, pds: PDS });
		expect(fetchMock).toHaveBeenCalledTimes(1); // only the PLC lookup
	});
});

describe('listRecords', () => {
	it('returns records and cursor for a known collection', async () => {
		fetchMock.mockResolvedValue(
			jsonResponse({
				records: [
					{ uri: `at://${DID}/social.dyad.unfolding.entry/ownership`, cid: 'bafy1', value: {} }
				],
				cursor: 'next-page'
			})
		);
		const result = await listRecords(PDS, DID, 'social.dyad.unfolding.entry');
		expect(result.records).toHaveLength(1);
		expect(result.cursor).toBe('next-page');
		const url = fetchMock.mock.calls[0][0] as string;
		expect(url).toContain(`${PDS}/xrpc/com.atproto.repo.listRecords?`);
		expect(url).toContain('collection=social.dyad.unfolding.entry');
	});
});

describe('getRecord', () => {
	it('surfaces RecordNotFound as a null return, not a throw', async () => {
		fetchMock.mockResolvedValue(
			jsonResponse({ error: 'RecordNotFound', message: 'record not found' }, 400)
		);
		await expect(
			getRecord(PDS, DID, 'social.dyad.unfolding.entry', 'no-such-rkey')
		).resolves.toBeNull();
	});

	it('throws on upstream 5xx so the cache layer can serve last-known-good', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ error: 'InternalServerError' }, 502));
		await expect(
			getRecord(PDS, DID, 'social.dyad.unfolding.entry', 'ownership')
		).rejects.toMatchObject({ status: 502 });
	});

	it('returns the record for an existing rkey', async () => {
		const record = {
			uri: `at://${DID}/social.dyad.unfolding.entry/ownership`,
			cid: 'bafy1',
			value: { slug: 'ownership' }
		};
		fetchMock.mockResolvedValue(jsonResponse(record));
		await expect(
			getRecord(PDS, DID, 'social.dyad.unfolding.entry', 'ownership')
		).resolves.toEqual(record);
	});
});
