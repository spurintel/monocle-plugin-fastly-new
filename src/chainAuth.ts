/**
 * Builds the time-limited chaining signature sent to the customer's existing
 * service: `<unix seconds>.0x<hmac-sha256 hex>`. The HMAC is keyed with the
 * UTF-8 bytes of the shared secret STRING (not hex-decoded), because the VCL
 * guard recomputes it as `digest.hmac_sha256("<secret>", timestamp)`, which
 * keys on the literal string. The `0x` prefix and lowercase hex likewise match
 * VCL's output so the guard can compare the values directly.
 *
 * `nowSeconds` is injectable for tests; production callers omit it.
 */
export async function buildChainAuthHeader(
	secret: string,
	nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<string> {
	const timestamp = String(nowSeconds);
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const mac = new Uint8Array(
		await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(timestamp))
	);
	const hex = Array.prototype.map
		.call(mac, (b: number) => b.toString(16).padStart(2, '0'))
		.join('');
	return `${timestamp}.0x${hex}`;
}
