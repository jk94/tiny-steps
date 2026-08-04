# ADR-0009: IndexedDB write-through and a shared optimistic-create engine for new entries

## Status

Accepted

## Context

[ADR-0008](0008-pwa-basics-via-vite-plugin-pwa.md) deliberately scoped "PWA basics" to app-shell
installability only, leaving the [Phase 4 roadmap](../roadmap/phase-4-offline-pwa.md)'s "Lokale
Datenhaltung"/"Synchronisation" checklist items — IndexedDB storage, optimistic UI, a sync queue,
last-write-wins conflict resolution — as an explicitly separate, later slice. This decision covers
that next slice's first two items only:

- IndexedDB-Layer im Frontend für lokale Zwischenspeicherung neuer Einträge
- Optimistisches UI-Update: neue Einträge werden sofort angezeigt, bevor der Server bestätigt hat

The sync queue, last-write-wins conflict resolution, retry/backoff on failed sync, and the phase's
three offline-data test scenarios remain **unimplemented** and are not addressed here — nothing in
this ADR should be read as covering them.

Three design questions needed deciding:

1. One generic offline-write engine shared by Feeding/Sleep/Diaper, or three parallel per-domain
   implementations?
2. What happens to a locally-buffered entry if its create request fails — is it rolled back out of
   the UI (the standard TanStack Query optimistic-update recipe) or kept?
3. How are locally-buffered records identified and read back, and how do they coexist with the
   server-backed React Query cache without corrupting it?

Constraints already established elsewhere in the codebase that shaped this:

- Event creation already goes through three separate per-domain API modules
  (`feeding-api.ts`/`sleep-api.ts`/`diaper-api.ts`, per [ADR-0006](0006-event-base-table-with-per-type-detail-tables.md)'s
  base-table-plus-detail-table split), each with its own request/response shape.
- Server ids are cuids assigned by Prisma; nothing in the existing frontend ever generates an id
  client-side, so a scheme was needed that can never collide with (or be mistaken for) a real
  server id.
- Real-time sync ([ADR-0007](0007-websocket-realtime-sync.md)) already relies on React Query
  invalidation-then-refetch as its update mechanism, not sockets carrying full event bodies — this
  slice's read side follows the same pattern rather than introducing a second one.

## Decision

### a) One generic engine (`createEventOptimistically`), not three per-domain implementations

`apps/frontend/src/offline/createEventOptimistically.ts` implements the entire "write locally, show
immediately, reconcile with the server" flow once, generic over `T extends TimelineEventSummary`.
Each domain contributes only two small, domain-specific pieces appended to its existing API module
(e.g. `feeding-api.ts`): a `buildOptimisticFeedingSummary` function that synthesizes a
server-response-shaped row from the create input, and a thin `createFeedingEventOptimistic` wrapper
that calls the shared engine with that builder and the domain's real `createFeedingEvent` call.

The per-type summary builders deliberately mirror each backend service's actual field-defaulting
precedence — e.g. Feeding's breast-only `startedAt`/`occurredAt` fallback chain in
`FeedingService.create` — so the optimistic row looks like what the server will actually return, not
a generic placeholder. This was judged worth the duplication of that one piece of defaulting logic
per domain, since the base-table/detail-table split (ADR-0006) already means each domain's summary
shape and defaulting rules are irreducibly different; the alternative (a single generic summary
builder) would have needed domain-specific branching internally anyway.

This keeps the actually-shared, non-trivial logic (durable write-before-network-call ordering,
success/failure reconciliation, no-rollback-on-failure) in exactly one place, so a future
sync-queue slice only needs to change one file, not three.

### b) A failed create is kept in the UI, marked `failed` — not rolled back

On API failure, `createEventOptimistically` calls `markPendingEventFailed` and re-throws the
original error; it never deletes the buffered record. This is a deliberate deviation from the
textbook TanStack Query optimistic-update recipe (write optimistic state, roll it back on error).

