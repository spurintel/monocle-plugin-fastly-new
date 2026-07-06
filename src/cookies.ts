import { COOKIE_NAME } from './constants';
import type { MonocleConfig } from './config';

/**
 * Parses a cookie header string into a record of cookie name-value pairs.
 */
export function parseCookies(header: string | null): Record<string, string> {
	const list: Record<string, string> = {};
	if (!header) return list;
	header.split(';').forEach(cookie => {
		let [name, ...rest] = cookie.split('=');
		name = name?.trim();
		if (name) {
			list[name] = rest.join('=').trim();
		}
	});
	return list;
}

/**
 * The cookie payload (`<clientIp>|<expiryUnixSeconds>`) is not secret — it only
 * needs to be tamper-proof so a client cannot forge or extend it. We therefore
 * sign it with HMAC-SHA256 rather than encrypt it.
 *
 * Note: the Cloudflare worker uses AES-GCM, but Fastly's Compute runtime does
 * not implement AES-GCM in SubtleCrypto (only HMAC / RSASSA sign+verify). Since
 * each edge issues and validates its own cookie with its own COOKIE_SECRET,
 * using HMAC here has no cross-provider impact.
 */
async function importHmacKey(hexSecret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		hexToBuf(hexSecret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
}

/**
 * Issues a signed cookie binding the client IP and a 1-hour expiry.
 * The client IP comes from the Compute request context (event.client.address).
 */
export async function setSecureCookie(clientIp: string | null, config: MonocleConfig): Promise<Headers> {
	if (!clientIp) {
		console.log('ERROR: No client IP available on the request context.');
	}
	const expiryTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
	const payload = `${clientIp}|${expiryTime}`;

	const key = await importHmacKey(config.cookieSecretValue);
	const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));

	const cookieValue = `${bufToHex(new TextEncoder().encode(payload))}.${bufToHex(new Uint8Array(signature))}`;

	const headers = new Headers();
	headers.append(
		'Set-Cookie',
		`${COOKIE_NAME}=${cookieValue}; Secure; HttpOnly; Path=/; SameSite=Lax`
	);
	return headers;
}

/**
 * Validates the signed cookie: verifies the HMAC, then checks the bound client
 * IP and expiry.
 */
export async function validateCookie(
	cookieHeader: string | null,
	clientIp: string | null,
	config: MonocleConfig
): Promise<boolean> {
	if (!clientIp) {
		console.log('ERROR: No client IP available on the request context.');
	}
	if (!cookieHeader) {
		return false;
	}

	const cookies = cookieHeader.split(';').map(c => c.trim());
	const mclValidCookie = cookies.find(c => c.startsWith(`${COOKIE_NAME}=`));
	if (!mclValidCookie) {
		return false;
	}

	const cookieValue = mclValidCookie.slice(`${COOKIE_NAME}=`.length);
	const [payloadHex, signatureHex] = cookieValue.split('.');
	if (!payloadHex || !signatureHex) {
		return false;
	}

	const payloadBytes = hexToBuf(payloadHex);
	const key = await importHmacKey(config.cookieSecretValue);

	let valid: boolean;
	try {
		valid = await crypto.subtle.verify('HMAC', key, hexToBuf(signatureHex), payloadBytes);
	} catch (error) {
		console.log(`Error verifying cookie signature: ${error}`);
		return false;
	}
	if (!valid) {
		return false;
	}

	const [clientIpAddress, expiryTime] = new TextDecoder().decode(payloadBytes).split('|');

	if (clientIp !== clientIpAddress) {
		console.log(`Mismatch IP address. Expecting ${clientIpAddress}, Got ${clientIp}`);
		return false;
	}

	if (Math.floor(Date.now() / 1000) >= parseInt(expiryTime ?? '0', 10)) {
		console.log('Cookie has expired.');
		return false;
	}

	return true;
}

function bufToHex(buffer: Uint8Array): string {
	return Array.prototype.map.call(buffer, (x: number) => x.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex: string): Uint8Array {
	const matches = hex.match(/.{1,2}/g);
	if (!matches) return new Uint8Array();
	return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}
