import type { HouseholdRole } from '../lib/householdPermissions';

/**
 * Literal union rather than `string`, because `t()` is typed against the
 * generated key union (see `i18n/i18next.d.ts`) and would reject a widened
 * `string`.
 */
export type HouseholdRoleLabelKey =
  | 'household.roles.ownerLabel'
  | 'household.roles.coParentLabel'
  | 'household.roles.caregiverLabel'
  | 'household.roles.observerLabel';

const ROLE_LABEL_KEYS: Record<HouseholdRole, HouseholdRoleLabelKey> = {
  OWNER: 'household.roles.ownerLabel',
  CO_PARENT: 'household.roles.coParentLabel',
  CAREGIVER: 'household.roles.caregiverLabel',
  OBSERVER: 'household.roles.observerLabel',
};

/**
 * The i18n key for a role's display label. A lookup table rather than the
 * ternary that used to sit inline in `HouseholdList`/`HouseholdDetail` — with
 * four roles a ternary silently mislabels the two it doesn't know about.
 */
export function householdRoleLabelKey(role: HouseholdRole): HouseholdRoleLabelKey {
  return ROLE_LABEL_KEYS[role];
}
