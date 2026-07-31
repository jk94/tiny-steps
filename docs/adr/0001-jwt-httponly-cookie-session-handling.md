# ADR-0001: JWT with httpOnly cookies for session/token handling

## Status

Accepted

## Context

[PRD section 5.1](../../Baby%20Tracking%20App%20PRD.md#51-authentifizierung) deliberately left the
session/token strategy open: "Session-Handling: JWT oder Server-Session, abhängig von gewähltem
Backend-Ansatz" ("JWT or server session, depending on the chosen backend approach"). This needed to
be decided as part of implementing local email/password authentication
([roadmap Phase 1](../roadmap/phase-1-auth-multiuser.md), "Lokale Authentifizierung").

Constraints that shaped the decision, per the PRD and roadmap:

- The backend is NestJS serving a React SPA over a single origin (no CORS) — see PRD 5.3.
- Local email/password and OIDC (Authorization Code Flow + PKCE) must coexist, with a user picking
  a method at login (PRD 5.1). Whatever session mechanism is chosen for local auth will also carry
  OIDC-authenticated sessions once that sub-step is implemented.
- A minimal native wrapper (Capacitor or Tauri, still undecided — see roadmap Phase 5) is required
  even for the MVP, because push notifications are implemented per-platform through the wrapper.
  This wrapper embeds a webview, not a full browser.
- Real-time sync between household members is planned via WebSockets (PRD 5.2, roadmap Phase 3),
  which will need to authenticate the socket connection using the same session mechanism.

A stateful server-session (cookie referencing server-side session storage) is the more traditional
default for a single-origin SPA, but was judged a worse fit here specifically because of the two
forward-looking requirements above: it adds a server-side session store dependency that doesn't
obviously extend well to WebSocket connection auth, and ties the native wrapper more tightly to
classic cookie-jar session semantics rather than a portable bearer credential.

## Decision

Use **JWT access + refresh tokens, delivered as httpOnly, secure cookies** (not
`localStorage`/`Authorization` header), with the following supporting design:

- **Access token**: short-lived (15 minutes), signed with `JWT_ACCESS_SECRET`, cookie scoped to
  `/api`. Contains only `{ sub: userId }` — the user is re-fetched from the DB on every request
  (see `JwtStrategy.validate`), so a deleted/disabled user is rejected even while their access
  token remains cryptographically valid.
- **Refresh token**: longer-lived (7 days), signed with `JWT_REFRESH_SECRET`, cookie scoped to
  `/api/auth` only. Unlike the access token, the refresh token is **stateful**: a `RefreshToken`
  Prisma model tracks issued sessions by row id, which doubles as the JWT's `jti` claim. This is a
  deliberate deviation from a "fully stateless" JWT design, because it's what makes real logout
  (revocation) and rotation possible:
  - `POST /api/auth/refresh` rotates the refresh token: the old row is atomically marked
    `revokedAt` (a conditional `updateMany` on `revokedAt: null`, not a read-then-write) and a new
    pair is issued. The atomicity closes a race where two concurrent requests using the same
    refresh token could otherwise both succeed.
  - **Reuse detection**: if a refresh token is presented that's already been rotated out (the
    conditional update matches zero rows), every active `RefreshToken` for that user is revoked.
    This is a theft-detection heuristic — legitimate clients never reuse an already-rotated token,
    so reuse is treated as a signal the token was intercepted.
  - `POST /api/auth/logout` revokes the current refresh token's row, which is real, server-enforced
    revocation — something a purely stateless JWT design cannot offer without either short TTLs
    only or a separate blocklist (which is effectively the same DB dependency, just inverted).
- **Secrets**: `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` are resolved from environment variables
  only (see `apps/backend/src/config/jwt.config.ts`), with **no code-level default** — the app
  fails to boot if either is missing, dev included. This mirrors the existing precedent for
  `DATABASE_URL` (Phase 0): secrets/connection-string-like values are kept out of `config.yml` to
  avoid config/env drift.
- **`auth.local.enabled` config flag** (`LocalAuthEnabledGuard`) gates `register` and `login` only
  (returning 404, not 403, so a deployment offering only OIDC doesn't reveal local auth exists at
  all). It deliberately does **not** gate `refresh`, `logout`, or `me` — those must keep working
  regardless of which login mechanism originally issued the session, since local and (later) OIDC
  sessions share this same token infrastructure.
