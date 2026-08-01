import { ApiError } from '../api/http-client';

export type InviteErrorKey = 'invite.errors.acceptFailed' | 'invite.errors.generic';

/**
 * Maps a caught invite-accept failure to a translation key. `POST
 * /api/invites/:token/accept` returns a uniform 404 for any invalid/
 * expired/used/revoked/unknown token (see `InviteController`) — less
 * granular than the preview endpoint's `status` field, so there's nothing
 * more specific to distinguish here.
 */
export function mapInviteError(error: unknown): InviteErrorKey {
  if (error instanceof ApiError && error.status === 404) {
    return 'invite.errors.acceptFailed';
  }
  return 'invite.errors.generic';
}