Rolling back to nothing would defeat the entire point of local durability: the point of "lokale
Zwischenspeicherung" (per the roadmap wording) is that an entry the user just logged must not
silently vanish from the UI just because the network request failed at that moment — the far more
useful behavior is to keep it visible so the user can see it wasn't confirmed, and know a future
sync-queue slice will eventually need to act on it. A review pass confirmed this needed a visible
signal of its own (see `OfflineStatusBadge`, decision (d) below) — a kept-but-unlabeled failed row
would otherwise be indistinguishable from a confirmed one, misleading the user into believing it was
saved.

**Known, accepted limitation:** if a create fails and the user retries, the failed "ghost" record is
never cleaned up — it has a different local id than the eventual successful server row, so it
persists indefinitely alongside the real entry. There is no dedupe-by-content heuristic in this
slice. This is deliberately left for a future sync-queue slice to reconcile (e.g. by letting the
queue explicitly discard a `failed` record once the user has successfully re-submitted the same
logical entry); the failed-badge (decision (d)) only mitigates the *"did this save?"* confusion, not
the duplicate itself.

### c) Client-generated, prefixed ids; a single shared IndexedDB store; write before network

`apps/frontend/src/offline/pendingEvents.db.ts` (via the `idb` package, a new dependency — a thin
Promise-based wrapper over the raw IndexedDB API) defines one object store, `pendingEvents`, shared
across all three event types rather than one store per type — the record shape
(`PendingEventRecord`) is already generic over `EventType`, so a second store per domain would only
have added schema duplication for no isolation benefit (a per-child index already scopes reads).

- **Ids**: `localId` is client-generated as `` `local-${crypto.randomUUID()}` ``, always prefixed so
  it can never collide with, or be confused for, a server-assigned cuid. This matters for the merge
  step (decision (e)) and for a future sync-queue's ability to tell "still local, unconfirmed" ids
  apart from confirmed ones.
- **Indexing**: a compound index `byChild: ['householdId', 'childId']` lets every read (per-type
  Home pages, the untyped daily timeline) fetch its scope in one indexed query rather than a full
  store scan plus in-memory filtering.
- **Shape**: each record embeds a `summary` field shaped exactly like the eventual server response
  (`TimelineEventSummary`), so existing row-rendering components need zero transformation to display
  a pending record — they already know how to render a `TimelineEventSummary`.
- **Ordering**: the record is written to IndexedDB (`putPendingEvent`) *before* the API call fires.
  This ordering is the actual durability guarantee this ADR is about — if the API call is never
  reached at all (e.g. the tab is closed, or the request never leaves the browser), the entry has
  already survived to durable storage.

### d) Read side merges at render time; a visible badge distinguishes buffer state

Rather than writing pending records into the server query's own React Query cache in place, four
list/timeline components (Feeding/Sleep/Diaper home lists and the daily timeline) independently
fetch a separate, tiny "pending events" query (`usePendingLocalEvents`, backed by IndexedDB) and
merge it with the server query at render time (`mergeServerAndPendingEvents`). Mutating the server
query's cache directly was rejected because it would race against that query's own in-flight and
future refetches (e.g. the real-time-sync-driven invalidations from ADR-0007) — a merge computed
fresh on every render has no such race.

The merge returns a per-item `{ summary, localStatus? }` wrapper — `localStatus` is `undefined` for
an authoritative server row, and `'pending'`/`'failed'` for a locally-buffered one — rather than a
bare summary array with an unsafe cast, so a new `OfflineStatusBadge` component
(`apps/frontend/src/components/OfflineStatusBadge.tsx`) can render a small "Saving…"/"Not saved"
indicator (new i18n keys under `offline.status.*`) without either component needing to guess a
row's origin from its id shape. A pending record whose id already appears among the server events is
dropped by the merge, which is what makes the optimistic row disappear cleanly the instant its real
server row arrives, without a flash of the same entry appearing twice.

