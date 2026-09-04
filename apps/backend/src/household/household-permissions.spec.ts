import {
  ALL_ROLES,
  ENTRY_WRITE_ROLES,
  EXPORT_ROLES,
  FULL_WRITE_ROLES,
  HOUSEHOLD_PERMISSION_MATRIX,
  INVITABLE_ROLES,
  OWNER_ROLES,
} from './household-permissions';
import { HouseholdRole } from './household-role.enum';

describe('household permissions', () => {
  it('covers every declared HouseholdRole in ALL_ROLES', () => {
    // Guards against a fifth role being added to the enum but forgotten here,
    // which would silently lock that role out of every ALL_ROLES route.
    expect([...ALL_ROLES].sort()).toEqual(Object.values(HouseholdRole).sort());
  });

  it('mirrors the roadmap matrix in the named bundles', () => {
    expect(HOUSEHOLD_PERMISSION_MATRIX.readData).toBe(ALL_ROLES);
    expect(HOUSEHOLD_PERMISSION_MATRIX.recordEntry).toBe(ENTRY_WRITE_ROLES);
    expect(HOUSEHOLD_PERMISSION_MATRIX.editOwnEntry).toBe(ENTRY_WRITE_ROLES);
    expect(HOUSEHOLD_PERMISSION_MATRIX.editAnyEntry).toBe(FULL_WRITE_ROLES);
    expect(HOUSEHOLD_PERMISSION_MATRIX.deleteEntry).toBe(FULL_WRITE_ROLES);
    expect(HOUSEHOLD_PERMISSION_MATRIX.manageChildren).toBe(FULL_WRITE_ROLES);
    expect(HOUSEHOLD_PERMISSION_MATRIX.export).toBe(EXPORT_ROLES);
    expect(HOUSEHOLD_PERMISSION_MATRIX.manageMembers).toBe(OWNER_ROLES);
    expect(HOUSEHOLD_PERMISSION_MATRIX.renameHousehold).toBe(OWNER_ROLES);
    expect(HOUSEHOLD_PERMISSION_MATRIX.ownNotificationSettings).toBe(ALL_ROLES);
  });

  describe('the permission matrix matches the roadmap table', () => {
    it.each([
      ['readData', HouseholdRole.OBSERVER, true],
      ['recordEntry', HouseholdRole.CAREGIVER, true],
      ['recordEntry', HouseholdRole.OBSERVER, false],
      ['editOwnEntry', HouseholdRole.CAREGIVER, true],
      ['editAnyEntry', HouseholdRole.CAREGIVER, false],
      ['deleteEntry', HouseholdRole.CAREGIVER, false],
      ['deleteEntry', HouseholdRole.CO_PARENT, true],
      ['manageChildren', HouseholdRole.CAREGIVER, false],
      ['manageChildren', HouseholdRole.CO_PARENT, true],
      ['export', HouseholdRole.CAREGIVER, true],
      ['export', HouseholdRole.OBSERVER, false],
      ['manageMembers', HouseholdRole.CO_PARENT, false],
      ['manageMembers', HouseholdRole.OWNER, true],
      ['renameHousehold', HouseholdRole.CO_PARENT, false],
      ['ownNotificationSettings', HouseholdRole.OBSERVER, true],
    ] as const)('%s is %s for %s', (permission, role, isAllowed) => {
      expect(HOUSEHOLD_PERMISSION_MATRIX[permission].includes(role)).toBe(isAllowed);
    });
  });

  it('never grants OWNER through an invite', () => {
    // Ownership transfer must stay a deliberate act on an existing member, not
    // something a shareable link can hand out.
    expect(INVITABLE_ROLES).not.toContain(HouseholdRole.OWNER);
    expect([...INVITABLE_ROLES].sort()).toEqual(
      Object.values(HouseholdRole)
        .filter((role) => role !== HouseholdRole.OWNER)
        .sort(),
    );
  });
});
