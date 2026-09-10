import { describe, expect, it } from 'vitest';
import {
  centimetresToMillimetres,
  gramsToKilograms,
  kilogramsToGrams,
  millimetresToCentimetres,
} from './growthUnits';

describe('growthUnits', () => {
  it.each([
    [6.2, 6200],
    [3.346, 3346],
    [0.2, 200],
    [60, 60000],
  ])('converts %f kg to %i g', (kilograms, grams) => {
    expect(kilogramsToGrams(kilograms)).toBe(grams);
  });

  it.each([
    [42.5, 425],
    [49.9, 499],
    [110, 1100],
  ])('converts %f cm to %i mm', (centimetres, millimetres) => {
    expect(centimetresToMillimetres(centimetres)).toBe(millimetres);
  });

  it('rounds sub-gram precision to a whole gram (W-3: no float storage)', () => {
    expect(kilogramsToGrams(6.2534)).toBe(6253);
    expect(kilogramsToGrams(6.25)).toBe(6250);
    // Half a gram rounds up, the standard Math.round tie rule.
    expect(kilogramsToGrams(6.2005)).toBe(6201);
  });

  it('rounds sub-millimetre precision to a whole millimetre', () => {
    expect(centimetresToMillimetres(42.55)).toBe(426);
  });

  it('returns exact base units unchanged on a round trip', () => {
    for (const grams of [200, 3346, 6400, 60000]) {
      expect(kilogramsToGrams(gramsToKilograms(grams))).toBe(grams);
    }
    for (const millimetres of [200, 499, 870, 1500]) {
      expect(centimetresToMillimetres(millimetresToCentimetres(millimetres))).toBe(millimetres);
    }
  });

  it('converts back to the display unit with a decimal fraction', () => {
    expect(gramsToKilograms(6400)).toBeCloseTo(6.4, 10);
    expect(millimetresToCentimetres(615)).toBeCloseTo(61.5, 10);
  });
});
