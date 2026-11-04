import { ApiError } from '../api/http-client';

export type AlexaLinkErrorKey =
  | 'alexa.link.errors.disabled'
  | 'alexa.link.errors.invalidClient'
  | 'alexa.link.errors.invalidRedirectUri'
  | 'alexa.link.errors.unsupportedResponseType'
  | 'alexa.link.errors.invalidPkce'
  | 'alexa.link.errors.childNotAccessible'
  | 'alexa.link.errors.generic';

const CODE_TO_KEY: Record<string, AlexaLinkErrorKey> = {
  INVALID_CLIENT: 'alexa.link.errors.invalidClient',
  INVALID_REDIRECT_URI: 'alexa.link.errors.invalidRedirectUri',
  UNSUPPORTED_RESPONSE_TYPE: 'alexa.link.errors.unsupportedResponseType',
  INVALID_PKCE: 'alexa.link.errors.invalidPkce',
  CHILD_NOT_ACCESSIBLE: 'alexa.link.errors.childNotAccessible',
};

/**
 * Maps the consent page's API errors to a message. The backend deliberately
 * never redirects an invalid request back to Alexa (open-redirect guard), so
 * this page is where an operator learns e.g. that a redirect URI is missing
 * from `config.yml`.
 */
export function mapAlexaLinkError(error: unknown): AlexaLinkErrorKey {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'alexa.link.errors.disabled';
    const code = (error.body as { code?: unknown } | undefined)?.code;
    // Own keys only: `in` would also match `constructor`/`toString` from the prototype.
    if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(CODE_TO_KEY, code)) {
      return CODE_TO_KEY[code];
    }
  }
  return 'alexa.link.errors.generic';
}
