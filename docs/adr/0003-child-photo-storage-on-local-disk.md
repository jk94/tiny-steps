# ADR-0003: Child profiles, role-scoped edit/delete, and local-disk photo storage

## Status

Accepted

## Context

[Phase 1 roadmap](../roadmap/phase-1-auth-multiuser.md) requires child profiles ("Kind-Profile"):
create (name, birth date, optional photo), edit/delete, and multiple children per household
(siblings) — on top of the local auth ([ADR-0001](0001-jwt-httponly-cookie-session-handling.md))
and household roles/invites ([ADR-0002](0002-application-level-household-roles-and-invites.md))
already implemented in earlier Phase 1 sub-steps.

Three design questions needed deciding:

1. **Who may edit vs. delete a child profile?** The roadmap checklist says "bearbeiten/löschen (nur
   Owner)" ("edit/delete, Owner only"), but PRD section 3's Co-Parent row says "volle
   Lese-/Schreibrechte auf zugeordnete Kind-Profile" ("full read/write on assigned child profiles"),
   and this phase's own Definition of Done says "Co-Parent kann Kind-Profile lesen/bearbeiten aber
   keine Nutzer verwalten" ("Co-Parent can read/edit child profiles but not manage users") — an
   apparent conflict between the terse checklist wording and both the PRD and this phase's own DoD.
2. **Where and how are uploaded photos stored?** This is a self-hosted app with no object-storage
   dependency (PRD 5.6) and an existing `sqlite_data` Docker volume already used for the database —
   introducing a second storage dependency (e.g. S3-compatible object storage) for an MVP-scale,
   single-container deployment would be disproportionate.
3. **How does the app avoid ending up with inconsistent state (DB row referencing a missing file, or
   an orphaned file no row references) when a photo write and a DB write can each independently
   fail?**

## Decision

### Role scoping: create/delete are Owner-only, read/edit are any member

| Action | Owner | Co-Parent |
| --- | --- | --- |
| Create child | Yes | No (403) |
| List/read children | Yes | Yes |
| Update child (name/birthDate/photo) | Yes | Yes |
| Delete child | Yes | No (403) |

The roadmap checklist's "nur Owner" is treated as shorthand for the two structural
household-composition changes (creating/deleting a child profile alters what the household
_contains_), not for editing an existing profile's fields, which follows the PRD's Co-Parent row and
this phase's Definition of Done verbatim. `ChildController` enforces this with
`@RequireRole(HouseholdRole.OWNER)` present only on `create`/`remove`, absent on `list`/`getOne`/
`update`/`getPhoto` — see `apps/backend/src/child/child.controller.ts` and its e2e coverage in
`apps/backend/test/child.e2e-spec.ts` (`'Co-Parent cannot create or delete, but CAN update including
replacing a photo'`).

### Route nesting and guard reuse

Child routes are nested under `/households/:householdId/children`, reusing
`HouseholdMembershipGuard` (from ADR-0002) unmodified — it already reads `request.params.householdId`
generically. No new child-scoped guard class was written. Cross-household integrity (a child from
household A referenced via household B's URL) is enforced in `ChildService`, not the guard: every
lookup/update/delete query filters `where: { id: childId, householdId }`, so a mismatched child is
indistinguishable from a nonexistent one — `NotFoundException` (404, not 403), consistent with
`HouseholdMembershipGuard`'s existing non-member-gets-404 precedent from ADR-0002.

**Module wiring gotcha worth recording**: simply `imports: [HouseholdModule]` in `ChildModule`, with
`HouseholdModule` exporting `HouseholdMembershipGuard`, is **not** sufficient to make
`@UseGuards(HouseholdMembershipGuard)` resolve on `ChildController`'s routes. NestJS resolves a guard
referenced by class in `@UseGuards(...)` from the *consuming controller's own module* (a
metatype-keyed lookup scoped to that module), not transitively through an imported module's provider
graph the way constructor-injected services are. Discovered via the child e2e suite failing to boot
with `Nest can't resolve dependencies of the HouseholdMembershipGuard (?, Reflector)`. The fix:
`HouseholdModule` additionally exports `HouseholdAccessService` (previously private to that module),
and `ChildModule` re-declares `HouseholdMembershipGuard` as its own provider — constructed with the
now-exported `HouseholdAccessService` resolved from `HouseholdModule` via the normal imports/exports
mechanism, and Nest's built-in `Reflector`. This creates a second, harmless guard instance
(stateless) rather than reusing `HouseholdModule`'s own — an accepted minor inefficiency, not a
correctness issue. See `apps/backend/src/household/household.module.ts` and
`apps/backend/src/child/child.module.ts` for the in-code comments recording this.

