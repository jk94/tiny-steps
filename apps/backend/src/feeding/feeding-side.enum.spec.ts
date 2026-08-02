import { FeedingSide, toFeedingSide } from './feeding-side.enum';

describe('toFeedingSide', () => {
  it.each([FeedingSide.LEFT, FeedingSide.RIGHT])(
    'passes through a valid feeding side value %s unchanged',
    (side) => {
      expect(toFeedingSide(side)).toBe(side);
    },
  );

  it('throws on an unexpected string value', () => {
    expect(() => toFeedingSide('MIDDLE')).toThrow('Invalid FeedingSide: MIDDLE');
  });

  it('throws on an empty string', () => {
    expect(() => toFeedingSide('')).toThrow();
  });
});
