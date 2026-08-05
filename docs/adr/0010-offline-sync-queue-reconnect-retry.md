# ADR-0010: Offline sync-queue — reconnect-triggered resend with capped backoff, fixing the ghost-duplicate limitation

## Status

Accepted

## Context

[ADR-0009](0009-indexeddb-optimistic-create-engine.md) implemented the first two [Phase 4
roadmap](../roadmap/phase-4-offline-pwa.md) "Synchronisation"-adjacent items — local IndexedDB
buffering and optimistic UI for new-entry creation — but explicitly left the remaining
"Synchronisation" checklist items unaddressed:

- Sync-Queue: bei fehlender Verbindung gesammelte Änderungen bei Reconnect an den Server senden
- Fehlerbehandlung bei fehlgeschlagenem Sync (z. B. Retry-Mechanismus)
- Konfliktbehandlung nach Last-Write-Wins-Prinzip (**still** out of scope after this ADR — see
  below)

This ADR covers the first two. It also directly resolves a limitation ADR-0009 itself documented
as accepted-but-unsolved: a failed create's local "ghost" record was never cleaned up on manual
retry, because retrying created a brand-new local record with a different `localId` than the
original failed one, so the ghost persisted indefinitely alongside the eventually-successful entry.

This is deliberately a **new ADR**, not an addendum to ADR-0009, even though it's a direct
continuation of that ADR's own "future work" note. Unlike [ADR-0006](0006-event-base-table-with-per-type-detail-tables.md)'s
Sleep/Diaper addenda — which each *confirmed or refined* an already-decided pattern (detail tables)
when an anticipated next case arrived — this slice introduces several genuinely new decisions with
their own tradeoffs (drain scope, trigger design, retry classification/backoff shape, concurrency
safety, and an explicitly accepted delivery-guarantee weakening) that ADR-0009 never addressed at
all, matching this project's existing precedent of giving each distinct Phase 4 slice its own ADR
(PWA basics as [ADR-0008](0008-pwa-basics-via-vite-plugin-pwa.md), the optimistic-create engine as
ADR-0009).

Five design questions needed deciding:

1. How can a retry resend *the same* buffered record instead of creating a new one, fixing the
   ghost-duplicate limitation at its root?
2. Should a drain pass be scoped to the currently-mounted household/child page, or cover every
   buffered record regardless of route?
3. What should trigger a drain attempt?
4. Which failures are worth retrying, and on what schedule?
5. What delivery guarantee is realistic to promise, given the constraints already in place?

Constraints already established elsewhere in the codebase that shaped this:

- `PendingEventRecord` (ADR-0009) only stored a response-shaped `summary`, not the original request
  body — nothing in the existing schema could reconstruct a request to resend.
- The plain per-domain create functions (`createFeedingEvent`/`createSleepEvent`/
  `createDiaperEvent`) already exist independently of their optimistic wrappers
  (`create*EventOptimistic`, ADR-0009 decision (a)) — a resend path can call them directly without
  going through the optimistic engine again.
- Real-time sync ([ADR-0007](0007-websocket-realtime-sync.md)) already established
  invalidate-then-refetch via React Query as this codebase's update mechanism; this slice's
  success path follows the same pattern rather than introducing another one.
- No backend changes are in scope for this slice (no Prisma schema changes, no idempotency-key
  column) — the resend mechanism has to work with what the API already accepts.

## Decision

### a) Persist the original `createInput` on the pending record — the actual ghost-duplicate fix

