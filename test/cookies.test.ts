import { describe, it, expect, vi } from 'vitest';
import { setSecureCookie, validateCookie } from '../src/cookies';
import { COOKIE_NAME } from '../src/constants';
import type { MonocleConfig } from '../src/config';

const config = {
	getCookieSecret: async () =>
		'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
} as MonocleConfig;

function cookieFromSetCookie(headers: Headers): string {
	const setCookie = headers.get('Set-Cookie')!;
	// e.g. "MCLVALID=<payloadHex>.<signatureHex>; Secure; HttpOnly; Path=/; SameSite=Lax"
	return setCookie.split(';')[0];
}

describe('cookie round-trip (HMAC)', () => {
	it('issues a cookie that validates for the same IP', async () => {
		const ip = '203.0.113.7';
		const headers = await setSecureCookie(ip, config);
		const cookie = cookieFromSetCookie(headers);

		expect(cookie.startsWith(`${COOKIE_NAME}=`)).toBe(true);
		expect(await validateCookie(cookie, ip, config)).toBe(true);
	});

	it('rejects a cookie presented from a different IP', async () => {
		const headers = await setSecureCookie('203.0.113.7', config);
		const cookie = cookieFromSetCookie(headers);

		expect(await validateCookie(cookie, '198.51.100.9', config)).toBe(false);
	});

	it('rejects a tampered cookie', async () => {
		const headers = await setSecureCookie('203.0.113.7', config);
		const cookie = cookieFromSetCookie(headers).replace(/.$/, m => (m === '0' ? '1' : '0'));

		expect(await validateCookie(cookie, '203.0.113.7', config)).toBe(false);
	});

	it('returns false when no cookie is present', async () => {
		expect(await validateCookie(null, '203.0.113.7', config)).toBe(false);
	});

	it('rejects an expired cookie', async () => {
		const headers = await setSecureCookie('203.0.113.7', config);
		const cookie = cookieFromSetCookie(headers);
		// Jump past the 1-hour expiry.
		vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 3601 * 1000);
		try {
			expect(await validateCookie(cookie, '203.0.113.7', config)).toBe(false);
		} finally {
			vi.restoreAllMocks();
		}
	});

	it('issues an IP-unbound cookie when no client IP is available, which still validates', async () => {
		const headers = await setSecureCookie(null, config);
		const cookie = cookieFromSetCookie(headers);

		// The cookie must not be permanently invalid: it validates for any IP.
		expect(await validateCookie(cookie, '203.0.113.7', config)).toBe(true);
		expect(await validateCookie(cookie, null, config)).toBe(true);
	});
});
