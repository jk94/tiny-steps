/**
 * Default SQLite connection string used when the `DATABASE_URL` environment
 * variable isn't set. Only intended to make local development work out of
 * the box — self-hosted deployments should set `DATABASE_URL` explicitly
 * (see `docker-compose.yml`).
 */
export const DEFAULT_DATABASE_URL = 'file:./data/dev.db';

/**
 * Resolves the effective database connection string.
 *
 * This project's config precedence is: env var overrides YAML config,
 * which overrides a code-level default. The database URL specifically is
 * NOT configurable via `config.yml` at all (only `DATABASE_URL` and this
 * default matter) — see the comment on `database.provider` in
 * `config.example.yml` for the reasoning, and keep this in sync with any
 * place that reads `process.env.DATABASE_URL` directly (currently
 * `PrismaService` and `prisma.config.ts`).
 */
export function resolveDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}