The daily timeline additionally filters pending records to the same `[from, to)` day window already
used for its server query (via the project's existing local-midnight-to-local-midnight
`dayBoundaries.ts` convention, see root `CLAUDE.md`'s Day-timeline bullet) — a review pass found
that without this, a failed *backfill* create (which, unlike quick-entry, can target a past date)
could leak onto today's timeline instead of the day it actually belongs to.

### Scope boundary: create flows only

This slice covers **new-entry creation only** — Quick-Entry and Backfill-Create, for all three event
types. Edits (`*EventEdit.tsx`) and timer-stops (`FeedingTimer.tsx`/`SleepTimer.tsx`) are
deliberately left on the pre-existing "call API, invalidate on success" pattern, unchanged by this
ADR. Two reasons: the roadmap wording is specifically "neue Einträge" (new entries), not edits; and a
timer-stop is a mutation of an existing row, not a new row appearing in a list, so it doesn't need
the same "make it visible before the server confirms" treatment this ADR is about.

## Consequences

**Positive:**

- The durability guarantee (an entry survives a failed or never-sent create) is real: the IndexedDB
  write happens strictly before the network call, not as a rollback-able optimistic cache patch.
- Exactly one place (`createEventOptimistically`) holds the actually-shared logic; adding this
  pattern to a future fourth event type, or building the sync queue on top of it, touches one file
  plus one small per-domain adapter.
- The render-time-merge read side (decision (d)) needs no coordination with, or special-casing in,
  the existing server-query invalidation logic from ADR-0007's real-time sync — it composes with it
  rather than fighting it.
- A failed create is visible and explained to the user (`OfflineStatusBadge`), not silently dropped
  or silently indistinguishable from a saved entry.

**Negative / tradeoffs:**

- A failed-then-retried create leaves a duplicate "ghost" record with no automatic cleanup (see
  decision (b)'s known limitation) until a future sync-queue slice addresses it.
- No retry/backoff is implemented at all in this slice — a `failed` record stays `failed` forever
  unless a human notices the badge and manually re-enters the data as a new entry.
- Four separate list/timeline components each call `usePendingLocalEvents` and
  `mergeServerAndPendingEvents` themselves rather than the server query's own hook doing it
  internally — slightly more call-site boilerplate, accepted in exchange for avoiding the cache-race
  problem decision (d) describes.
- A new devDependency (`idb`) was accepted in exchange for not hand-rolling the raw IndexedDB
  callback/event API, consistent with this project's ADR-0008 precedent of preferring a small,
  well-scoped dependency over hand-rolled browser-storage plumbing.

## Related

- [ADR-0008](0008-pwa-basics-via-vite-plugin-pwa.md) — the prior "PWA basics" slice this one
  continues; still the only place service-worker/manifest decisions live, unaffected by this ADR.
- [ADR-0007](0007-websocket-realtime-sync.md) — origin of the invalidate-then-refetch pattern this
  slice's read side (decision (d)) follows for its own pending-events query.
- [ADR-0006](0006-event-base-table-with-per-type-detail-tables.md) — origin of the per-domain
  API-module split that decision (a)'s per-domain adapters build on.
- [Phase 4 roadmap](../roadmap/phase-4-offline-pwa.md) — "Lokale Datenhaltung"'s first two checklist
  items are what this decision covers; "Synchronisation" and the three offline-data tests remain a
  separate, unimplemented later slice.
- `apps/frontend/src/offline/pendingEvents.db.ts` — the IndexedDB layer (decision (c)).
- `apps/frontend/src/offline/createEventOptimistically.ts` — the shared engine (decisions (a), (b)).
- `apps/frontend/src/offline/usePendingLocalEvents.ts` /
  `apps/frontend/src/offline/mergeServerAndPendingEvents.ts` — the read side (decision (d)).
- `apps/frontend/src/components/OfflineStatusBadge.tsx` — the pending/failed indicator (decision
  (d)).
- `apps/frontend/src/api/feeding-api.ts` (and the equivalent `sleep-api.ts`/`diaper-api.ts`) — the
  per-domain optimistic-summary builders and wrappers (decision (a)).
