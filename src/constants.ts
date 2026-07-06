export const COOKIE_NAME = 'MCLVALID';

// Names of the statically defined backends on the Monocle Compute service.
// The customer's origin/service is the ORIGIN backend; the Monocle Policy API
// is reached via the POLICY backend. Both must exist on the service version
// because js-compute requires every fetch() to name a backend.
export const ORIGIN_BACKEND = 'origin';
export const POLICY_BACKEND = 'monocle_policy';

// Resource-link names attaching the account-level stores to the service
// version. These are the names the runtime uses, and need not match the
// underlying store names.
export const CONFIG_STORE_NAME = 'monocle_config';
export const SECRET_STORE_NAME = 'monocle_secrets';

// Host for the Monocle Policy API. Note the `decrypt.` prefix: the backend
// SDK targets `https://decrypt.<baseDomain>/api/v1/policy`.
export const POLICY_API_URL = 'https://decrypt.mcl.spur.us/api/v1/policy';
