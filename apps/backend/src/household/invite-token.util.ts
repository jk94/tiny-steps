import { createHash, randomBytes } from 'crypto';

/**
 * Generates a random, URL-safe invite token (256 bits of entropy). This is
 * the value shown once to the inviter and shared out-of-band (link/code) —
 * only its hash (see `hashInviteToken`) is ever persisted.
 */
export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hashes an invite token for storage/lookup (`Invite.tokenHash`). Plain
 * SHA-256 is sufficient here (unlike password hashing) because the input
 * is a high-entropy random token, not a low-entropy user-chosen secret —
 * there's no brute-force-by-guessing risk to defend against with a slow
 * hash.
 */
export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
