# syntax=docker/dockerfile:1
#
# Single-container image: NestJS serves both the API (under /api, see
# apps/backend/src/main.ts) and the built React SPA (via ServeStaticModule,
# see apps/backend/src/app.module.ts). There is deliberately no separate
# frontend/nginx container — see the root README and CLAUDE.md.
#
# Bun is used only for installing dependencies / running build scripts here;
# the actual runtime (both `prisma generate`'s postinstall in the build stage
# and the app itself in the runtime stage) is Node — see the README's
# "Tooling notes" section for why.

# ---- Build stage ------------------------------------------------------------
FROM node:24.18.0-slim AS build

# Grab the Bun binary from the official Bun image instead of curl-installing
# it, so we don't need extra apt packages in this stage.
COPY --from=oven/bun:1.3.14 /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app

# Copy manifests first for better layer caching.
COPY package.json bun.lock ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/growth-chart-static/package.json packages/growth-chart-static/package.json

# `bun install` also runs postinstall scripts for every package listed in
# root `package.json`'s `trustedDependencies` (incl. `prisma`'s own postinstall
# and `better-sqlite3`'s native build) — under the real Node binary present in
# this stage, since `bun run`/`bunx` respect a script's `#!/usr/bin/env node`
# shebang unless `--bun` is passed (never is, here or anywhere else in this
# project). Only manifests are copied at this point, so `prisma`'s postinstall
# can't run `prisma generate` against the real schema yet — that happens
# explicitly below, once the full source is present. For the same reason the
# growth-chart package's `prepare` script (which compiles it) is a no-op here
# and has to be re-run explicitly below.
RUN bun install --frozen-lockfile

# Now copy the rest of the source and build both apps.
COPY . .

# Explicit `prisma generate` against the real schema (see comment above).
RUN bun run --cwd apps/backend prisma:generate

# The shared growth chart compiles to a dual ESM/CJS build that the backend
# imports as a normal package (see ADR-0015) — must precede the app builds.
RUN bun run --cwd packages/growth-chart-static build

RUN bun run --cwd apps/frontend build
RUN bun run --cwd apps/backend build

# Copy the built frontend into the location the backend's ServeStaticModule
# reads from at runtime (apps/backend/src/app.module.ts: rootPath).
RUN mkdir -p apps/backend/dist/public \
    && cp -r apps/frontend/dist/. apps/backend/dist/public/

# ---- Runtime stage -----------------------------------------------------------
FROM node:24.18.0-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app/apps/backend

# Non-root user to run the app as.
RUN groupadd --system app && useradd --system --gid app --create-home app

# Only what's needed to run the compiled app: node_modules (root + backend
# workspace symlinks), the compiled backend (incl. the copied-in frontend
# static files under dist/public), and the Prisma schema/migrations/config
# (needed by `prisma migrate deploy` at container start, run via
# docker-entrypoint.sh below — see docker-compose.yml for how it's wired up).
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/backend/node_modules /app/apps/backend/node_modules
# The workspace symlink in apps/backend/node_modules/@baby-tracker points here,
# so the package's manifest (for the `exports` map) and its compiled CJS output
# have to travel with it. Its source is deliberately left behind.
COPY --from=build /app/packages/growth-chart-static/package.json /app/packages/growth-chart-static/package.json
COPY --from=build /app/packages/growth-chart-static/dist /app/packages/growth-chart-static/dist
COPY --from=build /app/apps/backend/dist ./dist
COPY --from=build /app/apps/backend/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=build /app/apps/backend/prisma/migrations ./prisma/migrations
COPY --from=build /app/apps/backend/prisma.config.ts ./prisma.config.ts
# prisma.config.ts imports this directly from source (Prisma's CLI loader
# transpiles it on the fly) — must ship alongside prisma.config.ts or
# `prisma migrate deploy` fails at container start with a "Cannot find
# module" error.
COPY --from=build /app/apps/backend/src/config/database-url.ts ./src/config/database-url.ts
COPY --from=build /app/apps/backend/package.json ./package.json
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /app/data/uploads/children \
    && chown -R app:app /app \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

USER app

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
