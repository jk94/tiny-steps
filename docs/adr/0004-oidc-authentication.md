# ADR-0004: OIDC authentication (Authorization Code Flow + PKCE), account-linking policy

## Status

Accepted

## Context

[Phase 1 roadmap](../roadmap/phase-1-auth-multiuser.md) requires OIDC authentication
("OIDC-Authentifizierung") on top of local email/password auth
([ADR-0001](0001-jwt-httponly-cookie-session-handling.md)) already implemented in an earlier
sub-step: Authorization Code Flow + PKCE against one or more config-driven providers (Keycloak,
Authentik, Google, Entra ID, …), provider-crossing user mapping between an external OIDC identity
and an internal `User` account, and a backend endpoint the frontend can query to know which
providers are configured. This sub-step is backend-only — the frontend login-provider-selection UI
and a manual account-linking endpoint are explicitly out of scope, deferred to a later sub-step.

Several design questions needed deciding, covered as separate points below.

## Decision

### 1. Direct `openid-client` service integration, not a Passport strategy

The roadmap's wording suggests `@nestjs/passport` + `openid-client`. Current `openid-client` (v6.x,
verified against its shipped type declarations) has a purely functional API —
`discovery()`, `buildAuthorizationUrl()`, `authorizationCodeGrant()`, `fetchUserInfo()`,
`randomState()`/`randomNonce()`/`randomPKCECodeVerifier()`/`calculatePKCECodeChallenge()` — with no
class shaped for a Passport `Strategy` subclass to wrap. Passport's model also assumes one strategy
*instance* per registered *name*, which doesn't fit this app's requirement of a dynamic,
config-driven list of providers whose count and ids aren't known until `config.yml` is read at boot.

**Decision**: drive `openid-client` directly from a NestJS service (`OidcService`,
`OidcProviderRegistry`), independent of `@nestjs/passport`. `@nestjs/passport`/`passport-jwt` are
untouched — `JwtStrategy`/`JwtAuthGuard` continue to protect resource routes exactly as before (see
ADR-0001); OIDC is a separate, parallel concern that ends at the same `issueSessionFor()` call local
login uses.

OIDC lives as a sub-folder of the existing `auth` module (`src/auth/oidc/`), not a new top-level Nest
module, to avoid a circular-import risk between two modules that would both need `AuthService`.

### 2. OIDC client secrets live in `config.yml`, not an env var

Unlike `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (a single, randomly generated value with no natural
"config" home), each OIDC provider's `clientSecret` is one field of a structured, variable-length,
per-provider list (`id`, `displayName`, `issuer`, `clientId`, `clientSecret`, `scopes`) — env vars
don't scale to "N providers, each with several fields" without inventing an indexed-env-var or
delimited-string convention. The PRD already requires file-based, multi-provider configuration.
`config.yml` is git-ignored and operator-managed like a secrets file (see `config.example.yml`'s
existing framing), so this is consistent with, not a departure from, the app's existing config
posture — just applied to a value shape that doesn't fit a single env var.

No env-var-interpolation-in-YAML mechanism exists in this codebase (e.g. `${SOME_ENV_VAR}`
substitution inside `config.yml`), and none is introduced for this — `clientSecret` is a plain string
field, same as every other provider field.

### 3. New `PUBLIC_URL` config value for redirect URI construction

OIDC `redirect_uri` values must byte-exact-match what's registered at the IdP. This app has zero
existing trusted-proxy configuration (no `app.set('trust proxy', ...)`, no `X-Forwarded-*` handling),
so deriving the redirect URI from `req.protocol`/`req.get('host')` would be unreliable — and
spoofable — behind an arbitrary self-hosted reverse-proxy setup.

**Decision**: add `PUBLIC_URL`, resolved by `src/config/public-url.ts` exactly like
`resolveDatabaseUrl()` (`src/config/database-url.ts`) — an env var overriding a fixed
`http://localhost:3000` code-level default for local dev, not read from `config.yml`. Used to build
`redirect_uri = ${resolvePublicUrl()}/api/auth/oidc/:providerId/callback`. Documented in
`.env.example`, `docker-compose.yml` (`PUBLIC_URL` passthrough), and the root README.

### 4. Cookie-based `state`/PKCE/`nonce` transaction storage, signed via the existing `JwtService`

No server-side session store exists in this app, and adding one solely to hold a few short-lived OIDC
values during the login→callback round trip would be disproportionate.

