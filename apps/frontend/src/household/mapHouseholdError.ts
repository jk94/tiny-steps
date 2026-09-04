import { ApiError } from '../api/http-client';

export type HouseholdErrorKey =
  | 'household.errors.notFound'
  | 'household.errors.forbidden'
  | 'household.errors.cannotChangeOwnRole'
  | 'household.errors.cannotRemoveSelf'
  | 'household.errors.lastOwnerCannotBeDemoted'
  | 'household.errors.lastOwnerCannotBeRemoved'
  | 'household.errors.generic';

interface HouseholdErrorBody {
  code?: string;
}

function isHouseholdErrorBody(body: unknown): body is HouseholdErrorBody {
  return typeof body === 'object' && body !== null;
}

/**
 * Maps a caught household-request failure to a translation key — never to
 * raw `error.body` text, since the backend has no locale awareness (mirrors
 * `auth/mapAuthError.ts`). Status-code-driven, refined by the backend's
 * machine-readable `code` where available (the pattern established in
 * `milestone/mapMilestoneError.ts`); an unrecognized or missing `code` falls
 * back to the status code's generic key rather than guessing.
 *
 * The member-management codes matter because each one names a state the user
 * can act on ("promote the other member first", "ask someone else to remove
 * you") — a generic "something went wrong" would leave them stuck.
 */
export function mapHouseholdError(error: unknown): HouseholdErrorKey {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return 'household.errors.notFound';
    }

    const body = isHouseholdErrorBody(error.body) ? error.body : undefined;

    if (error.status === 403) {
      switch (body?.code) {
        case 'CANNOT_CHANGE_OWN_ROLE':
          return 'household.errors.cannotChangeOwnRole';
        case 'CANNOT_REMOVE_SELF':
          return 'household.errors.cannotRemoveSelf';
        default:
          return 'household.errors.forbidden';
      }
    }

    if (error.status === 409) {
      switch (body?.code) {
        case 'LAST_OWNER_CANNOT_BE_DEMOTED':
          return 'household.errors.lastOwnerCannotBeDemoted';
        case 'LAST_OWNER_CANNOT_BE_REMOVED':
          return 'household.errors.lastOwnerCannotBeRemoved';
        default:
          return 'household.errors.generic';
      }
    }
  }
  return 'household.errors.generic';
}
