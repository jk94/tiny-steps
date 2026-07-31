# Architecture Decision Records

This directory records significant architectural decisions for the Baby Tracking App, using the
lightweight [ADR format popularized by Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

Unlike the [PRD](../../Baby%20Tracking%20App%20PRD.md) and [roadmap](../roadmap/README.md), which
are written in German (product-facing scope/requirements documents), ADRs are written in English,
consistent with this repo's convention that code and code-level/engineering documentation are
English (see root `CLAUDE.md`).

## When to add an ADR

Add an ADR when a decision is architecturally significant and either:

- Was left open in the PRD (e.g. "JWT or server session, depending on chosen backend approach")
  and has now been made concretely, or
- Deviates from what the PRD/roadmap describe, or
- Is easy to get wrong or re-litigate later without the original context (e.g. security posture,
  token/session strategy, data-consistency tradeoffs).

Small, purely-local implementation choices (a variable name, a helper function's shape) don't need
an ADR — inline code comments are the right place for those.

## Format

```markdown
# ADR-NNNN: Title

## Status
Proposed | Accepted | Deprecated | Superseded by ADR-NNNN

## Context
## Decision
## Consequences
```

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-jwt-httponly-cookie-session-handling.md) | JWT with httpOnly cookies for session/token handling | Accepted |
| [0002](0002-application-level-household-roles-and-invites.md) | Application-level household roles, and hashed-token invites | Accepted |
| [0003](0003-child-photo-storage-on-local-disk.md) | Child profiles, role-scoped edit/delete, and local-disk photo storage | Accepted |
| [0004](0004-oidc-authentication.md) | OIDC authentication: direct `openid-client` integration, and the unconditional email-match account-linking policy | Accepted |
