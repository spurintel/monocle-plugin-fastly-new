import { describe, it, expect, vi, afterEach } from 'vitest';
import { evaluateAssessment, MonocleAPIError } from '../src/policy';
import { POLICY_API_URL } from '../src/constants';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('evaluateAssessment', () => {
	it('posts to the Policy API with the TOKEN header and assessment body', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ allowed: true }), { status: 200 })
		);
		vi.stubGlobal('fetch', fetchMock);

		const decision = await evaluateAssessment('ENCRYPTED', 'secret-key', 'monocle_policy');

		expect(decision.allowed).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe(POLICY_API_URL);
		expect(init.method).toBe('POST');
		expect(init.backend).toBe('monocle_policy');
		expect(init.headers.TOKEN).toBe('secret-key');
		expect(JSON.parse(init.body)).toEqual({ assessment: 'ENCRYPTED' });
	});

	it('parses a block decision', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response(JSON.stringify({ allowed: false }), { status: 200 }))
		);
		const decision = await evaluateAssessment('X', 'k', 'monocle_policy');
		expect(decision.allowed).toBe(false);
	});

	it('throws MonocleAPIError with the status on non-2xx', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 404 })));
		await expect(evaluateAssessment('X', 'k', 'monocle_policy')).rejects.toMatchObject({
			status: 404,
		});
		await expect(evaluateAssessment('X', 'k', 'monocle_policy')).rejects.toBeInstanceOf(
			MonocleAPIError
		);
	});
});
