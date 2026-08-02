# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Phase 0 (project scaffolding) has been implemented — a Bun-workspace monorepo with a NestJS backend (`apps/backend`) and a React+Vite frontend (`apps/frontend`), Prisma/SQLite, YAML config loading, and a single-container Docker setup. At the time of writing this lives on branch `worktree-agent-aff8f727564b1fdd9` pending merge to `main`; update this note once merged.

Common commands (run from repo root unless noted):
- `bun install` — install all workspace dependencies
- `bun run lint` / `bun run format:check` — ESLint/Prettier across both apps
- `bun run --cwd apps/backend start:dev` — run the NestJS backend with hot reload (`GET /health`, API under `/api`)
- `bun run --cwd apps/backend test` — backend unit tests (Jest)
- `bun run --cwd apps/backend prisma:migrate:dev` — apply Prisma migrations against local SQLite
- `bun run --cwd apps/frontend dev` — run the Vite dev server for the frontend; requires the backend (`bun run --cwd apps/backend start:dev`) running on `localhost:3000` too, since `vite.config.ts` proxies `/api` there for cookie-domain reasons (see comment in that file)
- `bun run --cwd apps/frontend test` — frontend unit tests (Vitest)
- `cp config.example.yml config.yml && docker compose up --build` — build and run the whole app as a single container (backend serves the built frontend)

The two sources of truth for requirements/scope remain:
- [`Baby Tracking App PRD.md`](Baby%20Tracking%20App%20PRD.md) — product requirements (in German), including the architecture decisions in section 5
- [`docs/roadmap/`](docs/roadmap/README.md) — the PRD broken into implementation phases (0–6), each with a checklist of tasks and a Definition of Done

## Architecture (as decided in the PRD, not yet implemented)

