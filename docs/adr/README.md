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
| [0005](0005-i18n-infrastructure-brought-forward.md) | i18n infrastructure (German/English), brought forward from Phase 6 | Accepted |
| [0006](0006-event-base-table-with-per-type-detail-tables.md) | `Event` base table with per-type detail tables, starting with `FeedingDetail` | Accepted |
| [0007](0007-websocket-realtime-sync.md) | WebSocket real-time sync via Socket.IO, room-per-route, thin broadcast payload | Accepted |
| [0008](0008-pwa-basics-via-vite-plugin-pwa.md) | PWA basics via `vite-plugin-pwa` (`generateSW`), app-shell-only scope | Accepted |
| [0009](0009-indexeddb-optimistic-create-engine.md) | IndexedDB write-through and a shared optimistic-create engine for new entries | Accepted |
| [0010](0010-offline-sync-queue-reconnect-retry.md) | Offline sync-queue — reconnect-triggered resend with capped backoff, fixing the ghost-duplicate limitation | Accepted |
| [0011](0011-offline-edit-stop-and-last-write-wins.md) | Offline-capable edit/timer-stop, and Last-Write-Wins conflict resolution | Accepted |