### Photo storage: local disk, not object storage

Child photos live under `<UPLOADS_DIR>/children/`, reusing the same Docker volume
(`sqlite_data:/app/data`) already used for the SQLite database — a new subdirectory, not a new
volume, so no change to how existing self-hosted deployments' data is mounted.

- **`UPLOADS_DIR` resolution** (`apps/backend/src/config/uploads-dir.ts`) mirrors
  `resolveDatabaseUrl()`: an env var overriding a code-level default (`./data/uploads`), deliberately
  **not** exposed via `config.yml` — consistent with the precedent already established for
  `DATABASE_URL` (a filesystem path is deployment topology, not product configuration).
- **Filename scheme**: `${childId}-${randomUUID()}${ext}`, where `ext` is derived solely from the
  already-validated upload MIME type via a fixed map (`image/jpeg` → `.jpg`, etc.) — never from the
  client-supplied original filename or its extension. A new file is always written under a fresh
  unique name; existing files are never overwritten in place. The DB stores a path *relative to*
  `resolveUploadsDir()` (e.g. `children/<file>`), never an absolute host path.
- **Access control**: the uploads directory is never served via a static/public route (no
  `ServeStaticModule` entry for it) — the only way to read a photo is
  `GET /api/households/:householdId/children/:childId/photo`, behind the same
  `JwtAuthGuard`/`HouseholdMembershipGuard` chain as every other child route. The unguessable
  filename is defense-in-depth only, not the primary access control.
- **Upload validation, two layers**: Multer's own `limits.fileSize` (hard backstop, using
  `memoryStorage()` so the buffer never touches disk until `ChildService`/
  `ChildPhotoStorageService` decide to write it) and Nest's `ParseFilePipeBuilder` with a
  `FileTypeValidator` regex allowlist (`image/jpeg`/`image/png`/`image/webp`) — the actual
  product-facing rule. `FileTypeValidator` sniffs the file's real magic numbers via the `file-type`
  package rather than trusting the client-declared `Content-Type`, so a text file renamed to `.gif`
  with a spoofed `Content-Type: image/gif` is still rejected (`ParseFilePipeBuilder`'s
  `fileIsRequired: false` keeps the photo optional on both create and update).
- **`MulterExceptionFilter`** (`@Catch(MulterError, PayloadTooLargeException)`) maps Multer-level
  errors to a uniform `400`. It catches `PayloadTooLargeException` in addition to the raw
  `MulterError` because `@nestjs/platform-express`'s `FileInterceptor` already transforms a
  `LIMIT_FILE_SIZE` `MulterError` into a `PayloadTooLargeException` (HTTP 413) internally, before any
  `@Catch(MulterError)`-only filter would ever see it — without this, an oversized upload would
  return `413` instead of this app's otherwise-uniform `400` for upload validation failures. Applied
  per-route via `@UseFilters(...)` on `create`/`update` only, not globally.

### Ordered write/commit/cleanup sequences

The core correctness property: **the `Child.photoPath` DB column and the file on disk must never
both be wrong at once from the caller's point of view**, even if a write fails partway through. This
is achieved by always doing the disk write *before* the DB write, and any deletion of a
now-superseded file only *after* the DB commit that stops pointing at it:

- **Create with a photo**: write the file first (under a pre-generated `childId`, using
  `crypto.randomUUID()` rather than Prisma's default `cuid()` — needed because the filename must be
  derivable from the child's id, and the id must exist before the disk write happens for the ordering
  below to hold) → only then insert the `Child` row. If the file write fails, no DB row is created at
  all (a silently-dropped photo would be a worse surprise than a failed request). If the DB insert
  fails after a successful file write, the file is an orphan — logged, not swept (see Consequences).
- **Update replacing a photo**: write the new file under a fresh name → update the `Child` row →
  only then delete the old file. If the file write fails, abort before any DB write; the existing
  photo (if any) is untouched. If the DB update fails after a successful file write, the new file is
  an orphan (logged) but the old file/DB row are untouched, so the child's photo reference stays
  valid throughout. If the old-file delete fails (permissions, already gone), it's logged and
  swallowed — the DB already correctly points at the new photo, so this must not fail the request.
- **Delete**: delete the `Child` DB row first (the authoritative state change — once committed, `GET`
  on that id already 404s regardless of disk state) → only then best-effort delete the photo file.
