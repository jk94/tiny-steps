import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Opaque tokens for Alexa account linking (ADR-0017). 256 bits of entropy,
 * URL-safe, with a short prefix so a token found in a log can be told apart at
 * a glance (`tsa_` access, `tsr_` refresh, `tsc_` authorization code). Only the
 * hash is ever persisted — same reasoning as `invite-token.util.ts`: a fast
 * hash is fine for high-entropy random input.
 */
export type AlexaTokenKind = 'access' | 'refresh' | 'code';

const PREFIX: Record<AlexaTokenKind, string> = {
  access: 'tsa_',
  refresh: 'tsr_',
  code: 'tsc_',
};

export function generateAlexaToken(kind: AlexaTokenKind): string {
  return PREFIX[kind] + randomBytes(32).toString('base64url');
}

export function hashAlexaToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Constant-time string comparison for the client secret. Both sides are hashed
 * first so `timingSafeEqual` always compares equal-length buffers and the
 * length of the configured secret does not leak either.
 */
export function secretsMatch(presented: string, expected: string): boolean {
  const a = createHash('sha256').update(presented).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/** RFC 7636 `S256`: BASE64URL(SHA256(ASCII(code_verifier))). */
export function pkceS256Challenge(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier, 'ascii').digest('base64url');
}

/** RFC 7636 section 4.1: 43–128 characters from the unreserved set. */
export const PKCE_VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;
