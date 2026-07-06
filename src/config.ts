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
	secretKey: string;
	cookieSecretValue: string;
	blockResponseType?: string;
	blockRedirectUrl?: string;
	blockStatusCode?: string;
	blockPageTitle?: string;
	blockResponseBody?: string;
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
 * fetch handler.
 */
export async function loadConfig(): Promise<MonocleConfig> {
	const config = new ConfigStore(CONFIG_STORE_NAME);
	const secrets = new SecretStore(SECRET_STORE_NAME);

	return {
		publishableKey: config.get('PUBLISHABLE_KEY') ?? '',
		blockResponseType: optional(config, 'BLOCK_RESPONSE_TYPE'),
		blockRedirectUrl: optional(config, 'BLOCK_REDIRECT_URL'),
		blockStatusCode: optional(config, 'BLOCK_STATUS_CODE'),
		blockPageTitle: optional(config, 'BLOCK_PAGE_TITLE'),
		blockResponseBody: optional(config, 'BLOCK_RESPONSE_BODY'),
		secretKey: await secret(secrets, 'SECRET_KEY'),
		cookieSecretValue: await secret(secrets, 'COOKIE_SECRET_VALUE'),
	};
}
