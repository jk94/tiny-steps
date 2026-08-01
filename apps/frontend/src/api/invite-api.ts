import { apiFetch } from './http-client';

/**
 * Mirrors the backend's `InvitePreviewStatus`/`InvitePreview` (see
 * `apps/backend/src/household/invite.service.ts`). `householdName`/
 * `expiresAt` are only present when `status === 'valid'` — the backend
 * deliberately minimizes leakage for non-valid/unauthenticated previews.
 */
export type InvitePreviewStatus = 'invalid' | 'expired' | 'used' | 'revoked' | 'valid';

export interface InvitePreview {
  status: InvitePreviewStatus;
  householdName?: string;
  expiresAt?: string;
}

export interface AcceptedInvite {
  household: { id: string; name: string };
  role: 'OWNER' | 'CO_PARENT';
}

/**
 * Unauthenticated — lets a not-yet-registered invitee see the invite. No
 * `JwtAuthGuard` on this route, so a 401 can't occur; no `skipAuthRetry`
 * needed (unlike `auth-api.ts`'s login/register).
 */
export function previewInvite(token: string): Promise<InvitePreview> {
  return apiFetch<InvitePreview>(`/invites/${token}`);
}

export function acceptInvite(token: string): Promise<AcceptedInvite> {
  return apiFetch<AcceptedInvite>(`/invites/${token}/accept`, { method: 'POST' });
}
