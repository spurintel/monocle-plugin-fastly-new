import { describe, it, expect } from 'vitest';
import { parseCacheRules, parseProtectedPaths } from '../src/configParse';

describe('parseCacheRules', () => {
	it('parses a valid rule array', () => {
		expect(parseCacheRules('[{"prefix":"/","ttl":60,"swr":30}]')).toEqual([
			{ prefix: '/', ttl: 60, swr: 30 },
		]);
	});

	it('drops entries without a string prefix', () => {
		expect(parseCacheRules('[{"ttl":60},{"prefix":"/api"}]')).toEqual([{ prefix: '/api' }]);
	});

	it('yields no rules for missing/invalid JSON or a non-array (never throws)', () => {
		expect(parseCacheRules(undefined)).toEqual([]);
		expect(parseCacheRules('')).toEqual([]);
		expect(parseCacheRules('not json')).toEqual([]);
		expect(parseCacheRules('{"prefix":"/"}')).toEqual([]);
	});
});

describe('parseProtectedPaths', () => {
	it('parses a host→patterns map and lower-cases the host', () => {
		expect(parseProtectedPaths('{"WWW.Example.com":["/login*","/api/*"]}')).toEqual({
			'www.example.com': ['/login*', '/api/*'],
		});
	});

	it('drops patterns that do not start with "/"', () => {
		expect(parseProtectedPaths('{"a.com":["/ok","bad","/also-ok"]}')).toEqual({
			'a.com': ['/ok', '/also-ok'],
		});
	});

	it('fails SAFE (returns undefined = everything protected) on bad/empty input', () => {
		// undefined must mean "protect everything", never "protect nothing".
		expect(parseProtectedPaths(undefined)).toBeUndefined();
		expect(parseProtectedPaths('not json')).toBeUndefined();
		expect(parseProtectedPaths('["/login*"]')).toBeUndefined(); // array, not object
		expect(parseProtectedPaths('{"a.com":[]}')).toBeUndefined(); // no valid patterns
		expect(parseProtectedPaths('{"a.com":["no-slash"]}')).toBeUndefined();
	});
});
