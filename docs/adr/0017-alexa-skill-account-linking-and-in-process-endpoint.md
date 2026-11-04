# ADR-0017: Alexa skill — built-in OAuth 2.0 account linking and an in-process skill endpoint

## Status

Accepted

## Context

Phase 8 adds an Alexa custom skill (see [`docs/roadmap/phase-8/`](../roadmap/phase-8/README.md)):
parents log feedings, diapers and sleep by voice, ask when something last happened, get a daily
summary, and set reminders. Alexa needs two things from us that the app did not have:

1. **Account linking.** Alexa links an Amazon account to an app account through OAuth 2.0 (the
   Authorization Code Grant). Our app is an OIDC *client* (ADR-0004) and keeps its own sessions in
   httpOnly cookies (ADR-0001); it was never an OAuth *authorization server*.
2. **A skill backend.** Every voice interaction arrives as a signed HTTPS request from Amazon
   carrying the linked user's bearer token. Amazon expects either an AWS Lambda ARN or a public
   HTTPS endpoint that verifies the request signature itself.

Constraints: the app is **self-hosted only** (PRD 5.0) — there is no central deployment that could
host one shared skill, and configuration lives in `config.yml`, not an admin UI. The permission
matrix (Phase 7.5) must hold for voice exactly as for the UI. Post-MVP rule of thumb: reuse domain
services rather than re-deriving rules.

## Decision

### 1. One private skill per instance, endpoint inside the backend

Each operator creates their own (development-stage, never certified) skill in the Alexa developer
console and points it at `https://<their-instance>/api/alexa/skill`. The repository ships the skill
package (`alexa/skill-package`) and a setup guide (`alexa/README.md`).

The skill endpoint is a NestJS controller in the existing backend (`src/alexa/`), **not** a Lambda
function and not a separate service:

- It calls `FeedingService`, `SleepService`, `DiaperService`, `EventService` and
  `HealthRecordService` in-process, so every domain rule (one running timer per child, amount
  limits via the same DTO classes, child scoping) and the realtime broadcast (ADR-0007) apply
  unchanged. A voice entry shows up on every other household member's screen immediately.
- A Lambda would put user data processing on AWS and need a second deployment artifact plus a
  network path back into the homelab — against the self-hosted principle, for no gain.

**Rejected: opening the existing REST routes to bearer tokens** and letting a thin skill call them
over HTTP. Every household route would gain a second authentication path that bypasses the CSRF
double-submit design, the Alexa token would carry far more power than the handful of voice actions
need, and the skill would still need its own endpoint for Amazon's signed requests. The voice
surface is instead an explicit, small allow-list of actions.

### 2. A minimal OAuth 2.0 authorization server for Alexa only

- `GET/POST /api/alexa/oauth/authorize` are called by an SPA consent page (`/alexa/link`), which is
  a normal protected route: whoever is not logged in signs in with a local account **or OIDC**
  (the OIDC login now carries a sanitized, same-origin `returnTo` path so it comes back to the
  consent page). Approval returns the redirect URL with a one-time code; denial returns
  `error=access_denied`. Both carry the original `state`.
- `POST /api/alexa/oauth/token` implements the `authorization_code` and `refresh_token` grants with
  mandatory client authentication (HTTP Basic or body credentials; secret compared in constant
  time). Errors follow RFC 6749 §5.2 (`invalid_client` → 401, everything else → 400), responses are
  `Cache-Control: no-store`.
- There is exactly **one client**, configured in `config.yml` (`alexa.clientId`,
  `alexa.clientSecret`, `alexa.redirectUris`), mirroring how OIDC providers are configured
  (ADR-0004: secrets in the git-ignored config file). Redirect URIs are matched **exactly**.
- PKCE (`S256` only) is verified when Alexa sends a challenge; it is optional because Alexa's
  account linking does not always send one, and the client is confidential anyway.
- Authorization codes live 5 minutes and are single-use; presenting a consumed code again revokes
  the link it produced (RFC 6749 §4.1.2).

