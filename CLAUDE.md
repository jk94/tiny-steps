# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Implemented: **Phases 0–6** (scaffolding, auth/multi-user incl. OIDC, tracking core, realtime sync + overview, offline/PWA, export/native wrapper/push, design system M1–M4), **Phases 7.1–7.5** — 7.4 deliberately in *reduced* scope (no external HTML renderer, no per-domain CSV endpoints) — and **7.7** (development calendar, a request-driven addition outside the PRD).

**Open: Phase 7.6** (dedicated user-settings area + server-side persisted language choice; i18n infrastructure itself already exists — [ADR-0005](docs/adr/0005-i18n-infrastructure-brought-forward.md) — with a header language switch and `localStorage` persistence). Phase 8 is still only a brainstorm (`docs/roadmap/phase-8/brainstorm.md`, Alexa skill).

Everything else outstanding is a **manual real-device/real-viewer check** or a documentation follow-up, tracked in [`docs/known-issues.md`](docs/known-issues.md): PWA install, Capacitor Android build + cookie/origin auth smoke test, real push delivery, growth-chart touch scrub, PDF report in a real viewer, mobile CLS/load-time, the German-only push texts, the development calendar's link check and medical review, and the Phase-7.5 doc follow-ups (ADR-0002 addendum, ADR-0003 correction, PRD section-3 wording).

The long-form per-phase notes (what was built, why, and which alternatives were rejected) live in [`docs/implementation-notes.md`](docs/implementation-notes.md). **Read the relevant entry before changing a phase's code** — much of what looks like an oversight there is a recorded decision.

| Phase | Scope | Key references |
| --- | --- | --- |
| 6 | Design tokens + 12 UI primitives in `apps/frontend/src/components/ui/` (Radix UI, Toast via Sonner), Tailwind v4 **without Preflight**; all screens migrated (M2/M3) plus an a11y/perf audit (M4) | [ADR-0013](docs/adr/0013-design-system-styling-approach.md), `docs/design-system/` |
| 7.1 | Growth tracking — `GrowthMeasurement` table, vendored WHO LMS reference data (CC BY-NC-SA 3.0 IGO), percentiles computed per read and **never persisted**, visx chart in a lazy chunk | [ADR-0014](docs/adr/0014-charting-library-visx.md), [ADR-0006](docs/adr/0006-event-base-table-with-per-type-detail-tables.md) addendum |
| 7.2 | Milestones — `Milestone` + `MilestonePhoto`, 20-entry template catalog **in code** (`milestone-catalog.ts`, mirrored frontend-side), `title` frozen at creation; shared photo infra in `apps/backend/src/common/photo/` | `docs/roadmap/phase-7/` |
| 7.3 | Medications & vaccinations — one `HealthRecord` table with a `kind` discriminator, reminders reusing the Phase 5 scheduler (daily cron), push deep-linking | `docs/roadmap/phase-7/` |
| 7.4 | PDF report (`GET .../export/report.pdf`) beside the untouched raw export — renderer-neutral `ReportDocument` IR rendered by `@react-pdf/renderer`; growth chart shared via `packages/growth-chart-static/` | [ADR-0015](docs/adr/0015-pdf-report-generation.md) |
| 7.5 | Roles `CAREGIVER`/`OBSERVER` beside `OWNER`/`CO_PARENT`; permission matrix + fail-closed `@RequireRole` on every writing route; frontend *hides* disallowed actions | `docs/roadmap/phase-7/phase-7-5-erweiterte-rollen.md` |
| 7.7 | Development calendar — frontend-only, 52 weeks + months 13–36 per locale in lazy-loaded `development/content/{de,en}.ts` (deliberately **not** in the i18n JSON), one source registry, `ChildHome` card + detail screen | `docs/roadmap/phase-7/phase-7-7-entwicklungskalender.md` |

## Cross-cutting rules that later work keeps having to respect

