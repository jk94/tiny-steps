import { describe, expect, it } from 'vitest';
import {
  ALL_ROLES,
  canEditEntry,
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

  describe('canEditEntry', () => {
    const AUTHOR_ID = 'user-author';
    const OTHER_ID = 'user-other';

    it.each(FULL_WRITE_ROLES)('lets %s edit an entry recorded by someone else', (role) => {
      expect(canEditEntry(role, AUTHOR_ID, OTHER_ID)).toBe(true);
    });

    it.each(FULL_WRITE_ROLES)('lets %s edit their own entry', (role) => {
      expect(canEditEntry(role, AUTHOR_ID, AUTHOR_ID)).toBe(true);
    });

    it('lets a CAREGIVER edit their own entry', () => {
      expect(canEditEntry('CAREGIVER', AUTHOR_ID, AUTHOR_ID)).toBe(true);
    });

    it("does not let a CAREGIVER edit someone else's entry", () => {
      expect(canEditEntry('CAREGIVER', AUTHOR_ID, OTHER_ID)).toBe(false);
    });

    it('does not let an OBSERVER edit even their own entry', () => {
      expect(canEditEntry('OBSERVER', AUTHOR_ID, AUTHOR_ID)).toBe(false);
    });

    it('denies an unresolved role, so nothing flashes into view while loading', () => {
      expect(canEditEntry(undefined, AUTHOR_ID, AUTHOR_ID)).toBe(false);
    });

    it('denies a CAREGIVER whose own user id is not resolved yet', () => {
      expect(canEditEntry('CAREGIVER', AUTHOR_ID, undefined)).toBe(false);
    });
  });
});
