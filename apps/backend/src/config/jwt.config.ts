/**
 * Access/refresh token secrets, resolved purely from the environment.
 *
 * Unlike `resolveDatabaseUrl()` (see `database-url.ts`), there is
 * deliberately NO code-level default here — a fallback JWT signing secret
 * is a classic "forgot to override in prod" vulnerability. Both env vars
 * must always be set, dev included (see README).
 *
 * Also unlike `database.provider`/`auth.local.enabled`, these are never
 * exposed via `config.yml` — secrets stay out of YAML, consistent with the
 * `DATABASE_URL` precedent (see `configuration.schema.ts`).
 */
export interface JwtSecrets {
  accessSecret: string;
  refreshSecret: string;
}

export const ACCESS_TOKEN_TTL = '15m';
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // kept in sync with ACCESS_TOKEN_TTL, used for cookie maxAge
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Resolves the JWT secrets, throwing synchronously if either is missing or
 * empty. Wired into a Nest provider factory (see `auth.module.ts`) so the
 * app fails to bootstrap rather than silently signing tokens with
 * `undefined` — the same fail-fast contract as `loadConfiguration()`.
 */
export function resolveJwtSecrets(): JwtSecrets {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!accessSecret || !refreshSecret) {
    throw new Error(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must both be set (no default — see README).',
    );
  }

  return { accessSecret, refreshSecret };
}
