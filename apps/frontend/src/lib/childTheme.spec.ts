import { describe, expect, it } from 'vitest';
import { CHILD_GRADIENTS, childGradientClass } from './childTheme';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

describe('childTheme', () => {
  it.each(CHILD_GRADIENTS.flatMap((gradient) => [gradient.from, gradient.to]))(
    'keeps white text readable on gradient stop %s (WCAG AA)',
    (stop) => {
      expect(contrastWithWhite(stop)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('picks the same gradient for the same child every time', () => {
    expect(childGradientClass('child-a')).toBe(childGradientClass('child-a'));
  });

  it('only ever returns one of the declared gradients', () => {
    const declared = CHILD_GRADIENTS.map((gradient) => gradient.className) as string[];
    for (const id of ['a', 'b', 'c', '8893ae4b-775b-4001-b0f1-7fd0f83563c4', '']) {
      expect(declared).toContain(childGradientClass(id));
    }
  });
});
