import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { HouseholdRole } from '../household-role.enum';
import { ChangeMemberRoleDto } from './change-member-role.dto';
import { CreateInviteDto } from './create-invite.dto';

/** The property names that failed validation for one candidate body. */
function failingPropertiesOf<T extends object>(
  dtoClass: new () => T,
  body: Record<string, unknown>,
): string[] {
  const instance = plainToInstance(dtoClass, body);
  return validateSync(instance).map((error) => error.property);
}

describe('CreateInviteDto', () => {
  it('accepts a body-less invite, which still means CO_PARENT', () => {
    expect(failingPropertiesOf(CreateInviteDto, {})).toEqual([]);
  });

  it.each([HouseholdRole.CO_PARENT, HouseholdRole.CAREGIVER, HouseholdRole.OBSERVER])(
    'accepts the invitable role %s',
    (role) => {
      expect(failingPropertiesOf(CreateInviteDto, { role })).toEqual([]);
    },
  );

  it('rejects OWNER — ownership is never granted by a shareable link', () => {
    expect(failingPropertiesOf(CreateInviteDto, { role: HouseholdRole.OWNER })).toEqual(['role']);
  });

  it('rejects an unknown role string', () => {
    expect(failingPropertiesOf(CreateInviteDto, { role: 'SUPER_ADMIN' })).toEqual(['role']);
  });
});

describe('ChangeMemberRoleDto', () => {
  it.each(Object.values(HouseholdRole))('accepts %s, including OWNER', (role) => {
    // Promoting an existing member to OWNER is how ownership is shared, so
    // unlike the invite DTO this one deliberately allows every role.
    expect(failingPropertiesOf(ChangeMemberRoleDto, { role })).toEqual([]);
  });

  it('requires a role', () => {
    expect(failingPropertiesOf(ChangeMemberRoleDto, {})).toEqual(['role']);
  });

  it('rejects an unknown role string', () => {
    expect(failingPropertiesOf(ChangeMemberRoleDto, { role: 'SUPER_ADMIN' })).toEqual(['role']);
  });
});
