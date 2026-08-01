export type OidcErrorKey =
  | 'auth.oidc.errors.invalidState'
  | 'auth.oidc.errors.idpError'
  | 'auth.oidc.errors.authFailed'
  | 'auth.oidc.errors.emailRequired'
  | 'auth.oidc.errors.emailInUse'
  | 'auth.oidc.errors.generic';

const OIDC_ERROR_CODE_TO_KEY: Record<string, OidcErrorKey> = {
  invalid_state: 'auth.oidc.errors.invalidState',
  idp_error: 'auth.oidc.errors.idpError',
  auth_failed: 'auth.oidc.errors.authFailed',
  email_required: 'auth.oidc.errors.emailRequired',
  email_in_use: 'auth.oidc.errors.emailInUse',
};

/**
 * Maps the `oidc_error` query-param code the backend's OIDC callback
 * redirects to `/login` with (see `GET /api/auth/oidc/:providerId/callback`)
 * to a translation key — never renders the raw code to the user. `null`
 * means "no error param present", distinct from an unrecognized code (which
 * falls back to the generic key).
 */
export function mapOidcError(code: string | null): OidcErrorKey | null {
  if (code === null) {
    return null;
  }
  return OIDC_ERROR_CODE_TO_KEY[code] ?? 'auth.oidc.errors.generic';
}
