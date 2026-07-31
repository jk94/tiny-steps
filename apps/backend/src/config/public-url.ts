/**
 * Default public base URL used when the `PUBLIC_URL` environment variable
 * isn't set. Only intended to make local development work out of the box —
 * self-hosted deployments behind a reverse proxy/domain should set
 * `PUBLIC_URL` explicitly (see `docker-compose.yml`).
 */
export const DEFAULT_PUBLIC_URL = 'http://localhost:3000';

/**
 * Resolves the effective public base URL, used to construct the OIDC
 * `redirect_uri` (`${resolvePublicUrl()}/api/auth/oidc/:providerId/callback`).
 *
 * This mirrors `resolveDatabaseUrl()`'s pattern (env var overrides a
 * code-level default, not read from `config.yml`) rather than deriving the
 * value from the incoming request (`req.protocol`/`req.get('host')`): this
 * app has no trusted-proxy configuration (no `app.set('trust proxy', ...)`,
 * no `X-Forwarded-*` handling), so request-derived values would be
 * unreliable behind an arbitrary self-hosted reverse-proxy setup — and OIDC
 * redirect URIs must byte-exact-match what's registered at the IdP. See
 * ADR-0004.
 */
export function resolvePublicUrl(): string {
  return process.env.PUBLIC_URL ?? DEFAULT_PUBLIC_URL;
}
