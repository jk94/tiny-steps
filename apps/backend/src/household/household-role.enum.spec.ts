import { HouseholdRole, toHouseholdRole } from './household-role.enum';

describe('toHouseholdRole', () => {
  it.each([HouseholdRole.OWNER, HouseholdRole.CO_PARENT])(
    'passes through a valid role value %s unchanged',
    (role) => {
      expect(toHouseholdRole(role)).toBe(role);
    },
  );

  it('throws on an unexpected string value', () => {
    expect(() => toHouseholdRole('SUPER_ADMIN')).toThrow('Invalid HouseholdRole: SUPER_ADMIN');
  });

  it('throws on an empty string', () => {
    expect(() => toHouseholdRole('')).toThrow();
  });
});
