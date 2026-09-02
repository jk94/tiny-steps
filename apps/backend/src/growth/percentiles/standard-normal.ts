/**
 * Cumulative distribution function of the standard normal distribution.
 *
 * Needed to turn a WHO LMS z-score into a percentile (W-9). Implemented
 * locally rather than pulled in as a dependency: it is ~15 lines of arithmetic
 * with a well-published, closed-form approximation, and the growth percentile
 * computation must stay a pure, dependency-free function that is trivially
 * testable against published reference values.
 */

/**
 * Zelen & Severo's rational approximation of Phi, Abramowitz & Stegun formula
 * 26.2.17. Absolute error < 7.5e-8 over the whole real line, which is several
 * orders of magnitude finer than the single-percentile resolution the UI
 * displays.
 */
const A1 = 0.31938153;
const A2 = -0.356563782;
const A3 = 1.781477937;
const A4 = -1.821255978;
const A5 = 1.330274429;
const P = 0.2316419;
const INVERSE_SQRT_TWO_PI = 0.3989422804014327;

/**
 * Returns Phi(z), the probability that a standard normal variate is at most
 * `z`, in the range [0, 1].
 *
 * There is deliberately no inverse (probit) function here: the reference-band
 * endpoints are fixed, named z-scores (see `WHO_PERCENTILE_Z_SCORES`), so
 * nothing in this app ever needs to map a percentile back to a z-score
 * numerically.
 */
export function cumulativeStandardNormal(z: number): number {
  // The approximation is defined for z >= 0; the negative half is obtained
  // from the symmetry Phi(-z) = 1 - Phi(z).
  const absoluteZ = Math.abs(z);
  const t = 1 / (1 + P * absoluteZ);
  const density = INVERSE_SQRT_TWO_PI * Math.exp((-absoluteZ * absoluteZ) / 2);
  const polynomial = t * (A1 + t * (A2 + t * (A3 + t * (A4 + t * A5))));
  const upperTail = density * polynomial;

  return z >= 0 ? 1 - upperTail : upperTail;
}