- **Self-hosted only** — no SaaS/cloud offering. Deployment via Docker/Docker Compose. Configuration (including OIDC providers and DB provider) is done via a config file, not an admin UI.
- **Backend: NestJS** (deliberately chosen over Next.js — see PRD section 5.3 for the full comparison). Key reasons: native long-lived Node process for WebSockets (`@nestjs/websockets`), and a structured Guard/Passport-strategy model for running local auth and OIDC side by side.
- **Frontend: React + Vite** (SPA, no Next.js — this is an internal, logged-in family app with no SEO/SSR need). Mobile-first from the start.
- **Auth**: local email/password (Argon2 hashing) *and* OIDC (Authorization Code Flow + PKCE) coexist; users pick a method at login. One or more OIDC providers (Keycloak, Authentik, Google, Entra ID, …) are registered via config file, not code changes. Session/token handling (local auth, implemented in Phase 1): JWT access + refresh tokens in httpOnly, `SameSite=Lax` cookies, with DB-backed refresh-token rotation and reuse detection — see [ADR-0001](docs/adr/0001-jwt-httponly-cookie-session-handling.md) for the full rationale, since PRD 5.1 left this open. OIDC (not yet implemented) will reuse the same token/cookie infrastructure.
- **Data model** (see PRD 5.2): `User —< Membership >— Household —< Child —< Event`. Every `Event` (Feeding/Sleep/Diaper) references both the `Child` and the `User` who logged it. Authorization is checked via the user's `Membership` role in the `Household`. `Event` itself is a shared base table (`type`, `occurredAt`, `startedAt`/`endedAt` for timer-based types); type-specific fields live in a 1:1 detail table per event type, but only where a type actually has fields beyond what `Event` already carries — `FeedingDetail` implemented in Phase 2 (Stillen/Fläschchen/Beikost); Sleep (also implemented in Phase 2) turned out to need no detail table at all, since start/stop timer + backfill is fully covered by base-`Event` columns; `DiaperDetail` (implemented in Phase 2, the third and final MVP event type) does follow the `FeedingDetail` pattern, since Diaper has type-specific fields (`diaperType`, optional consistency note) — see [ADR-0006](docs/adr/0006-event-base-table-with-per-type-detail-tables.md) including its Sleep and Diaper addenda. All three MVP event types (Feeding/Sleep/Diaper) are now implemented, closing out Phase 2's "Tracking-Kernfunktionen".
- **Real-time sync**: implemented in Phase 3 slice 1 — a Socket.IO gateway (`RealtimeGateway`/`RealtimeService` in `apps/backend/src/realtime/`) attached to the same HTTP server as the REST API, consumed via `RealtimeProvider`/`useHouseholdRoom` in `apps/frontend/src/realtime/`. WS handshake auth reuses the same JWT/cookie infrastructure as HTTP through a newly extracted `AccessTokenVerifierService` (shared with `JwtStrategy`), with no separate CSRF check since the existing `SameSite=Lax` + no-CORS posture already rules out cross-origin handshakes. Sockets join a `household:<id>` room per-active-route (`joinHousehold`/`leaveHousehold`), not all at connect, since there's no global "current household" frontend state. Broadcasts carry a thin `{type, action, eventId, childId, householdId}` payload — clients refetch via React Query rather than the socket carrying full event bodies, and also refetch on every `connect`/reconnect as the reconnect strategy (no server-side replay log). See [ADR-0007](docs/adr/0007-websocket-realtime-sync.md).
- **Day-timeline & statistics** (also Phase 3, closing it out): a new read-only `EventModule` (`apps/backend/src/event/`) merges Feeding/Sleep/Diaper into one chronologically-sorted list (`GET .../events/daily`) and computes sleep hours/feeding count/`lastEventAt`-per-type (`GET .../events/stats`), reusing the existing per-type summary-mapping functions from `feeding.service.ts`/`sleep.service.ts`/`diaper.service.ts` rather than duplicating duration-derivation logic; `lastEventAt` is deliberately "most recent ever" per type, not scoped to the requested range. Both endpoints take `from`/`to` as full ISO-8601 instants — the frontend (`apps/frontend/src/lib/dayBoundaries.ts`) computes local-midnight-to-local-midnight boundaries itself from the browser's local `Date` semantics, so the backend does zero timezone reasoning. A new `GET /households/:householdId/members` endpoint (on the existing `HouseholdModule`) resolves user ids to emails for the frontend's `DailyTimeline` page (`apps/frontend/src/pages/DailyTimeline.tsx`), which also extends the real-time invalidation from ADR-0007 with one additional broad query-key invalidation so it stays live too.
- **Offline-first**: new entries are written locally first (e.g. IndexedDB) and shown optimistically; sync to the server happens when connectivity is available. Conflict resolution is last-write-wins based on the event's timestamp. Only the "PWA basics" first slice of Phase 4 is implemented so far — an installable app shell via `vite-plugin-pwa`'s `generateSW` strategy (Web App Manifest + a service worker caching the built static assets, registered explicitly from `apps/frontend/src/main.tsx` rather than auto-injected), with `/api`/Socket.IO traffic deliberately left network-only (no offline data caching yet) — see [ADR-0008](docs/adr/0008-pwa-basics-via-vite-plugin-pwa.md). The IndexedDB layer, optimistic UI, sync queue, and last-write-wins conflict resolution described above remain unimplemented, as does manual real-device installability verification (Android/iOS/Desktop).
- **Database**: Prisma ORM, SQLite for MVP, schema kept portable to PostgreSQL/MySQL via config-driven provider selection. Migrations via Prisma Migrate from the start.
- **Native wrapper**: a minimal Capacitor or Tauri wrapper around the React codebase is required even for the MVP, because push notifications are implemented per-platform through the wrapper (not Web Push). The Capacitor-vs-Tauri choice is still open (see PRD section 7 and roadmap Phase 5).
- **Package manager**: Bun (workspaces for the monorepo). **Runtime: Node.js**, deliberately not Bun — Bun-as-runtime compatibility with Prisma's query engine bindings and native Node modules (e.g. Argon2) wasn't considered stable enough at the time of this decision (Phase 0). Bun is build/install tooling only; Docker images and `nest start` run on Node.js. See PRD section 5.6.
- **Config file format**: YAML (see PRD 5.6).

## Roles & permissions model

Household membership carries a role that gates permissions (see PRD section 3):
- **Owner/Elternteil** — full read/write, can invite users, create/delete child profiles
- **Co-Parent** — full read/write on assigned child profiles
- **Betreuer** (later) — can log events only, no delete/manage
- **Beobachter** (later) — read-only

A user can belong to multiple households (e.g. separated parents), and a household can have multiple child profiles (siblings).

## Working conventions for this repo

- The PRD and roadmap docs are written in German; the user's global instructions require responses in German outside of code/technical terms. Code and code comments should be in English.
- Roadmap phase files in `docs/roadmap/` are the task backlog — check them before proposing new work so effort isn't duplicated or sequenced out of order (phases are largely sequential; see the dependency diagram in `docs/roadmap/README.md`).