- **Post-MVP child domains (growth, milestones, health records) are modelled *beside* `Event`, not as event types, and are online-only** — no realtime ([ADR-0007](docs/adr/0007-websocket-realtime-sync.md)), no offline engine ([ADR-0009](docs/adr/0009-indexeddb-optimistic-create-engine.md)–[ADR-0011](docs/adr/0011-offline-edit-stop-and-last-write-wins.md)). Saving fails visibly offline; success is never faked.
- **Permissions live in exactly two mirrored places**: `apps/backend/src/household/household-permissions.ts` and `apps/frontend/src/lib/householdPermissions.ts` (+ `useHouseholdRole`). Never re-derive the matrix per component. Every writing route under `/households/:householdId` needs `@RequireRole` — an unannotated one 403s at runtime and fails a scan test. Ownership-dependent rights go through `assertMayEditEntry` / `canEditEntry`. Two deliberate role-only exceptions (no ownership check) exist for shift handover: stopping anyone's running timer, and marking anyone's planned health record as done.
- **Export columns are append-only.** Every domain adds its columns strictly at the end of the flat `RawExportRow`/`CSV_COLUMNS` with a `recordKind` discriminator, so positional consumers keep working. The per-domain CSV endpoints from the phase-7 plan were deliberately *not* built; the per-domain presentation is the PDF report.
- **Never hand-edit a `*.generated.*` file.** Design tokens flow `design-system/tokens/*.json` → `bun run design-tokens:build` → four targets (frontend CSS, `docs/design-system/tokens.md`, `eventTypeTokens.generated.ts`, and the backend report tokens). Rerun it after any token edit; see `docs/design-system/reconciliation-process.md`.
- Calendar-day fields (`birthDate`, `measuredAt`, `achievedAt`, `dueAt`) are bare `YYYY-MM-DD` at UTC midnight and use `@IsDateOnly()`; comparisons tolerate a max UTC offset. Timestamps (`occurredAt`, `administeredAt`) are real instants.
- **Storybook is scoped to `components/ui/**` only** — rebuild it only when a primitive actually changes.
- **Jest cannot load `@react-pdf/renderer` natively** (ESM-only chain, `import.meta.url` in `yoga-layout`) — both Jest configs map it to `apps/backend/test-support/react-pdf-renderer.cjs`. Don't "clean up" that shim.

## Architecture

- **Self-hosted only** — no SaaS/cloud offering. Deployment via Docker/Docker Compose. Configuration (incl. OIDC providers and DB provider) via a YAML config file, not an admin UI. The one accepted exception is FCM/APNs as an unavoidable push relay ([ADR-0012](docs/adr/0012-capacitor-native-wrapper.md)).
- **Backend: NestJS** (deliberately over Next.js — PRD 5.3): native long-lived Node process for WebSockets, and a structured Guard/Passport-strategy model for running local auth and OIDC side by side. **Frontend: React + Vite** SPA, mobile-first, no SSR/SEO need.
- **Auth**: local email/password (Argon2) *and* OIDC (Authorization Code Flow + PKCE) coexist; users pick a method at login, providers come from config, not code. Sessions are JWT access + refresh tokens in httpOnly `SameSite=Lax` cookies with DB-backed refresh-token rotation and reuse detection — [ADR-0001](docs/adr/0001-jwt-httponly-cookie-session-handling.md); OIDC reuses that same token/cookie infrastructure — [ADR-0004](docs/adr/0004-oidc-authentication.md).
- **Data model** (PRD 5.2): `User —< Membership >— Household —< Child —< Event`. Every `Event` references both the `Child` and the `User` who logged it; authorization is checked via the user's `Membership` role. `Event` is a shared base table with a 1:1 detail table *only* where a type has extra fields (`FeedingDetail`, `DiaperDetail`; Sleep has none) — [ADR-0006](docs/adr/0006-event-base-table-with-per-type-detail-tables.md).
- **Realtime**: Socket.IO gateway on the same HTTP server, per-route `household:<id>` rooms, thin broadcast payloads + React Query refetch (no server-side replay log) — [ADR-0007](docs/adr/0007-websocket-realtime-sync.md).
- **Offline-first** (MVP event types only): IndexedDB-buffered optimistic create/edit/timer-stop written *before* the network call, a reconnect-triggered sync queue with capped backoff, and Last-Write-Wins against a server-side `Event.updatedAt` — [ADR-0008](docs/adr/0008-pwa-basics-via-vite-plugin-pwa.md)–[ADR-0011](docs/adr/0011-offline-edit-stop-and-last-write-wins.md).
- **Database**: Prisma ORM, SQLite for MVP, schema kept portable to PostgreSQL/MySQL via config-driven provider selection. Enum-like columns are plain `String` + an interpreter function (SQLite constraint, [ADR-0002](docs/adr/0002-application-level-household-roles-and-invites.md)). Migrations via Prisma Migrate.
- **Native wrapper: Capacitor** (`apps/frontend/android|ios` committed), chosen for its official push plugin — [ADR-0012](docs/adr/0012-capacitor-native-wrapper.md).
- **Package manager: Bun** (workspaces). **Runtime: Node.js**, deliberately not Bun — Prisma query-engine bindings and native modules (Argon2) weren't considered stable enough under Bun (PRD 5.6). Bun is build/install tooling only.

