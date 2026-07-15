import { describe, expect, it } from 'vitest';
import { isProtectedPath, matchesPathPattern } from '../src/paths';

describe('matchesPathPattern', () => {
	it('matches everything with /*', () => {
		expect(matchesPathPattern('/', '/*')).toBe(true);
		expect(matchesPathPattern('/anything/deep?x=1', '/*')).toBe(true);
	});

	it('prefix-matches directory patterns', () => {
		expect(matchesPathPattern('/api/v1/users', '/api/*')).toBe(true);
		expect(matchesPathPattern('/api', '/api/*')).toBe(false);
		expect(matchesPathPattern('/apiary', '/api/*')).toBe(false);
	});

	it('prefix-matches trailing-star patterns', () => {
		expect(matchesPathPattern('/login', '/login*')).toBe(true);
		expect(matchesPathPattern('/login/reset', '/login*')).toBe(true);
		expect(matchesPathPattern('/log', '/login*')).toBe(false);
	});

	it('handles a mid-pattern wildcard', () => {
		expect(matchesPathPattern('/shop/123/checkout', '/shop/*/checkout*')).toBe(true);
		expect(matchesPathPattern('/shop/123/cart', '/shop/*/checkout*')).toBe(false);
	});

	it('anchors a final literal at the end of the path', () => {
		expect(matchesPathPattern('/shop/1/checkout', '/shop/*/checkout')).toBe(true);
		// The first "/checkout" occurs mid-path; the glob must match the final one.
		expect(matchesPathPattern('/shop/1/checkout/checkout', '/shop/*/checkout')).toBe(true);
		expect(matchesPathPattern('/shop/1/checkout/extra', '/shop/*/checkout')).toBe(false);
		// '*' may match empty, but the literals cannot overlap.
		expect(matchesPathPattern('/ab', '/a*b')).toBe(true);
		expect(matchesPathPattern('/aaa', '/aa*aa')).toBe(false);
		expect(matchesPathPattern('/aaaa', '/aa*aa')).toBe(true);
	});

	it('requires exact match without any wildcard', () => {
		expect(matchesPathPattern('/exact', '/exact')).toBe(true);
		expect(matchesPathPattern('/exact/sub', '/exact')).toBe(false);
	});
});

describe('isProtectedPath', () => {
	const paths = { 'www.example.com': ['/login*', '/checkout/*'] };

	it('protects matching paths on a configured host', () => {
		expect(isProtectedPath('www.example.com', '/login', paths)).toBe(true);
		expect(isProtectedPath('WWW.EXAMPLE.COM', '/checkout/pay', paths)).toBe(true);
	});

	it('passes through non-matching paths on a configured host', () => {
		expect(isProtectedPath('www.example.com', '/', paths)).toBe(false);
		expect(isProtectedPath('www.example.com', '/blog/post', paths)).toBe(false);
	});

	it('fails safe: protects everything without config or for unlisted hosts', () => {
		expect(isProtectedPath('www.example.com', '/blog', undefined)).toBe(true);
		expect(isProtectedPath('other.example.com', '/blog', paths)).toBe(true);
	});
});
