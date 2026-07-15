/** A single path-prefix cache rule (see the web app's `SourceCacheProfile`). */
export interface CacheRule {
	prefix: string;
	ttl?: number;
	swr?: number;
	surrogateKey?: string;
}

/**
 * Parses the `CACHE_RULES` config item (a JSON array). Invalid/missing JSON
 * yields no rules so a bad value can never break request handling; the plugin
 * just falls back to default caching.
 */
export function parseCacheRules(raw: string | undefined): CacheRule[] {
	if (!raw) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(r): r is CacheRule =>
				typeof r === 'object' && r !== null && typeof (r as CacheRule).prefix === 'string',
		);
	} catch {
		return [];
	}
}

/**
 * Parses the `PROTECTED_PATHS` config item: a JSON object mapping a lowercase
 * hostname to an array of path patterns. Invalid/missing JSON yields undefined,
 * which fails SAFE: everything stays protected (never silently unprotected).
 */
export function parseProtectedPaths(
	raw: string | undefined,
): Record<string, string[]> | undefined {
	if (!raw) return undefined;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
		const result: Record<string, string[]> = {};
		for (const [host, patterns] of Object.entries(parsed)) {
			if (!Array.isArray(patterns)) continue;
			const valid = patterns.filter((p): p is string => typeof p === 'string' && p.startsWith('/'));
			if (valid.length > 0) result[host.toLowerCase()] = valid;
		}
		return Object.keys(result).length > 0 ? result : undefined;
	} catch {
		return undefined;
	}
}
