/**
 * Shape of a single OIDC provider entry under `auth.oidc.providers` in
 * `config.yml`. Validated by `configuration.schema.ts` at startup.
 *
 * `clientSecret` deliberately lives in `config.yml`, not an env var — see
 * ADR-0004 for the reasoning (a structured, variable-length, per-provider
 * field doesn't fit this codebase's existing "one secret, one env var"
 * pattern used for `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`).
 */
export interface OidcProviderConfig {
  /** URL-safe slug, used in routes (`/api/auth/oidc/:id/...`) and `OidcIdentity.providerId`. */
  id: string;
  /** Human-readable label for the (future) frontend login-provider-selection UI. */
  displayName: string;
  /** OIDC discovery issuer URL, e.g. `https://keycloak.example.com/realms/family`. */
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** Defaults to `['openid', 'profile', 'email']` when omitted — see `configuration.schema.ts`. */
  scopes: string[];
}