## Roles & permissions

Household membership carries a role (PRD section 3; the matrix itself lives in the two mirrored modules named above):

- **OWNER** — full read/write, invites, member/role management, child create/delete
- **CO_PARENT** — full read/write on all children of the household
- **CAREGIVER** — may log events and edit *their own* entries; never deletes, never manages
- **OBSERVER** — read-only plus their own notification settings

A user can belong to multiple households (e.g. separated parents), and a household can have multiple children.

## Commands

Run from the repo root unless noted.

- `bun install` — install all workspace dependencies (also builds `packages/growth-chart-static` via `prepare`)
- `bun run lint` / `bun run format:check` — ESLint/Prettier across both apps
- `bun run --cwd apps/backend start:dev` — NestJS backend with hot reload (`GET /health`, API under `/api`)
- `bun run --cwd apps/frontend dev` — Vite dev server; **needs the backend running on `localhost:3000`**, since `vite.config.ts` proxies `/api` there for cookie-domain reasons (see the comment in that file)
- `bun run --cwd apps/backend test` — backend unit tests (Jest); `test:e2e` runs the real-SQLite suites
- `bun run --cwd apps/frontend test` — frontend unit tests (Vitest); also covers `packages/*` and `design-system/scripts/` (see `test.include` in `apps/frontend/vitest.config.ts`)
- `bun run --cwd apps/backend prisma:migrate:dev` — apply Prisma migrations against local SQLite
- `bun run design-tokens:build` — regenerate all design-system artifacts after editing any token JSON
- `bun run --cwd apps/frontend storybook` / `build-storybook` — design-system component catalog
- `cp config.example.yml config.yml && docker compose up --build` — run the whole app as a single container (backend serves the built frontend)

Occasional/build-time only:

- `bun run --cwd packages/growth-chart-static build` — compile the shared growth chart to its dual ESM/CJS output (the backend consumes the build, the frontend the source via a Vite alias)
- `bun apps/backend/src/growth/reference-data/scripts/convert-who-tables.ts` — regenerate the vendored WHO LMS data modules from `reference-data/source/*.txt`; deterministic codegen, never run at runtime (provenance/licence in that directory's `README.md`)
- `bun run --cwd apps/backend report:bench` — re-measure PDF report generation over 1/3/12/24-month periods; not part of the test suite, the numbers are machine-dependent

## Working conventions

- The two sources of truth for requirements/scope are [`Baby Tracking App PRD.md`](Baby%20Tracking%20App%20PRD.md) (German, architecture decisions in section 5) and [`docs/roadmap/`](docs/roadmap/README.md) (the PRD broken into phases 0–8, each with a checklist and Definition of Done). **Check the roadmap before proposing new work** so effort isn't duplicated or sequenced out of order.
- PRD and roadmap docs are German; responses outside code/technical terms are German too. **Code and code comments are English.**
- Architecture decisions belong in [`docs/adr/`](docs/adr/README.md), implementation narrative in `docs/implementation-notes.md`, deferred items in `docs/known-issues.md` — keep CLAUDE.md itself short.
