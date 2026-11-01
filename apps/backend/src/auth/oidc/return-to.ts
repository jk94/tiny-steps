const MAX_RETURN_TO_LENGTH = 2048;
const PLACEHOLDER_ORIGIN = 'http://return-to.invalid';

/**
 * Validates where the SPA wants to land after an OIDC login (`?returnTo=`),
 * so a login that started on e.g. the Alexa consent page (`/alexa/link?…`) or
 * an invite link returns there instead of to `/` (Phase 8, ALX-7).
 *
 * Only same-origin, app-relative paths survive — this is the open-redirect
 * guard: no scheme, no host, no protocol-relative `//evil`, no backslash
 * tricks (`/\evil` is `//evil` to some browsers), no control characters, and
 * nothing under `/api/` (the OIDC callback must land on a page, not an
 * endpoint). Anything else yields `undefined`, i.e. the old default `/`.
 */
export function sanitizeReturnTo(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_RETURN_TO_LENGTH) {
    return undefined;
  }
  // eslint-disable-next-line no-control-regex
  if (!value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) {
    return undefined;
  }

  let url: URL;
  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return undefined;
  }
  if (
    url.origin !== PLACEHOLDER_ORIGIN ||
    url.pathname === '/api' ||
    url.pathname.startsWith('/api/')
  ) {
    return undefined;
  }
  return url.pathname + url.search + url.hash;
}
