# ADR-0011: Offline-capable edit/timer-stop, and Last-Write-Wins conflict resolution

## Status

Accepted

## Context

[ADR-0009](0009-indexeddb-optimistic-create-engine.md) and
[ADR-0010](0010-offline-sync-queue-reconnect-retry.md) made **new-entry creation** offline-capable
(IndexedDB write-through, optimistic UI, reconnect-triggered resend). Two [Phase 4
roadmap](../roadmap/phase-4-offline-pwa.md) items were still open after them:

- Konfliktbehandlung nach Last-Write-Wins-Prinzip, basierend auf dem Zeitstempel des Ereignisses
  (PRD 5.4: "Last-Write-Wins reicht für den MVP aus").
- Its unstated prerequisite: only _create_ was offline-capable; **edit (PATCH) and timer-stop** still
  went straight to the network with no buffering, optimistic UI, or resend — so there was nothing for
  a conflict-resolution mechanism to even act on for those operations.

This slice does both: it brings edit and timer-stop into the same local-first flow create already
had, and adds actual Last-Write-Wins (LWW) conflict resolution for the buffered writes. It is a new
ADR (not an addendum to 0009/0010) for the same reason 0010 was: it introduces genuinely new
decisions — an LWW comparison key, a server schema change (`Event.updatedAt`), an in-place
"replace the pending write" rule, a distinct conflict-notice surface, and offline edit-page seeding —
rather than merely confirming an existing pattern.

Five design questions (labelled JC-1…JC-5, as approved before implementation) needed deciding:

1. **JC-1** — what timestamp does "last write wins" actually compare?
2. **JC-2** — what does a _failed_ (non-conflict) buffered edit/stop show the user?
3. **JC-3** — how is a _lost_ conflict surfaced?
4. **JC-4** — what happens to a second offline edit of an event that already has a buffered edit?
5. **JC-5** — how does an edit page render offline, when its per-event fetch can't reach the server?

## Decision

### JC-1 — LWW compares a client-captured `clientTimestamp` against the server's `Event.updatedAt`

The event's business `occurredAt` field is freely user-editable (a backfilled entry can be dated
hours ago), so it is not a reliable "who wrote later" signal. Instead:

- A new `Event.updatedAt` (`DateTime @updatedAt`) column is added to the Prisma schema — the
  server-side last-write timestamp — and surfaced on all three event summaries
  (`FeedingEventSummary`/`SleepEventSummary`/`DiaperEventSummary`, plus their frontend mirrors).
- Every buffered edit/stop captures a `clientTimestamp` (`new Date().toISOString()`) at submit time
  and sends it as an optional DTO field.
- When a write reaches the server carrying a `clientTimestamp`, the service compares it against the
  row's current `updatedAt`: if the server row was written **more recently**
  (`existing.updatedAt.getTime() > clientTimestamp`), the buffered write **loses** and is rejected
  with a conflict; otherwise it applies. A request with no `clientTimestamp` (a normal online PATCH)
  keeps the pre-existing unconditional-apply behavior — LWW only activates when the field is present.

The comparison is a shared helper `assertNoLaterServerWrite(...)` (in
`apps/backend/src/event/event-conflict.exception.ts`), called before the DB write in all three
`update()` methods and both `stop()` methods, so the losing write is skipped entirely.

The conflict is a `409` `EventConflictException` whose body is `{ code: 'EVENT_CONFLICT',
currentEvent: <summary> }`. The `code` field is what distinguishes it from the controllers' existing
plain-string 409s (timer-already-running / already-stopped); the frontend's `isEventConflictError`
guard keys on it. The current winning summary is carried back so the client can reconcile without a
second round-trip.

#### Migration and the detail-only-update trap (verified, not assumed)

The migration (`add_event_updated_at`) backfills `updatedAt` from each pre-existing row's `createdAt`
(rather than the migration run time), so historical rows don't all appear "just modified." Prisma
emitted the SQLite table-rebuild pattern for the new NOT-NULL column; its auto-generated `INSERT` was
hand-edited to copy `createdAt` into `updatedAt` (the generated SQL would otherwise violate NOT NULL
on a non-empty table).

A real-SQLite integration test (`event-updated-at.integration.spec.ts`, not mocked Prisma) pins two
findings the plan asked to verify:

- the migration backfill behaves as above; and
- **Prisma 7 does NOT auto-apply `@updatedAt` on a nested detail-only `event.update()`** (empty
  top-level Event `data`, only `feedingDetail`/`diaperDetail` changing) — it emits no parent UPDATE,
  so `@updatedAt` never fires. This contradicted the plan's stated assumption. The fix: all three
  services pass an **explicit `updatedAt: new Date()`** in the top-level update `data`, forcing the
  bump on every edit regardless of which fields changed. Without this, a note/side/amount/diaperType-
  only edit would leave `updatedAt` stale and silently weaken LWW for exactly those edits.

### JC-2 — a failed (non-conflict) buffered edit/stop keeps the edited values visible with a badge

Mirroring ADR-0009's deliberate "don't roll back a failed create" stance: a buffered edit/stop that
fails for an ordinary (network/5xx) reason is flipped to `status: 'failed'` and **kept**, showing the
user's edited/stopped values — never reverting to the stale pre-edit values — with the existing
pending/failed `OfflineStatusBadge` overlaid. The sync-queue retries it later (ADR-0010's backoff).

For rendering, a buffered edit/stop is an **overlay**, not a new row:
`mergeServerAndPendingEvents` now replaces the matching server row's rendered summary (matched by
`targetEventId === serverRow.id`) and carries its `localStatus`, instead of unioning it as an extra
row. Create records keep the previous union-and-dedupe-by-id behavior unchanged. For the timer case,
`FeedingHome`/`SleepHome` additionally check for a pending `'stop'` record targeting the current
active timer and render a stopped/optimistic state instead of the ticking timer (the server still
reports the timer as running until the stop syncs).

### JC-3 — a lost conflict surfaces as a small, dismissible, app-root notice

Not a blocking modal and not a bespoke inline error on the edit page. A minimal notice queue
(`conflictNotices.ts`, backed by the React-Query cache exactly like `usePendingLocalEvents`, no extra
state library, no persistence beyond the session) records a notice; a `ConflictNoticeBanner` mounted
once near the app root (`main.tsx`, beside `SyncQueueProvider`) renders it. The same mechanism serves
both paths: a synchronous/online conflict (surfaced from the optimistic engine) and a conflict hit
later while the sync-queue drains a buffered write. In both, the losing buffered record is deleted
(it lost — never retried) and the per-domain query is invalidated so the server's winning values are
refetched and shown.

Consequently the edit pages **always navigate back to the list** after submit — on success, on an
ordinary buffered failure (list shows the failed overlay, JC-2), and on a conflict (banner shows,
JC-3) — rather than blocking on the edit page with an inline error. This is a deliberate divergence
from the create/backfill pages (which rethrow to show an inline form error), justified by JC-2/JC-3
explicitly wanting the edited values shown and conflicts surfaced globally, not an error that hides
them.

### JC-4 — a second offline edit/stop of the same event replaces the pending record in place

`updateEventOptimistically` looks up any existing pending record for the same `targetEventId`
(`findPendingUpdateForEvent`, a full-store scan like `listAllPendingEvents`) and reuses its `localId`,
so a second edit overwrites the first's buffered request body / `clientTimestamp` instead of queuing
two sequential requests for the same event. Only the latest intended state is ever resent.

### JC-5 — edit pages seed initial values from cache (+ pending overlay), falling back to a live fetch

Each edit page computes `initialData` for its per-event query from what's already available offline:
a matching pending local record's overlay first, then the cached list-query row, then (when
online/uncached) the live fetch. This lets the edit page render offline. A cold deep-link to an event
never seen locally, while fully offline, keeps today's error state — an accepted edge case, not a
bug. The page's guard was adjusted to only show the error state when there is genuinely no data, so a
transient background-refetch failure never blanks out an already-seeded form.

### Frontend engine shape

A new `updateEventOptimistically` engine (`apps/frontend/src/offline/updateEventOptimistically.ts`)
mirrors `createEventOptimistically`: durable IndexedDB write-before-network-call, thin per-domain
`update*EventOptimistic`/`stop*TimerOptimistic` wrappers, and the JC-2/JC-3/JC-4 handling above.
`PendingEventRecord` gains `operation?: 'update' | 'stop'` (undefined = create, so all legacy/create
call sites and stored records are unaffected — additive, no `idb` version bump, same rationale as
ADR-0010), `targetEventId?`, and `updateInput?` (parallel to `createInput`). The sync-queue
(`syncQueue.ts`) branches on `operation`: create is unchanged; `'update'`/`'stop'` resend via new
`UPDATE_FN_BY_EVENT_TYPE`/`STOP_FN_BY_EVENT_TYPE` maps, resolve an `EVENT_CONFLICT` via the notice
queue with no retry scheduled, and reuse the existing backoff for ordinary failures. A `'stop'`
record for `DIAPER` is unreachable by construction (no stop wrapper produces one) and handled
defensively (logged, left failed).