- **CSRF posture**: no CORS is enabled at all (single-origin deployment — the Nest backend serves
  the built SPA), and cookies use `SameSite=Lax`. `SameSite=Strict` was considered and rejected
  because it would break the OIDC redirect-callback flow planned for the next roadmap sub-step (the
  browser navigating back from the OIDC provider is a cross-site top-level navigation). As
  defense-in-depth on top of `SameSite=Lax` + no CORS, a double-submit `csrf_token` cookie
  (non-httpOnly, readable by same-origin JS) plus `CsrfGuard` (requires a matching `X-CSRF-Token`
  header) protects the authenticated, state-changing routes `refresh` and `logout`. This extra
  layer specifically anticipates the planned Capacitor/Tauri native wrapper (Phase 5), whose
  embedded webviews have historically had inconsistent `SameSite` enforcement.
- **Password hashing**: Argon2 with library defaults (already OWASP-recommended parameters) — no
  custom tuning.
- **Email normalization**: emails are trimmed and lowercased before validation, storage, and
  lookup, to avoid case-sensitive duplicate-account bugs.
- **Timing-safe login**: a dummy Argon2 hash is precomputed once at service startup and verified
  against on every login attempt for a nonexistent user (or a user without a local password, e.g.
  OIDC-only), so `login()`'s response-time profile doesn't leak whether an email is registered.

## Consequences

**Positive:**

- Stateless-friendly access-token validation (no DB hit needed to check a signature/expiry, only
  the identity re-fetch) scales well and fits a later native wrapper, which can treat cookies as an
  opaque bearer credential without needing server-side session affinity.
- Real logout and theft-detection are possible despite using JWTs, because the refresh token is
  DB-backed — this was the main gap a "fully stateless" JWT design would have had.
- The rotation/reuse-detection design is a known, documented pattern (OAuth2 refresh token
  rotation), not a bespoke invention, making it easier for future contributors to reason about.
- Cookie-based delivery (vs. `localStorage`) avoids exposing tokens to XSS-readable JS storage;
  `httpOnly` + `secure` (in production) + `SameSite=Lax` cover the common attack surface, with the
  CSRF guard covering what `SameSite=Lax` alone doesn't.
- The same token/cookie infrastructure is designed to be reused as-is by the OIDC sub-step and by
  WebSocket auth in Phase 3 — no separate session mechanism needs to be built for those.

**Negative / tradeoffs:**

- Not fully stateless: every `refresh` call requires a DB read + atomic write against
  `RefreshToken`, and `logout` requires a DB write. This is an accepted tradeoff for real
  revocation; it does not affect the (more frequent) access-token-only request path, which stays
  DB-free apart from the per-request user lookup.
- Two secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) must be provisioned and kept out of
  version control for every environment, including local dev — there is no fallback, so a missing
  secret is a hard boot failure rather than a silently insecure default. This is intentional (see
  Decision) but is a slightly higher setup bar than a zero-config default would be; it's documented
  in `README.md` and `.env.example`.
- The CSRF double-submit cookie adds a small amount of client-side complexity (the SPA must read
  the `csrf_token` cookie and echo it in an `X-CSRF-Token` header on `refresh`/`logout`) that a
  pure `SameSite=Strict` cookie setup wouldn't need — accepted because `Strict` isn't viable once
  the OIDC redirect flow lands.
- Reuse-detection's "revoke all sessions" response to a detected replay is a blunt instrument (it
  logs out every device, not just the suspicious one) — acceptable for MVP scope but worth
  revisiting if false positives from double-fired requests (e.g. flaky mobile networks retrying a
  refresh) turn out to be common in practice.
- The native wrapper (Capacitor or Tauri, still undecided per roadmap Phase 5) must be verified
  against this cookie-based design once that choice is made; embedded-webview cookie handling was
  a design input here but hasn't been tested end-to-end yet since Phase 5 isn't implemented.

## Related

- [Phase 1 roadmap](../roadmap/phase-1-auth-multiuser.md) — "Lokale Authentifizierung" is the
  sub-step this decision was made for; OIDC, roles/household, and child profiles are separate,
  not-yet-implemented sub-steps of the same phase that will build on this token/cookie
  infrastructure.
- `apps/backend/src/auth/` — implementation (`auth.controller.ts`, `auth.service.ts`,
  `guards/csrf.guard.ts`, `guards/jwt-auth.guard.ts`, `guards/local-auth-enabled.guard.ts`,
  `strategies/jwt.strategy.ts`).
- `apps/backend/src/config/jwt.config.ts` — secret resolution and token TTLs.
- `apps/backend/prisma/schema.prisma` — `RefreshToken` model.
