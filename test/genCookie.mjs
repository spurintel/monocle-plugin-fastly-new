// Mints a valid MCLVALID cookie for a given client IP, using the same
// HMAC-SHA256 scheme as src/cookies.ts. For local proxy-path testing only.
// Usage: node test/genCookie.mjs <ip> <hexSecret>
const ip = process.argv[2] ?? '127.0.0.1';
const hexSecret =
	process.argv[3] ?? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const hexToBuf = hex => new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
const bufToHex = buf =>
	Array.prototype.map.call(buf, x => x.toString(16).padStart(2, '0')).join('');

const key = await crypto.subtle.importKey(
	'raw',
	hexToBuf(hexSecret),
	{ name: 'HMAC', hash: 'SHA-256' },
	false,
	['sign', 'verify']
);
const expiry = Math.floor(Date.now() / 1000) + 3600;
const payload = `${ip}|${expiry}`;
const payloadBytes = new TextEncoder().encode(payload);
const sig = await crypto.subtle.sign('HMAC', key, payloadBytes);
console.log(`MCLVALID=${bufToHex(payloadBytes)}.${bufToHex(new Uint8Array(sig))}`);
