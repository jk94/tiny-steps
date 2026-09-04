import { describe, expect, it } from 'vitest';
import {
  ALL_ROLES,
  canWrite,
  ENTRY_WRITE_ROLES,
  EXPORT_ROLES,
  FULL_WRITE_ROLES,
  INVITABLE_ROLES,
  OWNER_ROLES,
  type HouseholdRole,
} from './householdPermissions';

/**
 * The expected membership of every bundle, spelled out per role rather than
 * derived from the bundles themselves — a test that recomputed the answer from
 * the same arrays it checks would pass no matter how they drift from the
 * backend matrix (`apps/backend/src/household/household-permissions.ts`).
 */
const EXPECTED_MEMBERSHIP: Record<string, readonly HouseholdRole[]> = {
  ALL_ROLES: ['OWNER', 'CO_PARENT', 'CAREGIVER', 'OBSERVER'],
  ENTRY_WRITE_ROLES: ['OWNER', 'CO_PARENT', 'CAREGIVER'],
  FULL_WRITE_ROLES: ['OWNER', 'CO_PARENT'],
  EXPORT_ROLES: ['OWNER', 'CO_PARENT', 'CAREGIVER'],
  OWNER_ROLES: ['OWNER'],
  INVITABLE_ROLES: ['CO_PARENT', 'CAREGIVER', 'OBSERVER'],
};

const BUNDLES: Record<string, readonly HouseholdRole[]> = {
  ALL_ROLES,
  ENTRY_WRITE_ROLES,
  FULL_WRITE_ROLES,
  EXPORT_ROLES,
  OWNER_ROLES,
  INVITABLE_ROLES,
};

describe('householdPermissions', () => {
  it('lists all four roles, in descending order of permission', () => {
    expect(ALL_ROLES).toEqual(['OWNER', 'CO_PARENT', 'CAREGIVER', 'OBSERVER']);
  });

  describe.each(Object.keys(BUNDLES))('canWrite against %s', (bundleName) => {
    const bundle = BUNDLES[bundleName];
    const expected = EXPECTED_MEMBERSHIP[bundleName];

    it.each(ALL_ROLES)('answers correctly for %s', (role) => {
      expect(canWrite(role, bundle)).toBe(expected.includes(role));
    });

    it('answers false for an unknown role', () => {
      expect(canWrite(undefined, bundle)).toBe(false);
    });
  });

  it('never lets an invite grant ownership', () => {
    expect(INVITABLE_ROLES).not.toContain('OWNER');
  });
});