**Decision**: on `GET /api/auth/oidc/:providerId/login`, generate `state`, `nonce`, and a PKCE
`code_verifier`/`code_challenge` pair, and store `{ providerId, state, nonce, codeVerifier }` in a
single short-lived (~10 minutes), httpOnly, `SameSite=Lax`, `secure`-in-production cookie named
`oidc_txn`, scoped to `path: /api/auth/oidc`. The payload is signed via the *existing* `JwtService`
(already wired into `AuthModule`) using the access-token secret, with a short expiry and a
distinguishing `purpose: 'oidc-txn'` claim — reusing existing signing infrastructure rather than
inventing a second one (e.g. raw cookie-signing middleware). `GET /api/auth/oidc/:providerId/callback`
reads and verifies this cookie, confirms its embedded `providerId` matches the route param, passes
`expectedState`/`expectedNonce`/`pkceCodeVerifier` into `authorizationCodeGrant()`, and **always**
clears the cookie before responding — success or any error path — matching the single-use,
non-reusable spirit of ADR-0001's refresh-token rotation.

**Cross-acceptance concern, reasoned through explicitly**: because the `oidc_txn` token is signed
with the *same secret* as a real access token, signature verification alone can't distinguish the two
if an `oidc_txn` value were ever presented as the `access_token` cookie (e.g. copied there by hand).
In practice `JwtStrategy`'s cookie extractor only ever reads the `access_token` cookie — a different
name from `oidc_txn` — so this can't happen through the normal login/callback flow. As a structural
belt-and-braces guard anyway, `JwtStrategy.validate()` explicitly rejects any payload carrying a
`purpose` claim (real access tokens never set one) or a non-string `sub`, so even a deliberately
crafted request can't be authenticated with an `oidc_txn` token. See the code comments in
`src/auth/strategies/jwt.strategy.ts` and `src/auth/oidc/oidc-transaction-cookie.service.ts`.

### 5. Account-linking policy: unconditional email-match auto-linking

This is the most safety-relevant decision in this sub-step, so it's written out in full.

**The problem**: when an OIDC callback resolves to no existing `OidcIdentity` row for
`(providerId, subject)`, and the IdP-asserted `email` claim matches an existing local `User`'s email
(from local auth or a *different* OIDC provider), should the app link the two identities together?

**Options considered**:

1. **Never auto-link.** Any email collision is a hard failure (`email_in_use`); the user is directed
   to some other explicit account-linking flow. Safest, but requires building that flow (explicitly
   out of scope for this sub-step) and is the most friction for the common, legitimate case (a user
   who registered locally now wants to also log in via their company/Google/Entra ID account with the
   same email).
2. **Gate on `email_verified` plus a per-provider opt-in config flag.** Only auto-link when the IdP
   asserts `email_verified: true` *and* the operator has explicitly marked that provider as trusted
   for auto-linking. Meaningfully reduces the risk, at the cost of a new config field
   (`trustEmailVerification` or similar) and still leaving a decision the operator has to get right.
3. **Always auto-link unconditionally on email match**, with no `email_verified` inspection and no
   opt-in flag.

**Decision: option 3 — unconditional auto-linking — was chosen by explicit user direction**, after
the account-takeover risk was raised and acknowledged twice during planning. The risk: an IdP that
allows self-registration with an attacker-chosen, unverified email (or one the operator does not
fully control) could let an attacker claim an existing local user's email and thereby hijack that
user's account by simply completing an OIDC login with the matching address. **This is a deliberate,
documented risk acceptance, not an oversight.**

**Stated justification**: this app's realistic deployment context is small-scale, self-hosted,
family/household use, where the operator (the person editing `config.yml`) typically either runs the
IdP themselves or has personally vetted whatever IdP they point the app at — not an arbitrary public
identity provider serving untrusted third parties. Under that threat model, the convenience of one
account working across every configured login method was judged to outweigh the marginal risk, and
building option 1 or 2's extra flow/config surface for a risk that's structurally mitigated by the
deployment model wasn't judged worth it *for this sub-step*.

