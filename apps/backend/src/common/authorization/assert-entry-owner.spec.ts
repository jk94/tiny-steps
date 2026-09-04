import { ForbiddenException } from '@nestjs/common';
import { HouseholdRole } from '../../household/household-role.enum';
import { assertMayEditEntry, mayEditAnyEntry } from './assert-entry-owner';

/**
 * The role axis is exhaustive on purpose: both branches are derived from the
 * `FULL_WRITE_ROLES`/`ENTRY_WRITE_ROLES` bundles rather than naming a role, so
 * these cases are what pins the derivation to the intended matrix.
 */
describe('assertMayEditEntry', () => {
  const actingUserId = 'user-acting';
  const otherUserId = 'user-other';

  const actorWith = (role: HouseholdRole) => ({ userId: actingUserId, role });

  describe('own entry', () => {
    it.each([HouseholdRole.OWNER, HouseholdRole.CO_PARENT, HouseholdRole.CAREGIVER])(
      'allows %s to edit an entry they recorded themselves',
      (role) => {
        expect(() => assertMayEditEntry(actorWith(role), actingUserId)).not.toThrow();
      },
    );

    it('rejects OBSERVER even on their own entry', () => {
      // An observer can never have recorded anything, so this is only ever a
      // defensive backstop — but it must not be a hole either.
      expect(() => assertMayEditEntry(actorWith(HouseholdRole.OBSERVER), actingUserId)).toThrow(
        ForbiddenException,
      );
    });
  });

  describe("someone else's entry", () => {
    it.each([HouseholdRole.OWNER, HouseholdRole.CO_PARENT])(
      'allows %s to edit an entry recorded by another member',
      (role) => {
        expect(() => assertMayEditEntry(actorWith(role), otherUserId)).not.toThrow();
      },
    );

    it.each([HouseholdRole.CAREGIVER, HouseholdRole.OBSERVER])(
      'rejects %s on an entry recorded by another member',
      (role) => {
        expect(() => assertMayEditEntry(actorWith(role), otherUserId)).toThrow(ForbiddenException);
      },
    );
  });

  describe('mayEditAnyEntry', () => {
    it.each([
      [HouseholdRole.OWNER, true],
      [HouseholdRole.CO_PARENT, true],
      [HouseholdRole.CAREGIVER, false],
      [HouseholdRole.OBSERVER, false],
    ] as const)('is %s for %s', (role, expected) => {
      expect(mayEditAnyEntry(actorWith(role))).toBe(expected);
    });
  });

  it('reports a machine-readable NOT_ENTRY_OWNER code', () => {
    try {
      assertMayEditEntry(actorWith(HouseholdRole.CAREGIVER), otherUserId);
      fail('expected a ForbiddenException');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        statusCode: 403,
        code: 'NOT_ENTRY_OWNER',
      });
    }
  });
});
