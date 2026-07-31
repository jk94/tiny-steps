# ADR-0002: Application-level household roles, and hashed-token invites

## Status

Accepted

## Context

[Phase 1 roadmap](../roadmap/phase-1-auth-multiuser.md) requires completing the `Membership` role
model (Owner/Co-Parent for MVP, per [PRD section 3](../../Baby%20Tracking%20App%20PRD.md#3-user-rollen))
and a household invite mechanism ("Einladungsmechanismus per Link oder Code"), on top of the local
email/password auth already implemented in [ADR-0001](0001-jwt-httponly-cookie-session-handling.md).

Two design questions needed deciding:

1. **How is `Membership.role` typed and validated?** The `Membership` model already existed
   (Phase 0) with `role` as a placeholder `String` column. The natural next step would be a Prisma
   `enum`. However, Prisma's `enum` type is **not supported on the SQLite connector** — declaring
   one alongside `datasource db { provider = "sqlite" }` fails schema validation with error P1012.
   Since this project uses SQLite for the MVP (see PRD 5.6) and the schema is meant to stay portable
   to PostgreSQL/MySQL later, this limitation needed an explicit answer now rather than being
   rediscovered mid-migration.
2. **How are invites represented and delivered?** The roadmap asks for "per Link oder Code" — a
   shareable secret an existing household member (initially: an Owner) hands to a prospective
   member, who then redeems it to receive a `CO_PARENT` `Membership`.

## Decision

### Roles stay a plain `String`, validated at the application layer

`Membership.role` (and, by the same reasoning, the new `Invite.role`) remain `String` columns —
this is a **permanent** design choice, not a stepping stone toward a future Prisma `enum`. A
TypeScript `HouseholdRole` enum (`src/household/household-role.enum.ts`) is the single source of
truth for valid values (`OWNER`, `CO_PARENT` for MVP), paired with a `toHouseholdRole(value: string)`
cast function that throws on any unrecognized value. Every read of a role out of Prisma (guards,
services, controllers) goes through this cast rather than comparing raw strings — this is the
defensive boundary that makes up for the DB column not being type-checked at the schema level.

This same pattern (`Event.type` is already a placeholder `String` for the same reason) will recur
in a later Phase 1/2 sub-step when `Feeding`/`Sleep`/`Diaper` event types are implemented — this
ADR's rationale applies there too, so that sub-step should reuse the pattern rather than re-litigate
it.

Given this, the `Invite` migration (adding the `Invite` model) is a **pure additive `CREATE TABLE`**
— no `ALTER TABLE` on the existing `Membership` table, no data migration, no risk to already-issued
`RefreshToken`/`User` rows.

### Invites: single-use, hashed, time-limited tokens

- **Token generation**: `crypto.randomBytes(32).toString('base64url')` — 256 bits of entropy,
  URL-safe. Generated in `InviteService.create()`, shown once in the API response, and never
  logged or re-derivable from what's persisted.
- **Storage**: only a SHA-256 hash of the token (`Invite.tokenHash`, unique-indexed) is stored, not
  the raw value — mirroring the "don't persist secrets in retrievable form" posture already used
  for passwords (Argon2) in ADR-0001, though a fast hash (not Argon2) is appropriate here because
  the input is a high-entropy random token, not a low-entropy user-chosen secret; there's no
  brute-force-by-guessing risk a slow hash would need to defend against.
- **Lifecycle columns**: `expiresAt` (7-day TTL, `INVITE_TOKEN_TTL_MS`), `revokedAt`, `acceptedAt` +
  `acceptedByUserId`. `revokedAt` has no endpoint that sets it yet — invite revocation and a
  list-pending-invites endpoint were explicitly deferred out of this sub-step's scope — but the
  column is cheap to add now and avoids a future migration once revocation is built.
- **Two-tier error disclosure**: `GET /api/invites/:token` (unauthenticated, used to preview an
  invite before the invitee logs in/registers) distinguishes `invalid`/`expired`/`used`/`revoked`/
  `valid` statuses, since a helpful preview is the point of that endpoint. `POST
  /api/invites/:token/accept` (authenticated, state-changing) deliberately collapses all invalid
  states into a single `404 NotFoundException` — more specific errors aren't useful to a legitimate
  caller at that point and would otherwise let an attacker distinguish "wrong token" from
  "correct-but-already-used token" while probing.
- **Idempotent acceptance**: if the accepting user already has a `Membership` in the target
  household (e.g. they're re-accepting a second invite, or a race with another accept), no
  duplicate `Membership` row is created, but the invite is still consumed (`acceptedAt`/
  `acceptedByUserId` stamped) so it can't be replayed indefinitely. Both the membership
  creation-or-skip and the invite-consumption write happen inside one `prisma.$transaction(...)` —
  they must succeed or fail together, since a crash between them would otherwise leave a token that
  looks unused but silently can never grant a fresh membership (or vice versa: a granted membership
  with a still-usable token).
- **Role granted is fixed server-side**: every invite created via `POST
  /api/households/:householdId/invites` is minted with `role: CO_PARENT` — there's no way for the
  inviter to specify a role in the request, and only `OWNER` members may create invites at all
  (enforced by `@RequireRole(HouseholdRole.OWNER)` on `HouseholdMembershipGuard`). This keeps
  privilege escalation out of the invite flow entirely for MVP; a later sub-step can revisit this if
  a use case for Owner-inviting-Owner emerges.

### Household-membership access control

`HouseholdMembershipGuard` enforces "a user may only access households they belong to" (PRD section
3) for any route with a `:householdId` path param. It must run after `JwtAuthGuard` in a route's
`@UseGuards(...)` array (it reads `request.user`, which `JwtAuthGuard` populates), resolves the
caller's `Membership` via the existing `@@unique([userId, householdId])` constraint, throws
`NotFoundException` if none exists (not `ForbiddenException` — a non-member shouldn't be able to
distinguish "household doesn't exist" from "household exists but I'm not in it"), and optionally
enforces a role via the `@RequireRole(...)` decorator/`Reflector` metadata. The membership lookup
itself is extracted into `HouseholdAccessService.findMembershipOrThrow()`, callable independently of
the guard's `CanActivate` interface, so a future child-scoped guard (not built in this sub-step) can
resolve `child.householdId` first and then delegate to the same lookup/404 semantics without
duplicating the Prisma query.

## Consequences

**Positive:**

- No risky/awkward migration is needed if a future sub-step tries to introduce a Prisma `enum` —
  there was never an intent to move away from `String`, so there's no migration debt accruing.
- The invite flow follows a well-understood pattern (single-use hashed token with TTL, similar in
  spirit to password-reset tokens), making it easy for future contributors to reason about.
- The idempotent-accept + transactional design avoids a class of bugs around double-invite races
  (e.g. an Owner re-inviting someone who already joined via a different invite) without needing a
  separate "already a member" error path in the API.

**Negative / tradeoffs:**

- Role values have zero DB-level integrity checking — a bug or manual DB edit that writes an
  invalid string into `Membership.role`/`Invite.role` will surface as a thrown error the next time
  that row is read through `toHouseholdRole()`, not as a write-time rejection. This is judged
  acceptable because all writes to these columns go through the small set of services in
  `src/household/`, none of which ever write anything other than a `HouseholdRole` enum value.
- Invite revocation and a "list pending invites for a household" endpoint are known gaps (the
  `revokedAt` column exists but nothing sets it, and there's no way to enumerate outstanding
  invites) — deferred by explicit product decision for this sub-step, tracked as a fast-follow.
- The 7-day invite TTL is a fixed constant (`INVITE_TOKEN_TTL_MS`), not configurable — acceptable
  for MVP; revisit if operators need a shorter/longer window.

## Related

- [Phase 1 roadmap](../roadmap/phase-1-auth-multiuser.md) — "Rollen- & Rechtemodell" and "Haushalt &
  Einladung" are the sub-steps this decision was made for.
- [ADR-0001](0001-jwt-httponly-cookie-session-handling.md) — the auth/session infrastructure this
  sub-step builds on (`JwtAuthGuard`, `CsrfGuard`, `@CurrentUser()`).
- `apps/backend/src/household/` — implementation (`household-role.enum.ts`, `household.service.ts`,
  `household.controller.ts`, `invite.service.ts`, `invite.controller.ts`, `invite-token.util.ts`,
  `guards/household-membership.guard.ts`, `guards/require-role.decorator.ts`,
  `household-access.service.ts`).
- `apps/backend/prisma/schema.prisma` — `Membership`, `Invite` models.
