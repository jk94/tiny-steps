# Baby Tracking App

A self-hosted, multiuser app for tracking a baby's daily needs and development
(feeding, sleep, diapers, growth, milestones) — built for parents/co-parents
who log entries independently but see the same shared, real-time data.

- Product requirements: [`Baby Tracking App PRD.md`](./Baby%20Tracking%20App%20PRD.md) (German)
- Implementation roadmap: [`docs/roadmap/`](./docs/roadmap/README.md)
- Agent/contributor guide: [`CLAUDE.md`](./CLAUDE.md)

## Project structure

This is a Bun-workspace monorepo:

```
apps/
  backend/   # NestJS API (serves the built frontend too, see below)
  frontend/  # React + Vite SPA
```

## Tooling notes

- **Package manager: Bun.** Bun is used for installing dependencies and
  running workspace scripts only — it is *not* the runtime. `bun run <script>`
  transparently invokes the real Node binary for any script with a
  `#!/usr/bin/env node` shebang (e.g. `nest`, `vite`), so "install with Bun,
  execute with Node" works without extra wrapper scripts.
- **Runtime: Node.js** (see `.nvmrc` for the exact pinned version). Chosen over
  Bun-as-runtime because Bun's compatibility with Prisma's native query-engine
  bindings and other native Node addons (e.g. Argon2, introduced in Phase 1)
  wasn't judged stable enough yet.
- **`trustedDependencies`** (root `package.json`): Bun blocks postinstall/
  lifecycle scripts by default for any dependency not explicitly listed here.
  `prisma` / `@prisma/client` / `@prisma/engines` are listed so `prisma
  generate` actually runs and produces the query engine on `bun install`.
  **Maintenance note:** once Phase 1 introduces `argon2`, it will need a
  postinstall (native build) too and must be added to this list.
- **Config format: YAML.** OIDC-provider and database-provider configuration
  is loaded from a YAML file at backend startup (see `config.example.yml`),
  not via an admin UI.

## Getting started

### Prerequisites

- [Bun](https://bun.sh) `>=1.3.0` (dependency installation / workspace scripts)
- [Node.js](https://nodejs.org) matching `.nvmrc` (runtime)
- [Docker](https://www.docker.com/) + Docker Compose (for self-hosted deployment)

### 1. Install dependencies

```bash
bun install
```

### 2. Configure the backend

The backend needs a `config.yml` (path from `CONFIG_PATH`, default
`./config.yml`, resolved relative to the process's working directory) and,
for Prisma, a `DATABASE_URL` env var (read by `apps/backend/prisma.config.ts`
for CLI commands, and by `PrismaService`'s driver adapter at runtime — see
`apps/backend/src/config/database-url.ts`). `DATABASE_URL` is *not*
configurable via `config.yml` — if unset it falls back to a code-level
default (`file:./data/dev.db`, relative to the working directory), but
setting it explicitly as below keeps the path predictable. Since all
`bun run --cwd apps/backend ...` commands below run with `apps/backend` as
the working directory, both paths are given relative to there:

```bash
cp config.example.yml apps/backend/config.yml
export DATABASE_URL="file:./prisma/dev.db"
```

(`CONFIG_PATH` isn't set explicitly here because the default, `./config.yml`,
already resolves to `apps/backend/config.yml` once `--cwd apps/backend` is in
effect.)

### 3. Set up the database (Prisma + SQLite)

```bash
bun run --cwd apps/backend prisma:generate
bun run --cwd apps/backend prisma:migrate:dev
```

### 4. Run the dev servers

```bash
# Backend (NestJS) — http://localhost:3000
bun run --cwd apps/backend start:dev

# Frontend (React + Vite) — http://localhost:5173
bun run --cwd apps/frontend dev
```

Health check once the backend is running:

```bash
curl http://localhost:3000/health
```

### Linting & formatting (repo-wide)

```bash
bun run lint
bun run format:check
```

### Self-hosted deployment (Docker Compose)

The app runs as a **single container**: NestJS serves the built React SPA
itself (no separate frontend/nginx container).

```bash
# 1. Copy the example config and adjust as needed
cp config.example.yml config.yml

# 2. Build and start
docker compose up --build
```

This will:

- build the frontend and backend, and run `prisma migrate deploy` against a
  SQLite file in a named Docker volume before the app starts
- serve the API under `/api` and the SPA (with client-side routing fallback)
  at `/`, plus an unprefixed `GET /health` check
- persist the SQLite database across `docker compose down` / `up` cycles via
  the `sqlite_data` volume

Verify it's up:

```bash
curl http://localhost:3000/health   # {"status":"ok",...}
curl http://localhost:3000/         # serves the SPA's index.html
```

See `config.example.yml` for all available configuration options. Note that
`database.provider` in that file is only a **sanity-check / fail-fast**
setting — it must match what Prisma's `schema.prisma` was actually generated
for. Switching the underlying database provider (e.g. SQLite → PostgreSQL) is
a one-time, explicit change (`schema.prisma` edit + `prisma generate` + fresh
`prisma migrate deploy`), not a runtime toggle.
