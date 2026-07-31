/**
 * Default directory (relative to the backend process's cwd) used for
 * uploaded files (currently only child photos, see
 * `ChildPhotoStorageService`) when the `UPLOADS_DIR` environment variable
 * isn't set. Only intended to make local development work out of the box —
 * self-hosted deployments should set `UPLOADS_DIR` explicitly (see
 * `docker-compose.yml`), pointed at the same persisted volume as the SQLite
 * database.
 */
export const DEFAULT_UPLOADS_DIR = './data/uploads';

/**
 * Resolves the effective uploads directory.
 *
 * This project's config precedence is: env var overrides YAML config,
 * which overrides a code-level default. The uploads directory specifically
 * is NOT configurable via `config.yml` at all (only `UPLOADS_DIR` and this
 * default matter) — mirrors `resolveDatabaseUrl()` in `database-url.ts` for
 * the same reasoning (a filesystem path is deployment topology, not product
 * configuration).
 */
export function resolveUploadsDir(): string {
  return process.env.UPLOADS_DIR ?? DEFAULT_UPLOADS_DIR;
}
