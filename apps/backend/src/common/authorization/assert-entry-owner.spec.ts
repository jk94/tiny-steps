import { ForbiddenException } from '@nestjs/common';
import { HouseholdRole } from '../../household/household-role.enum';
import { assertMayEditEntry } from './assert-entry-owner';

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
