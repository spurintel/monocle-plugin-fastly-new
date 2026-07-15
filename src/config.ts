import { ConfigStore } from 'fastly:config-store';
import { SecretStore } from 'fastly:secret-store';
import { CONFIG_STORE_NAME, SECRET_STORE_NAME } from './constants';

/**
 * Runtime configuration for the plugin, assembled from the Config Store
 * (non-secret) and the Secret Store (secret material). Mirrors the `Env`
 * bindings the Cloudflare worker receives so the request-handling logic can be
 * ported one-to-one.
 */
export interface MonocleConfig {
	publishableKey: string;
	/**
	 * Secret material is loaded LAZILY and memoized: most requests (unprotected
	 * paths, block-page passthrough) never need either secret, and cookie
	 * validation needs only the cookie secret. Keeping these behind async getters
	 * removes the Secret Store reads from the proxy hot path entirely.
	 */
	getSecretKey(): Promise<string>;
	getCookieSecret(): Promise<string>;
	/**
	 * Host to send to the customer's origin. Fastly's backend `override_host` is
	 * not honoured when we replay the inbound request, so the plugin rewrites the
	 * outbound Host to this value. Undefined (empty in the store) means "forward
	 * the visitor's Host unchanged".
	 */
	originHost?: string;
	/**
	 * Shared secret sent to the customer's existing service when chaining. Lets
	 * that service reject direct hits to the internal host that would otherwise
	 * bypass the Monocle challenge. Undefined when not chaining.
	 */
	chainSecret?: string;
	/**
	 * Optional path-prefix cache rules cloned from the customer's source service.
	 * Empty/absent means "use the default readthrough cache" (honour the origin's
	 * own cache headers), which is the normal case.
	 */
	cacheRules: CacheRule[];
	/**
	 * Optional path scoping per protected hostname (lowercase host → path
	 * patterns like "/api/*"). Requests outside the patterns bypass the Monocle
	 * challenge and proxy straight to the origin. Absent (the common case, all
	 * routes "/*") means every path on every domain is protected.
	 */
	protectedPaths?: Record<string, string[]>;
	blockResponseType?: string;
	blockRedirectUrl?: string;
	blockStatusCode?: string;
	blockPageTitle?: string;
	blockResponseBody?: string;
}

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
function parseCacheRules(raw: string | undefined): CacheRule[] {
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
function parseProtectedPaths(raw: string | undefined): Record<string, string[]> | undefined {
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

function optional(store: ConfigStore, key: string): string | undefined {
	const value = store.get(key);
	return value === null || value === '' ? undefined : value;
}

async function secret(store: SecretStore, key: string): Promise<string> {
	const entry = await store.get(key);
	return entry ? entry.plaintext() : '';
}

/**
 * Loads config at request time. Config/Secret stores can only be accessed while
 * handling a request (not during build-time init), so this is called inside the
 * fetch handler. Secrets are NOT read here: the getters fetch each secret on
 * first use and memoize the promise, so requests that never touch secret
 * material never pay the Secret Store roundtrips.
 */
export function loadConfig(): MonocleConfig {
	const config = new ConfigStore(CONFIG_STORE_NAME);
	const secrets = new SecretStore(SECRET_STORE_NAME);

	const publishableKey = config.get('PUBLISHABLE_KEY') ?? '';
	if (!publishableKey) {
		// Without this the challenge page renders with an empty token and can never
		// complete: an invisible install failure worth a loud log.
		console.error('PUBLISHABLE_KEY is missing from the config store; the challenge page cannot work.');
	}

	let secretKey: Promise<string> | undefined;
	let cookieSecret: Promise<string> | undefined;

	return {
		publishableKey,
		originHost: optional(config, 'ORIGIN_HOST'),
		chainSecret: optional(config, 'CHAIN_SECRET'),
		cacheRules: parseCacheRules(optional(config, 'CACHE_RULES')),
		protectedPaths: parseProtectedPaths(optional(config, 'PROTECTED_PATHS')),
		blockResponseType: optional(config, 'BLOCK_RESPONSE_TYPE'),
		blockRedirectUrl: optional(config, 'BLOCK_REDIRECT_URL'),
		blockStatusCode: optional(config, 'BLOCK_STATUS_CODE'),
		blockPageTitle: optional(config, 'BLOCK_PAGE_TITLE'),
		blockResponseBody: optional(config, 'BLOCK_RESPONSE_BODY'),
		getSecretKey: () => (secretKey ??= secret(secrets, 'SECRET_KEY')),
		getCookieSecret: () => (cookieSecret ??= secret(secrets, 'COOKIE_SECRET_VALUE')),
	};
}
