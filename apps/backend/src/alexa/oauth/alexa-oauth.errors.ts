/**
 * RFC 6749 section 5.2 token-endpoint error codes we actually emit.
 */
export type OAuthTokenErrorCode =
  'invalid_request' | 'invalid_client' | 'invalid_grant' | 'unsupported_grant_type';

/**
 * A token-endpoint failure. Deliberately not a Nest `HttpException`: the body
 * must be exactly `{ error, error_description? }` (RFC 6749), not Nest's
 * `{ statusCode, message }`, so `AlexaOAuthController` serializes it by hand.
 */
export class OAuthTokenError extends Error {
  constructor(
    readonly code: OAuthTokenErrorCode,
    readonly description?: string,
  ) {
    super(description ?? code);
    this.name = 'OAuthTokenError';
  }

  /** `invalid_client` is a 401 (section 5.2); everything else a 400. */
  get status(): number {
    return this.code === 'invalid_client' ? 401 : 400;
  }
}

/**
 * Why an authorization request (the consent page's query string) cannot be
 * served. These are shown on the consent page rather than redirected back to
 * Alexa: with an unknown client or redirect URI, redirecting would turn the app
 * into an open redirector (RFC 6749 section 4.1.2.1).
 */
export type AuthorizationRequestErrorCode =
  | 'ALEXA_DISABLED'
  | 'INVALID_CLIENT'
  | 'INVALID_REDIRECT_URI'
  | 'UNSUPPORTED_RESPONSE_TYPE'
  | 'INVALID_PKCE'
  | 'CHILD_NOT_ACCESSIBLE';
