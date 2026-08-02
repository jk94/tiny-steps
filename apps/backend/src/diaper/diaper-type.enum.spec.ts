import { DiaperType, toDiaperType } from './diaper-type.enum';

describe('toDiaperType', () => {
  it.each([DiaperType.PEE, DiaperType.STOOL, DiaperType.BOTH])(
    'passes through a valid diaper type value %s unchanged',
    (type) => {
      expect(toDiaperType(type)).toBe(type);
    },
  );

  it('throws on an unexpected string value', () => {
    expect(() => toDiaperType('EXPLOSION')).toThrow('Invalid DiaperType: EXPLOSION');
  });

  it('throws on an empty string', () => {
    expect(() => toDiaperType('')).toThrow();
  });
});
