# monocle-plugin-fastly

Monocle edge assessment and policy-based blocking for [Fastly Compute](https://www.fastly.com/documentation/guides/compute/), ported from [`monocle-plugin-cloudflare`](../monocle-plugin-cloudflare).

The plugin runs as a Compute service that fronts an existing Fastly customer's
site. Uncookied visitors are served an interstitial that collects a Monocle
assessment; the assessment is evaluated against the account's Monocle policy at
the edge, and on success a signed cookie is issued that gates access to the
origin.

## Request flow

```
Visitor ── uncookied ─▶ interstitial (mcl.js) ── POST assessment ─▶ Policy API (decrypt.mcl.spur.us)
                                                                         │
                              allowed ── set MCLVALID cookie ◀───────────┤
                              blocked ── block response ◀────────────────┘

Visitor ── valid MCLVALID cookie ─▶ fetch(origin backend) ─▶ origin
```

## Architecture notes

- **Two static backends** are required because js-compute needs a named backend
  for every `fetch()`: `origin` (the customer's site) and `monocle_policy`
  (the Policy API). Dynamic backends are avoided so the plugin does not depend
  on that account feature.
- **Config** is read at request time from a Config Store (`monocle_config`,
  non-secret) and a Secret Store (`monocle_secrets`: `SECRET_KEY`,
  `COOKIE_SECRET_VALUE`), attached to the service version as resource links.
- The **Policy API call is inlined** (see [`src/policy.ts`](src/policy.ts))
  rather than depending on `@spur.us/monocle-backend`, keeping the package small
  and free of Node/`jose` dependencies.
- The client IP for the cookie binding comes from `event.client.address`.
- **Path scoping and cookie validation happen in the handler, not Fastly's
  routing layer.** Fastly's Request Routing (June 2026) can route paths on a
  domain to different services, but its conditions only pattern-match header
  values and cannot verify an HMAC, so any rule that routes on the `MCLVALID`
  cookie is a trivial challenge bypass: `MCLVALID=<any value>` satisfies the
  condition and reaches the origin unchallenged (confirmed by testing). Cookie
  verification must stay in compute. Routing configs remain usable for pure
  path scoping (cookie never influencing routing), but that forfeits their main
  benefit, so scoping ships in the handler via `PROTECTED_PATHS`.

## Develop

```bash
npm install
npm run build            # bundle + compile to bin/main.wasm
fastly compute serve     # run locally with Viceroy (uses [local_server] config)
npm test                 # run the handler logic tests
```

## Release

Pushing a `v*` tag builds the Wasm package and publishes it as a GitHub Release
asset (see [`.github/workflows/release.yml`](.github/workflows/release.yml)),
which the Spur web app deploys via the Fastly API.