`PendingEventRecord` (`apps/frontend/src/offline/pendingEvents.db.ts`) gains an optional
`createInput?: unknown` field, and `createEventOptimistically` now takes and persists it verbatim
(the exact request body each domain's `create*EventOptimistic` wrapper was already about to send).
This is what makes resending *the same record* possible: the sync-queue no longer needs to guess or
reconstruct a request from the response-shaped `summary` — it replays the original one exactly.

No `idb` schema-version bump was needed for this (or the two fields below): `idb`'s `upgrade()`
callback only governs object-store/index structure, not the shape of stored values, so pre-existing
records simply lack the new keys. All new code treats `undefined` as an explicit default — "no
request body to resend" for `createInput` (see decision (d)), "zero attempts so far" for
`retryCount`, "eligible immediately" for `nextRetryAt`.

### b) A drain pass is global (household/child-agnostic), not scoped to the current page

`listAllPendingEvents()` (`pendingEvents.db.ts`) does a full scan of the `pendingEvents` store,
deliberately bypassing the existing `byChild` index that every other read in this module uses. The
sync-queue needs every buffered record regardless of which household/child page happens to be
mounted when connectivity returns — a family might have logged an entry for one child while offline,
then navigated elsewhere, and reconnection could happen on any route (or none, if the tab is just
sitting idle). A full scan was judged acceptable because the store's realistic size is a single
family's offline buffer (at most tens of records), not a dataset a full scan would meaningfully
strain.

### c) Two connectivity signals trigger a drain: `online` and Socket.IO reconnect

`SyncQueueProvider` (`apps/frontend/src/offline/SyncQueueProvider.tsx`), mounted in `main.tsx`
inside the existing `RealtimeProvider`, calls `drainPendingEventQueue()` on:

- the browser's `navigator.onLine`-backed `online` event — fast, local-only, and harmless if it
  fires spuriously (a doomed resend just fails and reschedules itself, see decision (d)).
- the Socket.IO connection's `isConnected` becoming `true` — authoritative, since a real handshake
  actually succeeded, unlike `online` which only reflects the OS/browser's network-interface state.

Both are used together rather than either alone, because they can each fire without the other
being reliable on its own — `online` can be wrong (the interface is up but the specific host is
unreachable), while relying on Socket.IO alone would miss a `fetch`-reachable-but-socket-still-
reconnecting window. `isConnected` is deliberately *not* gated on the existing per-route
"join a household room" logic (`useHouseholdRoom`) — the drain invalidates its own query keys
explicitly (decision (d)) rather than depending on an `event:changed` broadcast reaching a joined
room, so it works identically regardless of which route (if any) is currently mounted.

### d) Resend via the plain create functions, not through `createEventOptimistically` again

`resendPendingEvent` (`apps/frontend/src/offline/syncQueue.ts`) calls the domain's plain,
non-optimistic create function directly (`createFeedingEvent`/`createSleepEvent`/
`createDiaperEvent`, selected via a small `CREATE_FN_BY_EVENT_TYPE` map keyed on `EventType`),
never `createEventOptimistically`. Going through the optimistic engine again would write a second,
new buffered record before even attempting the network call — exactly the kind of duplication this
ADR exists to eliminate. On success, the *original* `localId` record is deleted directly
(`deletePendingEvent`), and both the pending-events query and the real per-domain server query
(via a newly-shared `EVENT_TYPE_QUERY_KEY_SEGMENT` map, extracted from `RealtimeProvider.tsx` into
`apps/frontend/src/api/event-api.ts` to avoid duplicating that mapping — a behavior-preserving DRY
refactor) are invalidated so the confirmed row replaces the optimistic one.

A record with no `createInput` (a legacy record written by a pre-sync-queue build still sitting in
a client's IndexedDB after an app update) is left `failed` forever rather than guessing a request
body for it — there is no way to resend what was never persisted.

### e) Failure classification and capped exponential backoff

Resend failures are classified via the existing `ApiError` type: `status >= 500` is treated as
retryable (transient server-side failure); a raw network failure with no `status` (e.g. `fetch`
throwing a `TypeError` while still offline) is also treated as retryable, since it's
indistinguishable from "still offline." An `ApiError` with `status < 500` (4xx) is treated as
**not** retryable — retrying an identical payload against a validation/authorization failure can't
succeed differently the second time.

Retryable failures get exponential backoff (`BASE_RETRY_DELAY_MS * 2 ** retryCount`, capped at
`MAX_RETRY_DELAY_MS` = 5 minutes) up to `MAX_RETRY_ATTEMPTS` = 6 total attempts, tracked via the new
`retryCount`/`nextRetryAt` fields (`markPendingEventRetryScheduled`). Both non-retryable failures
and cap-exhaustion reuse the exact same mechanism — `retryCount` is fast-forwarded to the cap —
rather than a separate "permanently abandoned" flag, so the same eligibility filter
(`retryCount < MAX_RETRY_ATTEMPTS`) already used to skip exhausted records also correctly skips a
4xx record without needing a second code path to check.

Due records are processed sequentially, oldest (`savedAt`) first, per drain pass — deliberately not
in parallel — so a long offline period doesn't burst many simultaneous POSTs at once, and so
server-side write ordering for a given child stays roughly deterministic.

### f) Single-flight guard and a self-rescheduling timer, not a fixed poll interval

`drainPendingEventQueue()` guards against overlapping runs with a module-level `drainPromise`,
mirroring the existing `refreshPromise` single-flight pattern already used in `http-client.ts` for
token refresh — a caller arriving mid-drain joins the in-flight run rather than starting a second
one. There is no fixed-interval polling timer; instead, each drain pass computes the soonest
still-pending `nextRetryAt` among records left in backoff and schedules exactly one `setTimeout` for
that instant (`scheduleNextDrain`), clearing and replacing any previously-scheduled timer on every
run so timers never stack. This means a lone remaining failure (e.g. the user closes the tab's
network tab metaphorically speaking — no further `online`/reconnect event ever fires) still
eventually retries on its own, without needing a general-purpose poll loop running at all times.

### g) Explicitly accepted: at-least-once delivery, not exactly-once

A resend can, in two identified scenarios, duplicate a server-side event even though nothing was
actually lost:

1. **Response-lost**: the original `POST` (from `createEventOptimistically`) actually succeeded
   server-side, but its response never reached the client — so the buffered record was never
   deleted — and a later drain resends it.
2. **In-flight overlap** (found and clarified during this slice's review round, the broader and
   more likely window): a record can still be `status: 'pending'` with its *original* `apiCall()`
   from `createEventOptimistically` genuinely still in flight — neither succeeded nor failed yet —
   when a connectivity-change trigger fires a drain pass concurrently. The eligibility filter only
   checks `retryCount`/`nextRetryAt`; it has no way to tell "still in flight" apart from "genuinely
   failed or never sent," so it can resend a record that was never actually lost.

Both are documented in a block comment at the top of `syncQueue.ts` rather than only here.
De-duplicating either scenario would need a backend idempotency-key column (out of scope: no
Prisma/schema changes in this slice) or content-based dedup, which is effectively part of the
still-deferred Last-Write-Wins conflict-resolution work. This is accepted as a narrow-exposure,
low-cost tradeoff (a resulting duplicate is a manually-deletable extra row, not data loss or
corruption) for the same class of reason ADR-0009 accepted its own scope boundary.

### h) Per-record error isolation within a drain pass

A failure in a step *other than* the create call itself — e.g. an IndexedDB delete or a query
invalidation throwing after a successful resend — is caught and logged per-record (`console.error`)
rather than aborting the rest of that drain pass; the affected record simply stays buffered and is
reconsidered on the next trigger. Separately, `drainPendingEventQueue()` itself guarantees its
returned promise always resolves (a top-level `.catch` inside the single-flight wrapper) — both of
its call sites (`SyncQueueProvider`'s event handlers and the self-rescheduling timer in decision
(f)) invoke it with `void` and no `.catch` of their own, so an unhandled top-level rejection was
judged unacceptable and is prevented at the source instead.

## Consequences

**Positive:**

- The ghost-duplicate limitation ADR-0009 explicitly flagged is fixed at its root: a retried record
  reuses its original `localId` and `createInput` rather than spawning a new local record.
- A user who logs entries offline and later reconnects no longer needs to notice a `failed` badge
  and manually re-enter data — the queue resolves itself autonomously in the common case.
- The single-flight guard and self-rescheduling timer (decision (f)) mean no background polling
  runs continuously; a drain only happens when there's an actual reason to believe one might
  succeed (a connectivity signal, or a previously-computed retry deadline).
- The two-signal trigger (decision (c)) and global scope (decision (b)) mean the queue drains
  correctly regardless of which page (if any) is mounted when connectivity returns.

**Negative / tradeoffs:**

- At-least-once, not exactly-once delivery (decision (g)) — a duplicate server-side event is
  possible, if rare, until either a backend idempotency key or content-based dedup exists. Currently
  only manually correctable (deleting the duplicate row).
- A legacy pending record from a pre-sync-queue app build (no `createInput`) can never be resent
  automatically — it stays `failed` forever, same end-user experience as before this slice for that
  narrow case.
- No manual "Retry now" UI was built — `drainPendingEventQueue()` is exported and reusable for one,
  but a user has no way to force an immediate retry attempt outside of the two automatic triggers
  (decision (c)) or waiting out the computed backoff.
- Sequential (not parallelized) resends (decision (e)) mean a large backlog drains more slowly than
  it theoretically could — accepted deliberately to avoid bursting the server and to keep
  server-side ordering roughly deterministic, and unlikely to matter at this app's realistic
  offline-buffer size (see decision (b)).

## Related

- [ADR-0009](0009-indexeddb-optimistic-create-engine.md) — the prior slice this one continues;
  specifically resolves its documented ghost-duplicate limitation (decision (b) there) and its
  explicitly-deferred sync-queue/retry scope.
- [ADR-0007](0007-websocket-realtime-sync.md) — origin of the invalidate-then-refetch pattern this
  slice's success path (decision (d)) reuses, and of the `isConnected` signal this slice's trigger
  (decision (c)) reads.
- [Phase 4 roadmap](../roadmap/phase-4-offline-pwa.md) — "Synchronisation"'s first two checklist
  items are what this decision covers; Last-Write-Wins conflict resolution and the phase's three
  offline-data tests remain a separate, unimplemented later slice.
- `apps/frontend/src/offline/syncQueue.ts` — the drain/retry/backoff engine (decisions (a), (d),
  (e), (f), (g), (h)).
- `apps/frontend/src/offline/SyncQueueProvider.tsx` — the connectivity-signal wiring (decision (c)).
- `apps/frontend/src/offline/pendingEvents.db.ts` — the `createInput`/`retryCount`/`nextRetryAt`
  schema additions and `listAllPendingEvents` (decisions (a), (b)).
- `apps/frontend/src/offline/createEventOptimistically.ts` — where `createInput` is captured and
  persisted on record creation (decision (a)).
- `apps/frontend/src/api/event-api.ts` — `EVENT_TYPE_QUERY_KEY_SEGMENT`, extracted from
  `RealtimeProvider.tsx` so both real-time invalidation and the sync-queue share one mapping
  (decision (d)).
