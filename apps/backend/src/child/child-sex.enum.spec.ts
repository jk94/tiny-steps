import { ChildSex, toChildSex } from './child-sex.enum';

describe('toChildSex', () => {
  it.each([ChildSex.FEMALE, ChildSex.MALE])(
    'passes through a valid sex value %s unchanged',
    (sex) => {
      expect(toChildSex(sex)).toBe(sex);
    },
  );

  it('throws on an unexpected string value', () => {
    expect(() => toChildSex('DIVERSE')).toThrow('Invalid ChildSex: DIVERSE');
  });

  it('throws on a lower-case value', () => {
    expect(() => toChildSex('male')).toThrow();
  });

  it('throws on an empty string', () => {
    // "Not specified" is `null` on the column, never an empty string, so an
    // empty value reaching here is corrupted data and must not be silently
    // accepted (W-10 forbids guessing a default).
    expect(() => toChildSex('')).toThrow();
  });
});
