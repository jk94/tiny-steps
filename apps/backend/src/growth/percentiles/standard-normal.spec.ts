import { cumulativeStandardNormal } from './standard-normal';

// The A&S 26.2.17 approximation is documented as accurate to < 7.5e-8; 1e-6
// leaves room without letting a real regression through.
const TOLERANCE = 1e-6;

describe('cumulativeStandardNormal', () => {
  it.each([
    ['the median', 0, 0.5],
    ['the 97.5th percentile z-score', 1.959964, 0.975],
    ['the 2.5th percentile z-score', -1.959964, 0.025],
    ['the 90th percentile z-score', 1.281552, 0.9],
    ['the 97th percentile z-score', 1.880794, 0.97],
    ['the 3rd percentile z-score', -1.880794, 0.03],
  ])('maps %s to its published probability', (_label, z, expected) => {
    expect(cumulativeStandardNormal(z)).toBeCloseTo(expected, 6);
  });

  it('is symmetric about zero', () => {
    for (const z of [0.1, 0.5, 1, 1.5, 2, 3, 4.5]) {
      expect(cumulativeStandardNormal(z) + cumulativeStandardNormal(-z)).toBeCloseTo(1, 6);
    }
  });

  it('stays inside [0, 1] for extreme z-scores', () => {
    expect(cumulativeStandardNormal(-40)).toBeGreaterThanOrEqual(0);
    expect(cumulativeStandardNormal(-40)).toBeLessThan(TOLERANCE);
    expect(cumulativeStandardNormal(40)).toBeLessThanOrEqual(1);
    expect(cumulativeStandardNormal(40)).toBeGreaterThan(1 - TOLERANCE);
  });

  it('increases monotonically', () => {
    let previous = cumulativeStandardNormal(-5);
    for (let z = -5 + 0.05; z <= 5; z += 0.05) {
      const current = cumulativeStandardNormal(z);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
  });
});
