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
 * Constant-time comparison of the presented client secret with the configured
 * one.
 *
 * `timingSafeEqual` needs equal-length buffers. On a length mismatch the
 * configured secret is compared with itself, so the call always takes the
 * same time for a given configuration and the outcome never depends on where
 * the bytes first differ. Deliberately no hashing of the secret: a fast hash
 * of a password-like value is exactly what CodeQL's
 * `js/insufficient-password-hash` warns about, and it would add nothing here.
 */
export function secretsMatch(presented: string, expected: string): boolean {
  const presentedBytes = Buffer.from(presented, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  const sameLength = presentedBytes.length === expectedBytes.length;
  const equal = timingSafeEqual(sameLength ? presentedBytes : expectedBytes, expectedBytes);
  return sameLength && equal;
}

/** RFC 7636 `S256`: BASE64URL(SHA256(ASCII(code_verifier))). */
export function pkceS256Challenge(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier, 'ascii').digest('base64url');
}

/** RFC 7636 section 4.1: 43–128 characters from the unreserved set. */
export const PKCE_VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;