**Implementation**: `OidcService.resolveUser()` — on no existing `OidcIdentity` match, look up
`User` by the (trimmed/lowercased) `email` claim from the token response. If found, create an
`OidcIdentity` row pointing at that `User`, unconditionally — no inspection of `email_verified` at
all, regardless of whether the claim is `true`, `false`, or entirely absent. If not found, create a
new `User` (`passwordHash: null`) and its `OidcIdentity`. A missing `email` claim entirely is a hard
failure (`email_required`) — synthesizing a placeholder email was rejected as worse than failing
loudly, since `User.email` is `@unique` and used for local-auth login too. A `P2002` unique-constraint
catch around the new-`User`-creation path is a **concurrency safety net only** (two simultaneous OIDC
callbacks resolving the same brand-new email at the same instant), mapped to `email_in_use` — not a
second policy branch, since once *any* `User` with that email exists, the auto-link branch above
handles it.

**Forward-looking warning, restated in code and `config.example.yml`**: do **not** configure a
public/open-registration OIDC provider (e.g. a Google or Entra ID tenant not fully controlled by the
operator) without revisiting this decision first. Under this policy, anyone who can register or
control that email address at the IdP can log into the matching local account.

## Provider config schema

```yaml
auth:
  oidc:
    providers:
      - id: keycloak # URL-safe slug; used in routes and OidcIdentity.providerId
        displayName: "Keycloak"
        issuer: "https://keycloak.example.com/realms/family"
        clientId: "baby-tracker"
        clientSecret: "REPLACE_ME" # config.yml is a secrets file — see point 2 above
        scopes: ["openid", "profile", "email"] # optional, this is the default
```

Validated by `configuration.schema.ts` (Joi): required fields, `id` restricted to `[a-z0-9-]+` and
unique across the list, `issuer` must be a valid `http(s)` URL, `scopes` defaults to
`['openid', 'profile', 'email']` when omitted.

## Data model

```prisma
model OidcIdentity {
  id         String   @id @default(cuid())
  userId     String
  providerId String   // matches an OidcProviderConfig.id from config.yml — not a DB FK
  subject    String   // the OIDC `sub` claim
  createdAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@unique([providerId, subject])
}
```

Purely additive migration (`add_oidc_identity`) — a new table and unique index only, no changes to
any existing table.

## Endpoints

- `GET /api/auth/oidc/providers` — public, unauthenticated. Returns `{ id, displayName }` per
  configured provider, never `clientId`/`clientSecret`/`issuer`.
- `GET /api/auth/oidc/:providerId/login` — no auth guard; `404` for an unknown `providerId`. Sets the
  `oidc_txn` cookie and issues a `302` to the IdP's authorization endpoint.
- `GET /api/auth/oidc/:providerId/callback` — no auth guard; `404` for an unknown `providerId`. On
  success, sets the same `access_token`/`refresh_token`/`csrf_token` cookies a local login would (via
  the shared `AuthCookieService`, see below) and redirects to `/`. On any failure, redirects to
  `/login?oidc_error=<code>` — `invalid_state` (missing/invalid/expired `oidc_txn` cookie, or its
  embedded `providerId` doesn't match the route param), `idp_error` (the IdP returned `?error=...`),
  `auth_failed` (state/nonce/PKCE/token-exchange failure — logged server-side only), `email_required`
  (no `email` claim), or `email_in_use` (the `P2002` concurrency race, see point 5 above). The
  `oidc_txn` cookie is cleared on every exit path, success or failure. These fixed redirect targets
  are the frontend-integration contract for the not-yet-built login-selection UI — no frontend routes
  exist yet.

## Shared session/cookie infrastructure

`AuthService`'s token-issuance method — previously private, `issueTokenPair()` — is renamed to
`issueSessionFor(user)` and made non-private, becoming the single "start a session for this
now-resolved `User`" entry point for both local login (`AuthService.login()`/`register()`/`refresh()`)
and OIDC (`OidcService.handleCallback()`). It produces byte-identical `AuthResult` output (same
access/refresh JWTs, same `RefreshToken` row) regardless of which auth method resolved the `User`, so
downstream `JwtAuthGuard`/`@CurrentUser()` never special-case OIDC-originated sessions.

`AuthController`'s cookie-setting logic (`access_token`/`refresh_token`/`csrf_token`, previously
three private methods on the controller) was extracted into an injectable `AuthCookieService`, shared
by `AuthController` and the new `OidcController` — one place defining cookie names, scoping
(`path`/`httpOnly`/`sameSite`/`secure`/`maxAge`), and clearing behaviour for both auth entry points.

## Testing

