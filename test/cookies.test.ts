import { describe, it, expect } from 'vitest';
import { setSecureCookie, validateCookie, parseCookies } from '../src/cookies';
import { COOKIE_NAME } from '../src/constants';
import type { MonocleConfig } from '../src/config';

const config = {
	cookieSecretValue: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
} as MonocleConfig;

function cookieFromSetCookie(headers: Headers): string {
	const setCookie = headers.get('Set-Cookie')!;
	// e.g. "MCLVALID=<iv>.<ct>; Secure; HttpOnly; Path=/; SameSite=Lax"
	return setCookie.split(';')[0];
}

describe('parseCookies', () => {
	it('parses a cookie header into name/value pairs', () => {
		expect(parseCookies('a=1; b=2')).toEqual({ a: '1', b: '2' });
	});
	it('returns empty for null', () => {
		expect(parseCookies(null)).toEqual({});
	});
});

describe('cookie round-trip (AES-GCM)', () => {
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
});