- **Serving a photo**: read the whole file into memory (not `createReadStream`) and return via
  `StreamableFile`, deliberately avoiding the mid-stream-error problem of an async `ENOENT` arriving
  after headers are already sent. A set `photoPath` whose file is missing on disk is treated as a
  plain `404` (indistinguishable from "no photo set" to the caller) with a server-side `logger.warn`,
  since that drift is unexpected but not a fault worth a `500`.

### Response shape

`ChildSummary` (`{ id, householdId, name, birthDate, hasPhoto, createdAt }`) never includes
`photoPath` — an internal server-relative path — only a computed `hasPhoto` boolean.

### Testing the real `FileTypeValidator` under Jest

`apps/backend/package.json`'s `test:e2e` script was changed to
`NODE_OPTIONS=--experimental-vm-modules jest --config ./test/jest-e2e.json`. Without this flag, the
`file-type` package (an ESM-only dependency `FileTypeValidator` dynamically `import()`s at runtime)
fails to load under ts-jest with `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`, and `FileTypeValidator`
silently treats every upload as invalid (rejecting even correctly-typed photos with a `400`) rather
than throwing — `@nestjs/common`'s own `FileTypeValidator` logs a warning naming this exact fix. This
only affects the Jest test environment; the compiled app run via plain Node (`nest start`/
`node dist/main.js`, including in the Docker image) is unaffected, since dynamic `import()` works
natively there.

## Consequences

**Positive:**

- No new infrastructure dependency (object storage, CDN) for an MVP-scale, single-container,
  self-hosted app — photos live inside the same volume operators already provision for the database.
- The ordered write/commit/cleanup sequences mean a partial failure at any single step never leaves
  the *visible* system state (what the API reports) inconsistent — worst case is a harmless orphaned
  file on disk, never a DB row pointing at nothing or a lost photo reference.
- Guard/role reuse from ADR-0001/ADR-0002 (`JwtAuthGuard`, `CsrfGuard`, `HouseholdMembershipGuard`,
  `@RequireRole`) meant no new authorization primitive was needed for child profiles, only a new
  application of existing ones plus the `HouseholdAccessService` export gotcha documented above.

**Negative / tradeoffs:**

- **Orphan sweeping is explicitly out of scope.** A file write that succeeds followed by a DB write
  that fails leaves an orphaned file on disk with nothing pointing at it; nothing currently reclaims
  that space. Accepted for this sub-step — logged via `logger.warn` for operator visibility, with a
  known, findable trail (`ChildService`'s create/update catch blocks) if this needs to be revisited.
- Photos are capped at 2 MB and JPEG/PNG/WebP only, hard-coded (`MAX_PHOTO_BYTES`,
  `ALLOWED_PHOTO_MIME_TYPES`), not configurable — acceptable for MVP; revisit if operators need
  larger/different formats.
- Local-disk storage doesn't horizontally scale the way object storage would — a deliberate,
  scale-appropriate tradeoff for a self-hosted, likely-single-instance deployment; revisit if a
  future multi-instance/HA deployment mode is ever pursued.
- Storing every child's own `id` as a `crypto.randomUUID()` rather than Prisma's default `cuid()`
  (only when created, to support the write-before-insert ordering) means `Child.id` values look
  structurally different from `User`/`Household`/`Membership` ids elsewhere in the schema. Both are
  opaque strings from the application's point of view, so this has no functional impact, but is
  worth knowing if a future contributor notices the format difference.

## Related

- [Phase 1 roadmap](../roadmap/phase-1-auth-multiuser.md) — "Kind-Profile" is the sub-step this
  decision was made for.
- [ADR-0001](0001-jwt-httponly-cookie-session-handling.md) — the auth/session infrastructure reused
  here (`JwtAuthGuard`, `CsrfGuard`, `@CurrentUser()`).
- [ADR-0002](0002-application-level-household-roles-and-invites.md) — the household role/membership
  infrastructure reused here (`HouseholdMembershipGuard`, `@RequireRole`, `HouseholdAccessService`).
- `apps/backend/src/child/` — implementation (`child.controller.ts`, `child.service.ts`,
  `child-photo-storage.service.ts`, `child-photo.constants.ts`, `child.module.ts`,
  `filters/multer-exception.filter.ts`, `validators/is-not-future-date.validator.ts`,
  `dto/create-child.dto.ts`, `dto/update-child.dto.ts`).
- `apps/backend/src/config/uploads-dir.ts` — `UPLOADS_DIR` resolution.
- `apps/backend/prisma/schema.prisma` — `Child.photoPath`/`Child.photoMimeType` columns.
- `docker-compose.yml` — `UPLOADS_DIR` env var, updated volume comment.
