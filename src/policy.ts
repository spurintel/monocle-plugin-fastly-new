import { POLICY_API_URL } from './constants';

/**
 * Raised when the Monocle Policy API returns a non-2xx response. The status is
 * kept so callers can special-case it (e.g. 404 = no policy configured).
 */
export class MonocleAPIError extends Error {
	status: number;
	constructor(status: number, statusText: string) {
		super(`Monocle API error: status ${status} ${statusText}`);
		this.name = 'MonocleAPIError';
		this.status = status;
	}
}

export interface MonoclePolicyDecision {
	allowed: boolean;
	[key: string]: unknown;
}

/**
 * Evaluates an encrypted assessment against the account's Monocle policy.
 *
 * This inlines the managed Policy API call from `@spur.us/monocle-backend`
 * (never the local-decryption path) so the plugin has no Node/jose dependency
 * and stays small enough for the Compute runtime. The request must be routed
 * through a named backend because js-compute requires one for every fetch().
 */
export async function evaluateAssessment(
	assessment: string,
	secretKey: string,
	backend: string
): Promise<MonoclePolicyDecision> {
	const response = await fetch(POLICY_API_URL, {
		method: 'POST',
		backend,
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'User-Agent': 'monocle-plugin-fastly',
			TOKEN: secretKey,
		},
		body: JSON.stringify({ assessment }),
	});

	if (!response.ok) {
		throw new MonocleAPIError(response.status, response.statusText);
	}

	// Validate the shape rather than trusting the cast: an unexpected-but-2xx
	// body would otherwise read `allowed: undefined` (falsy) and hard-BLOCK the
	// visitor, while an outright API failure fails open. Throwing here routes a
	// malformed success through the same fail-open handling as other errors.
	const decision = (await response.json().catch(() => null)) as MonoclePolicyDecision | null;
	if (decision === null || typeof decision !== 'object' || typeof decision.allowed !== 'boolean') {
		throw new MonocleAPIError(response.status, 'malformed policy response');
	}
	return decision;
}
