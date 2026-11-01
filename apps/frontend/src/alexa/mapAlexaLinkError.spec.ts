import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/http-client';
import { mapAlexaLinkError } from './mapAlexaLinkError';

describe('mapAlexaLinkError', () => {
  it.each([
    ['INVALID_CLIENT', 'alexa.link.errors.invalidClient'],
    ['INVALID_REDIRECT_URI', 'alexa.link.errors.invalidRedirectUri'],
    ['UNSUPPORTED_RESPONSE_TYPE', 'alexa.link.errors.unsupportedResponseType'],
    ['INVALID_PKCE', 'alexa.link.errors.invalidPkce'],
    ['CHILD_NOT_ACCESSIBLE', 'alexa.link.errors.childNotAccessible'],
    ['SOMETHING_ELSE', 'alexa.link.errors.generic'],
  ])('maps %s', (code, key) => {
    expect(mapAlexaLinkError(new ApiError(400, { code }))).toBe(key);
  });

  it('maps a 404 to "not set up on this instance"', () => {
    expect(mapAlexaLinkError(new ApiError(404, {}))).toBe('alexa.link.errors.disabled');
  });

  it('falls back to a generic message for network errors', () => {
    expect(mapAlexaLinkError(new TypeError('Failed to fetch'))).toBe('alexa.link.errors.generic');
  });
});
