# ADR-0006: `Event` base table with per-type detail tables, starting with `FeedingDetail`

## Status

Accepted

## Context

[Phase 2 roadmap](../roadmap/phase-2-tracking-kernfunktionen.md) requires differentiating the
placeholder `Event` model (`childId`, `userId`, `type: String`, `occurredAt` — added in Phase 0,
never populated with real data) into concrete, trackable event types, per [PRD section
4.1](../../Baby%20Tracking%20App%20PRD.md#41-mvp-version-10) and [PRD section
5.2](../../Baby%20Tracking%20App%20PRD.md#52-multiuser-datenmodell-grobentwurf)'s `Event`
(Feeding/Sleep/Diaper/…) placeholder. This sub-step implements the first of the three MVP event
types, **Feeding** (Stillen/Fläschchen/Beikost — breastfeeding with a left/right timer, bottle with
an amount in ml, solids with a free-text note); Sleep and Diaper are explicitly deferred to later
sub-steps of the same phase, but the schema shape decided here needs to accommodate them without a
later rework.

Two design questions needed deciding:

1. **How does `Event` grow to carry type-specific data for three structurally different event
   types, without those types stepping on each other?** Feeding needs `feedingType`
   (breast/bottle/solid), a conditional `side` (breast only), a conditional `amountMl` (bottle
   only). Sleep (next) will need timer start/stop, no other fields. Diaper (next) will need a
   contents type (pee/stool/both) and a consistency note. These are non-overlapping,
   mutually-exclusive-per-row shapes, not a common superset of optional fields.
2. **Where do timer semantics (start/stop) live?** Both Feeding (breastfeeding) and the upcoming
   Sleep event are timer-based (a caregiver starts a timer, it runs, they stop it later); Diaper is
   a point-in-time event. `occurredAt` (already required/non-null on every `Event`) alone can't
   represent "started running, not yet stopped" for a timer-based event still in progress.

## Decision

### Shared base `Event` table + a 1:1 detail table per event type

`Event` stays the single table every event of any type is a row in, and gains two new nullable
columns at the base level: `startedAt`/`endedAt`. `FeedingDetail` is added as a 1:1 child table
(`eventId` is both its primary key and its foreign key to `Event.id`, `onDelete: Cascade`) holding
only Feeding-specific columns: `feedingType` (`BREAST`/`BOTTLE`/`SOLID`), `side` (`LEFT`/`RIGHT`,
only meaningful for `BREAST`), `amountMl` (only meaningful for `BOTTLE`), `note` (optional,
meaningful for any feeding type). `Event.feedingDetail` is optional/nullable at the Prisma level, so
future event types don't get a spurious `FeedingDetail` relation forced on them.

`SleepDetail`/`DiaperDetail` are expected to follow the exact same pattern (a new 1:1 table,
`Event` itself unchanged) when those sub-steps are implemented — this ADR's rationale is meant to
be reused there, not re-litigated.

### Timer semantics (`startedAt`/`endedAt`) are hoisted onto the base `Event`, not `FeedingDetail`

Even though only Feeding uses them today, `startedAt`/`endedAt` live on `Event` because Sleep will
need the identical semantics next: `startedAt` set when a timer starts, `endedAt` null while
running and set on stop. Putting them on `Event` now means the future `SleepDetail` sub-step adds
no columns to `Event` either — only a new table — and a later mixed-type "is anything currently
running" query (e.g. for a dashboard) can filter `Event.endedAt IS NULL` without needing to know or
join per-type detail tables to find timer state.

`occurredAt` stays required/non-null on **every** event regardless of type, and is set equal to
`startedAt` for timer-based events at creation time (see `FeedingService.create()`), deliberately
duplicating that value rather than leaving `occurredAt` nullable. This keeps a single `ORDER BY
occurredAt` valid across every event type for a future mixed-type activity timeline (Phase 3)
without needing to `COALESCE` across `occurredAt`/`startedAt` per row, or special-case timer-based
types when sorting.

### `FeedingDetail`'s fields stay plain `String`/nullable columns, not Prisma `enum`s

`FeedingDetail.feedingType` and `FeedingDetail.side` (and, for consistency, `Event.type` itself,
already established as a `String` before this sub-step) are plain `String` columns, each backed by
a TypeScript enum (`EventType`, `FeedingType`, `FeedingSide`) plus a `toXType()`-style cast function
that throws on any unrecognized value — mirroring `HouseholdRole`/`toHouseholdRole()`. This is the
same, already-established reason as [ADR-0002](0002-application-level-household-roles-and-invites.md):
Prisma's `enum` type isn't supported on the SQLite connector this project uses for the MVP, and this
project's schema is meant to stay portable to PostgreSQL/MySQL later. Every read of one of these
columns out of Prisma goes through its cast function rather than comparing raw strings.

Fields that are only meaningful for one `feedingType` (`side` for `BREAST`, `amountMl` for
`BOTTLE`) are validated conditionally at the DTO layer (`class-validator`'s `@ValidateIf`) on
create, and are simply not written for a `feedingType` they don't apply to — there is no DB-level
constraint enforcing this (SQLite has no `CHECK` constraint expressive enough here without extra
tooling, and it wasn't judged worth the complexity for a trusted-household-member write path; see
`CreateFeedingEventDto`'s doc comment).

### Alternative considered and rejected: single wide `Event` table with nullable per-type columns

The alternative was adding every type-specific field (`feedingType`, `side`, `amountMl`,
sleep-specific columns, diaper-specific columns, …) directly to `Event`, all nullable. This was
rejected:

- **Sparse columns and cross-type naming collisions.** A wide `Event` row for a `DIAPER` event
  would carry `feedingType`/`side`/`amountMl` columns that are always null for it, and vice versa.
  Worse, a generic-sounding column like `note` would be ambiguous — is it a Feeding note (Beikost)
  or a Diaper consistency note? Separate detail tables give each type's `note` an unambiguous home
  and its own column, without needing type-prefixed names (`feedingNote`, `diaperNote`, …) to
  disambiguate on a shared table.
- **No schema-level type safety against a nonsensical row.** Nothing at the schema level would stop
  a `FEEDING`-typed row from having `amountMl` populated on a `BREAST` sub-type, or a `DIAPER` row
  from having `feedingType` set at all. A 1:1 detail table scoped to one event type at least makes
  it structurally impossible for a `SleepDetail` row to exist for a `FEEDING` `Event`, even though
  intra-table constraints (e.g. `side` only for `BREAST`) still rely on the application layer.
- **`Event` would need a schema change for every future event type.** With detail tables, adding
  Sleep or Diaper is a pure additive `CREATE TABLE`, exactly like `Invite` was in ADR-0002 — no
  `ALTER TABLE` on `Event`, no migration risk to already-written Feeding rows. A wide table would
  instead grow its column count (and its nullable-column sparsity) with every new event type
  indefinitely.

`Child.photoPath`/`Child.photoMimeType` (added in [ADR-0003](0003-child-photo-storage-on-local-disk.md))
was considered as a precedent for inline nullable columns instead, but judged not to generalize
here: that's one optional feature on one entity (a child either has a photo or doesn't), not a
3-way mutually exclusive discriminated union where each branch has its own distinct field set.

### Reading a `FeedingDetail`-less `FEEDING` event is an unreachable-in-practice defensive throw, not a null-check

Because `Event` and `FeedingDetail` are always created together in one `prisma.event.create({ data:
{ ..., feedingDetail: { create: { ... } } } })` call, and `FeedingDetail.eventId`'s
`onDelete: Cascade` means a `FeedingDetail` can never outlive its `Event`, every `FEEDING`-typed
`Event` is expected to always have a `feedingDetail`. `FeedingService`'s `toSummary()` mapper throws
a plain `Error` (not a `NotFoundException` — this is an internal invariant violation, not a
caller-facing 404) if it ever sees a `FEEDING` event without one, mirroring the defensive-boundary
pattern already used for `toAllowedMimeType()` in `child.service.ts`.

## Consequences

**Positive:**

- Adding Sleep and Diaper tracking (next sub-steps of this phase) requires no change to `Event`
  itself — only new `SleepDetail`/`DiaperDetail` tables, following the pattern established here.
  Each type's shape, validation, and NestJS module stay isolated from the others.
- `Event` alone (no join) already carries everything a mixed-type activity timeline (Phase 3) needs
  to render a skeleton view — `id`, `type`, `occurredAt`, `startedAt`, `endedAt`, `userId`,
  `childId` — so a timeline query only needs to join out to a detail table when rendering or
  editing one specific entry, not for every row in a list.
- The hoisted `startedAt`/`endedAt` timer columns will be reused as-is by Sleep without another
  migration, and a future "what's currently running for this child" query can filter on `Event`
  alone.

**Negative / tradeoffs:**

- Reading a full Feeding event's data always costs a join (`Event` + `FeedingDetail`), never a
  single-table read — accepted, since this is a per-household-member-scale table (not a
  high-throughput analytics workload) and Prisma's `include` makes the join a single round trip.
- Intra-`FeedingDetail` field relevance (`side` only for `BREAST`, `amountMl` only for `BOTTLE`) has
  zero DB-level enforcement, same tradeoff already accepted for `Membership.role`/`Invite.role` in
  ADR-0002 — a bug or manual DB edit could write an `amountMl` on a `BREAST` row, and nothing but
  applicaton-layer discipline (DTO validation on write, ignoring irrelevant fields on read) prevents
  or hides it. Judged acceptable for the same reason as ADR-0002: all writes go through
  `FeedingService`, which never writes a field irrelevant to the given `feedingType`.
- `occurredAt` duplicating `startedAt` for timer-based events (rather than being computed from it)
  means the two can in principle drift if a future code path updates one without the other —
  mitigated by `FeedingService.update()` only ever setting `occurredAt` directly from the request
  DTO, never deriving it from `startedAt`, so no code path currently performs a partial update that
  could cause drift; worth re-checking if `SleepDetail` update logic is written differently.

## Addendum: Sleep needed no detail table

When the Sleep sub-step (Phase 2) was implemented, it turned out **not** to need a `SleepDetail`
table, contradicting this ADR's original expectation above. Sleep's actual scope (start/stop timer,
manual backfill with start/end time, CRUD) has no field beyond what the base `Event` table already
carries (`type = 'SLEEP'`, `occurredAt`, `startedAt`/`endedAt`, `childId`, `userId`) — unlike
Feeding, there is no discriminant sub-type, no conditional field, and no note requirement in scope.
Sleep is therefore a pure base-`Event` row with no detail table and no relation to one. This does not
invalidate this ADR's core decision (a base `Event` + per-type detail table *where a type has
type-specific data*) — it refines it: **a detail table is added only when a type actually has fields
beyond what `Event` already carries**, not automatically for every new event type. `DiaperDetail`
(still pending) is expected to need one after all, since Diaper does have type-specific fields
(Pipi/Stuhlgang/beides + an optional consistency note) per PRD 4.1 — so it should still follow the
original `FeedingDetail` pattern when implemented; only the blanket "every type gets a detail table"
framing was wrong, not the pattern itself for types that need it. See
`apps/backend/src/sleep/sleep.service.ts` for the resulting implementation (`Event`-only
reads/writes, no join).

## Addendum: Diaper confirms the detail-table pattern

The Diaper sub-step (Phase 2, the third and final MVP event type) was implemented per this ADR's
original pattern and the Sleep addendum's refined framing: `DiaperDetail` was added as a 1:1 detail
table because Diaper has real per-instance fields (`diaperType`: `PEE`/`STOOL`/`BOTH`, plus an
optional consistency `note`) beyond what the base `Event` table already carries — unlike Sleep,
which needed no detail table at all (see the Sleep addendum above). This confirms the refined rule
holds for a third event type, not just the two it was originally stated for.

One genuinely new deviation worth recording: unlike `FeedingDetail`'s conditionally-relevant fields
(`side`/`amountMl`, each gated by `feedingType` — only meaningful for one sub-type), `DiaperDetail.note`
is relevant unconditionally for every `diaperType`. There is no `diaperType` this field is irrelevant
for, so there is no risk of a field being orphaned by a type change. Because of that,
`DiaperDetail.diaperType` was deliberately kept **editable via `PATCH`** (`UpdateDiaperEventDto`),
unlike `FeedingDetail.feedingType`, which `UpdateFeedingEventDto` makes immutable specifically to
avoid the ambiguity of what happens to `side`/`amountMl` when the type changes mid-edit. This is a
small, deliberate deviation from the "type is immutable after creation" pattern Feeding established —
recorded here since it contradicts that pattern for a reason specific to Diaper's field shape
(no type-gated field means no orphaning risk), not an oversight.

See `apps/backend/src/diaper/diaper.service.ts` for the resulting implementation (`Event` +
`DiaperDetail` join, same shape as `FeedingDetail`, no timer semantics used — `startedAt`/`endedAt`
stay always null for `DIAPER` events, since Diaper is a pure point event like Feeding's
`BOTTLE`/`SOLID` sub-types, never timer-based like Feeding's `BREAST` sub-type or Sleep).

## Addendum: `GrowthMeasurement` — the first child-domain table beside `Event`

Added in roadmap Phase 7.1 ("Wachstumstracking"), the first sub-phase after the MVP event types.
Growth measurements (weight, recumbent length / standing height, head circumference) are stored in
their own `GrowthMeasurement` table, **not** as a fourth `Event` type with a detail table. That is a
deliberate departure from the pattern this ADR established, so the reasoning is recorded here rather
than only in code comments.

### Why not an `Event` type

Every argument that made Feeding/Sleep/Diaper fit the shared `Event` base table fails for a growth
measurement:

- **No timer duality.** `Event.startedAt`/`endedAt` exist for timer-based types. A measurement is
  neither a timed interval nor a point-in-the-day activity — modelling it as an `Event` would leave
  both columns permanently null for a whole type, which is exactly the "always-null column" smell
  this ADR set out to avoid.
- **Different time semantics.** `Event.occurredAt` is "when did this happen today", the sort key of
  the mixed daily timeline. A measurement carries a *date* (`measuredAt`), typically backfilled from
  a pediatric check-up days later. Reusing `occurredAt` would give the column two different
  meanings.
- **Several optional values per row.** A measurement carries up to three independent values, each
  individually optional, with an "at least one" rule across them (W-1/W-2). The detail tables all
  model exactly one kind of thing.
- **Derived, sex-specific classification.** The point of the feature is the WHO percentile, which
  depends on the child's sex and age — a derivation no other event type has, and one that has no
  place in a shared base row.
- **Not part of the activity timeline.** `EventService.listDaily` merges every `Event` for a day.
  A measurement must not appear there, so every timeline/stats query would have needed a
  `type != 'GROWTH'` exclusion — polluting the queries that the base table exists to simplify.
- **Naming.** `growthDetail.weightGrams` hanging off an `Event` row whose `type` is `GROWTH` reads as
  an activity that was logged, which is not what a measurement is.

### Shape of the decision

```prisma
model GrowthMeasurement {
  id                           String   @id @default(cuid())
  childId                      String
  userId                       String
  measuredAt                   DateTime
  weightGrams                  Int?
  lengthMillimeters            Int?
  headCircumferenceMillimeters Int?
  lengthMeasurementPosition    String?
  note                         String?
  createdAt                    DateTime @default(now())
  updatedAt                    DateTime @updatedAt

  child Child @relation(fields: [childId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id])

  @@index([childId, measuredAt])
}
```

- **FKs to both `Child` and `User`**, mirroring `Event`: who a measurement is about, and who recorded
  it (W-7).
- **`onDelete: Cascade` on the child relation.** A measurement is meaningless without its child, and
  deleting a child profile must not be blocked by an FK constraint — the same reasoning as the
  `Event` detail tables. The `user` relation deliberately does **not** cascade: deleting a household
  member must not silently erase measurements they recorded for a shared child.
- **`@@index([childId, measuredAt])`.** The only access pattern is "this child's measurements in
  chronological order, optionally windowed" — one index covers the list, the chart and the export.
- **Integer base units, no floats.** Grams and millimetres (W-3); the familiar kg/cm input is a
  frontend concern. A float column would let a stored value drift from what was entered.
- **`updatedAt` is traceability only.** Unlike `Event.updatedAt`, it is *not* a Last-Write-Wins
  tiebreak: growth tracking is an online-only feature with no offline buffering (W-16), so
  [ADR-0011](0011-offline-edit-stop-and-last-write-wins.md) does not apply here and the update DTO
  deliberately has no `clientTimestamp`. Note that Prisma's `@updatedAt` *does* work normally for
  this model, because the service issues a direct `growthMeasurement.update()` rather than the
  nested detail-only `event.update()` that ADR-0011 had to work around.
- **No realtime broadcast.** `GrowthModule` deliberately does not import `RealtimeModule`
  ([ADR-0007](0007-websocket-realtime-sync.md)): a value that changes a handful of times a year does
  not need a push, and adding one would imply an offline/optimistic surface the feature explicitly
  does not have.

### `Child.sex`

`Child` gains one nullable column, `sex` (`'FEMALE' | 'MALE'`, null = "not specified"):

- **Privacy-minimal.** It is the smallest field that makes the WHO reference selection possible, and
  it drives *nothing else* in the app — no display, no defaults, no other branch.
- **"Not specified" is a first-class state, not missing data.** Without it the app shows values and
  trends but deliberately no percentiles, with an explanatory hint and a link to the child profile
  (W-10). A guessed default would silently fabricate a clinical-looking classification, which is the
  one outcome the requirement rules out.
- **Plain `String`, read through `toChildSex()`** — the same application-level enum pattern as
  `Membership.role`/`Event.type`, for the same SQLite-connector reason
  ([ADR-0002](0002-application-level-household-roles-and-invites.md)).
- The same pattern covers `GrowthMeasurement.lengthMeasurementPosition`
  (`toLengthMeasurementPosition()`), where `null` likewise means something specific — "derive the
  WHO reference from the age at measurement time" (W-17) — rather than an absent value.

The migration is purely additive: one nullable column on `Child` plus the new table, no data
migration.

## Related

- [Phase 2 roadmap](../roadmap/phase-2-tracking-kernfunktionen.md) — "Datenmodell" and "Backend:
  Feeding" are the sub-steps this decision was made for.
- [ADR-0002](0002-application-level-household-roles-and-invites.md) — establishes the
  no-Prisma-`enum`-on-SQLite pattern (`toHouseholdRole()`) that `EventType`/`FeedingType`/
  `FeedingSide` reuse here.
- [ADR-0003](0003-child-photo-storage-on-local-disk.md) — the inline-nullable-column precedent
  (`Child.photoPath`/`photoMimeType`) considered and distinguished from this decision.
- `apps/backend/src/feeding/` — implementation (`feeding.service.ts`, `feeding.controller.ts`,
  `feeding.module.ts`, `feeding-type.enum.ts`, `feeding-side.enum.ts`, `dto/create-feeding-event.dto.ts`,
  `dto/update-feeding-event.dto.ts`, `validators/is-end-not-before-start.validator.ts`).
- `apps/backend/src/sleep/` — implementation of the Sleep sub-step (see Addendum above);
  deliberately has no `sleep.detail`/`SleepDetail` file, unlike `feeding/`.
- `apps/backend/src/diaper/` — implementation of the Diaper sub-step (see Addendum above);
  `diaper.service.ts`, `diaper.controller.ts`, `diaper.module.ts`, `diaper-type.enum.ts`,
  `dto/create-diaper-event.dto.ts`, `dto/update-diaper-event.dto.ts`.
- `apps/backend/src/event/event-type.enum.ts` — the shared `EventType` enum/cast function.
- `apps/backend/src/growth/` — implementation of the `GrowthMeasurement` addendum above
  (`growth.service.ts`, `growth.controller.ts`, `growth.module.ts`,
  `length-measurement-position.enum.ts`, `percentiles/`, `reference-data/`); deliberately has no
  detail table and no `RealtimeService` dependency.
- `apps/backend/src/child/child-sex.enum.ts` — the optional `Child.sex` cast function.
- [ADR-0014](0014-charting-library-visx.md) — the chart that renders the growth trend the
  `GrowthMeasurement` table backs.
- `apps/backend/prisma/schema.prisma` — `Event.startedAt`/`endedAt`, `FeedingDetail`/`DiaperDetail`
  and `GrowthMeasurement` models.