Primary coverage is unit tests, in particular `oidc.service.spec.ts`, which locks in every
security-relevant decision from point 5 above (identity short-circuit, unconditional email-match
auto-linking with an explicitly-unverified-email fixture, missing-email failure, the `P2002`
concurrency race) without going over HTTP. One targeted integration test,
`test/oidc.e2e-spec.ts`, uses `nock` to intercept a fake issuer's discovery document, JWKS endpoint,
token endpoint, and userinfo endpoint, and drives the real `GET /login` → `GET /callback` sequence via
`supertest` against the fully booted `AppModule` — covering the same scenarios end-to-end plus the
IdP-error and tampered/missing-cookie paths. `openid-client`'s own protocol correctness (signature,
issuer/audience, PKCE math, discovery parsing) is treated as the library's responsibility, not
re-tested here; a full mocked-IdP-over-HTTP harness as *primary* coverage was deliberately avoided,
both for that reason and because this app's e2e harness has a documented, unrelated ~1-in-6
HTTP-round-trip flake (see `docs/known-issues.md`) that a multi-hop OIDC flow would be more exposed
to.

**Not automated, deliberately**: a real browser-driven round trip against a live IdP (e.g. a Keycloak
Testcontainer). A manual verification pass against a real IdP (Keycloak or Authentik) is recommended
before a first production deployment that enables OIDC — see Consequences below.

## Consequences

**Positive:**

- No new session-store or Passport-strategy infrastructure needed; OIDC reuses `JwtService`,
  `AuthCookieService`, and `AuthService.issueSessionFor()` end to end, so a session established via
  OIDC is indistinguishable from a local-auth session to every existing guard/decorator.
- Adding or removing providers is a pure `config.yml` change (plus a restart, since discovery happens
  fail-fast at boot) — no code change, migration, or admin UI needed, consistent with PRD 5.6.
- The `oidc_txn` cookie approach needed no new infrastructure (no session store, no separate signing
  secret) and is single-use/short-lived by construction.

**Negative / accepted trade-offs:**

- **The account-linking policy (point 5) is a real, accepted account-takeover risk under the wrong
  deployment.** It is safe under this app's expected small-scale, operator-trusted-IdP deployment
  model, and unsafe if that assumption is violated. This is the single most important thing a future
  reader of this ADR should internalize before configuring a new provider: **do not point this app at
  a public/open-registration OIDC provider you don't fully control without first revisiting this
  decision** (e.g. implementing option 2 above). Nothing in the code enforces this — it's a
  deployment-time judgement call, documented here and inline in `config.example.yml` and
  `OidcService`.
- No automated coverage against a real IdP implementation — protocol-level surprises specific to a
  given real-world IdP (Keycloak quirks, Entra ID's specific claim shapes, etc.) won't be caught by
  this test suite. Manual verification against at least one real IdP before enabling OIDC in a
  production deployment is recommended, not enforced.
- OIDC discovery failing for any single configured provider fails the *entire* app's boot (fail-fast,
  matching `loadConfiguration()`/`resolveJwtSecrets()`'s existing posture) — an operator who
  misconfigures one provider's `issuer` takes down local auth too, since the whole process won't
  start. Judged acceptable: a broken login button discovered only at a user's login attempt was
  judged worse than a loud, immediate boot failure an operator sees right away.
- A manual account-linking endpoint (for a user to deliberately link a *second* OIDC identity to their
  existing account outside of the automatic email-match path) is explicitly out of scope for this
  sub-step, as is the frontend login-provider-selection UI — both are later work.

## Related

- [Phase 1 roadmap](../roadmap/phase-1-auth-multiuser.md) — "OIDC-Authentifizierung" is the sub-step
  this decision was made for.
- [ADR-0001](0001-jwt-httponly-cookie-session-handling.md) — the JWT/cookie session infrastructure
  reused here (`JwtService`, `JwtAuthGuard`, `JwtStrategy`, refresh-token rotation).
- `apps/backend/src/auth/oidc/` — implementation (`oidc-provider-registry.service.ts`,
  `oidc-transaction-cookie.service.ts`, `oidc.service.ts`, `oidc.controller.ts`).
- `apps/backend/src/auth/auth-cookie.service.ts` — the shared cookie-setting helper extracted from
  `AuthController`.
- `apps/backend/src/config/oidc-provider.config.ts`, `public-url.ts` — new config surfaces.
- `apps/backend/prisma/schema.prisma` — `OidcIdentity` model.
- `config.example.yml` — annotated `auth.oidc.providers` example, including the account-linking
  warning.
- `docs/known-issues.md` — the pre-existing e2e HTTP flakiness this sub-step's e2e coverage was kept
  deliberately narrow to avoid compounding.