**Tokens are opaque random strings stored only as SHA-256 hashes** (the invite-token pattern,
ADR-0002), not JWTs: unlinking in the app must take effect immediately, which a self-contained JWT
cannot do without a revocation list. Access tokens live 1 hour; several may be valid at once so a
refresh never breaks a request that is already in flight.

**Refresh tokens are not rotated**, deliberately unlike the browser sessions of ADR-0001. Alexa is a
confidential client: a refresh additionally needs the client secret, so a leaked refresh token
alone is useless, and RFC 6749 §6 explicitly allows keeping it. Rotation with reuse detection would,
on the other hand, turn a single lost refresh response (timeout between Amazon and a homelab) into
a revoked link and force the parent to re-link in the Alexa app. Revocation stays instant through
`AlexaAccountLink.revokedAt`.

**Rejected: delegating to an external identity provider** (e.g. letting Alexa talk to the
operator's Keycloak directly). It would only work for OIDC users, not for local accounts, would
require mapping the IdP's tokens back to our users on every request, and many homelab setups have
no IdP at all.

### 3. Request verification

Every skill request is verified before it is parsed into anything: the `SignatureCertChainUrl`
must be `https://s3.amazonaws.com/echo.api/…` (normalized, port 443), the downloaded chain must be
currently valid, carry `echo-api.amazon.com` in the leaf's SAN and chain up to a root in Node's
bundled CA store, and the `Signature-256` header must verify over the **raw** request body (Nest is
bootstrapped with `rawBody: true`). The request timestamp must be within 150 seconds and the
application ID must equal `alexa.skillId`. Failures answer `400` without detail. Certificate chains
are cached per URL until the leaf expires.

### 4. Identity and authorization inside the skill

- The acting user is the owner of the presented access token. If Alexa recognized a voice profile
  that linked its own account, `context.System.person.accessToken` wins over
  `context.System.user.accessToken`, so on a shared Echo each parent is attributed correctly.
- A child is resolved per request: spoken name (fuzzy, across all the user's households) → the
  link's default child → the only child → ask back. The user's `Membership` role for that child's
  household is then checked with the existing role bundles (`mayRecordEntries`); voice adds no new
  permission rules. Stopping someone else's timer stays allowed, as in the app.
- Reminders use the Alexa Reminders API with the request's `apiAccessToken`; a missing
  `alexa::alerts:reminders:skill:readwrite` permission triggers a voice permission request whose
  `token` carries the pending reminder, so it is created right after the user agrees.
- Times are spoken in the Echo device's time zone (Alexa Settings API, cached per device), falling
  back to the server's zone — the same simplification the push scheduler already lives with.

### 5. Customization

Responses are a per-locale catalog in code; operators may override any entry in
`alexa.responses.<de|en>.<key>`. Unknown keys and placeholders a template does not provide are
rejected at startup (fail-fast, like the rest of `config.yml`). Utterances and the invocation name
are customized in the operator's own interaction model, which they own anyway; a unit test keeps
the shipped models and the intent handlers in sync.

## Consequences

- Alexa is opt-in per instance and invisible when unconfigured: no `alexa` section → every Alexa
  route answers 404 and the profile page shows no Alexa block.
- The instance must be reachable from the internet over HTTPS with a publicly trusted certificate.
  This is a real exposure increase for a homelab; the setup guide says so, and the skill endpoint
  accepts nothing that fails Amazon's signature check.
- Amazon (like FCM for push, ADR-0012) becomes a processor of what is *spoken*: child names,
  activities and times pass through Alexa. This is the user's explicit choice per account, never a
  default.
- The OAuth server is intentionally minimal (one client, one scope, no dynamic registration, no
  introspection). Should a second voice assistant follow, it can become a list of clients.
- Behaviour against real Amazon infrastructure (voice permissions, reminder recurrence, voice
  profile tokens) cannot be exercised in CI and is tracked as a manual check in
  `docs/known-issues.md`.
