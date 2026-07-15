import { describe, it, expect } from 'vitest';
import { buildChainAuthHeader } from '../src/chainAuth';

describe('buildChainAuthHeader', () => {
	it('produces "<unix seconds>.0x<hmac hex>" matching Fastly VCL digest.hmac_sha256', async () => {
		// Known vector verified against a LIVE Fastly VCL service:
		// digest.hmac_sha256("testkey", "1234567890")
		//   == 0x13d6976eee05fe4c9a3fab162cee146c74ac5a22f3831f276f71aa42c3f30e66
		// If this test fails, the plugin and the VCL guard snippet no longer agree
		// and chained deployments would 403 all traffic.
		expect(await buildChainAuthHeader('testkey', 1234567890)).toBe(
			'1234567890.0x13d6976eee05fe4c9a3fab162cee146c74ac5a22f3831f276f71aa42c3f30e66'
		);
	});

	it('uses the current time when none is given', async () => {
		const before = Math.floor(Date.now() / 1000);
		const header = await buildChainAuthHeader('testkey');
		const after = Math.floor(Date.now() / 1000);

		const match = /^(\d+)\.(0x[0-9a-f]{64})$/.exec(header);
		expect(match).not.toBeNull();
		const ts = Number(match![1]);
		expect(ts).toBeGreaterThanOrEqual(before);
		expect(ts).toBeLessThanOrEqual(after);
	});

	it('signs the timestamp, so different timestamps produce different signatures', async () => {
		const a = await buildChainAuthHeader('testkey', 1000);
		const b = await buildChainAuthHeader('testkey', 1001);
		expect(a.split('.')[1]).not.toBe(b.split('.')[1]);
	});
});