## Consequences

**Positive:**

- Edit and timer-stop are now first-class offline operations, closing the gap that create-only
  offline support left; they buffer, show optimistically, and resync exactly like creates.
- Last-Write-Wins is implemented against a reliable server-write timestamp, not the user-editable
  business time — so a genuinely newer write always wins, and a stale buffered write can't silently
  clobber it.
- LWW is opt-in per request (`clientTimestamp` present): normal online edits keep their existing
  unconditional behavior, so nothing regresses for the online path.
- The detail-only-update trap is verified and closed by a real-SQLite test, not left as an unproven
  assumption.

**Negative / tradeoffs:**

- Explicit `updatedAt: new Date()` on every update is a small redundancy for edits that _do_ change a
  top-level Event field (Prisma would bump it there anyway), accepted for uniform, provably-correct
  behavior across all edit shapes.
- The edit pages swallow ordinary submit failures to always navigate back (JC-3 rationale). A
  server-side-only validation error (e.g. a merged start/end re-check the client didn't catch) shows
  as a generic `failed` badge in the list rather than a specific inline message — a minor UX
  regression versus the online-only edit page, accepted as consistent with JC-2's "keep the edited
  values, don't block."
- LWW is per-event and last-write-wins by design (MVP scope, PRD 5.4): the losing edit is discarded,
  not merged field-by-field. This is the accepted MVP behavior, not field-level conflict resolution.
- ADR-0010's accepted at-least-once (not exactly-once) delivery tradeoff still applies to the new
  update/stop resends.
- **False-positive conflict on a redelivered own write (accepted).** As a direct consequence of that
  at-least-once delivery, a buffered write can succeed server-side while its HTTP response is lost
  (network drop after commit). On the next sync-queue drain the record is resent with its original,
  unchanged `clientTimestamp` — but the first (successful) write already bumped the row's `updatedAt`
  to server-processing-time, which is normally `>=` that original `clientTimestamp`. So the LWW gate
  (`assertNoLaterServerWrite`) can now fire on the resend and treat it as a lost conflict, surfacing
  the `ConflictNoticeBanner` — even though the value currently persisted on the server already _is_
  exactly this user's own change. No data is lost or overridden in this case; it is purely a
  misleading "your change was overridden" signal caused by resending one's own already-applied write.
  This is an accepted, narrow UX limitation of the at-least-once design (the same class of tradeoff as
  ADR-0010's), not something fixed in this slice — de-duplicating resends (e.g. a client-generated
  idempotency key per buffered write, so a redelivery is recognized as the same write rather than a
  newer competing one) is the natural future fix if it proves annoying in practice.

## Related

- [ADR-0009](0009-indexeddb-optimistic-create-engine.md) — the optimistic-create engine this slice's
  `updateEventOptimistically` mirrors, and the "keep a failed record visible" stance JC-2 extends.
- [ADR-0010](0010-offline-sync-queue-reconnect-retry.md) — the sync-queue this slice extends to
  branch on `operation`, and whose backoff/at-least-once tradeoffs the update/stop resends reuse.
- [ADR-0006](0006-event-base-table-with-per-type-detail-tables.md) — the base-`Event`/detail-table
  model whose nested-update behavior forced the explicit-`updatedAt` decision under JC-1.
- [Phase 4 roadmap](../roadmap/phase-4-offline-pwa.md) — the "Konfliktbehandlung nach
  Last-Write-Wins-Prinzip" item this slice closes.
- Backend: `apps/backend/prisma/schema.prisma` + `prisma/migrations/*_add_event_updated_at`,
  `apps/backend/src/event/event-conflict.exception.ts`, `event/dto/stop-event.dto.ts`, and the three
  services' `update()`/`stop()` (JC-1).
- Frontend: `apps/frontend/src/offline/updateEventOptimistically.ts`, `conflictNotices.ts`,
  `mergeServerAndPendingEvents.ts`, `syncQueue.ts`, `pendingEvents.db.ts`;
  `apps/frontend/src/components/ConflictNoticeBanner.tsx`; the three `*EventEdit.tsx` pages and
  `FeedingHome`/`SleepHome` (JC-2…JC-5).
