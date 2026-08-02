import { FeedingType, toFeedingType } from './feeding-type.enum';

describe('toFeedingType', () => {
  it.each([FeedingType.BREAST, FeedingType.BOTTLE, FeedingType.SOLID])(
    'passes through a valid feeding type value %s unchanged',
    (type) => {
      expect(toFeedingType(type)).toBe(type);
    },
  );

  it('throws on an unexpected string value', () => {
    expect(() => toFeedingType('PUREE')).toThrow('Invalid FeedingType: PUREE');
  });

  it('throws on an empty string', () => {
    expect(() => toFeedingType('')).toThrow();
  });
});
