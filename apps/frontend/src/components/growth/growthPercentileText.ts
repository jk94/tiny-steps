import type { TFunction } from 'i18next';
import type { GrowthPercentile } from '../../api/growth-api';
import { formatPercentile, formatZScore } from '../../lib/growthFormat';

/**
 * Human-readable text for a percentile outcome.
 *
 * Never returns an empty string for an `UNAVAILABLE` outcome: W-10/W-11 both
 * require the *reason* to be visible rather than the percentile silently
 * disappearing, and this is the single place that mapping is made.
 */
export function growthPercentileText(
  t: TFunction,
  language: string,
  percentile: GrowthPercentile | null,
): string | null {
  if (percentile === null) {
    return null;
  }
  if (percentile.status === 'COMPUTED') {
    return t('growth.percentile.value', {
      value: formatPercentile(percentile.percentile, language),
    });
  }
  switch (percentile.reason) {
    case 'CHILD_SEX_NOT_SET':
      return t('growth.percentile.unavailable.sexUnknown');
    case 'AGE_BELOW_REFERENCE_RANGE':
      return t('growth.percentile.unavailable.ageBelowRange');
    case 'AGE_ABOVE_REFERENCE_RANGE':
      return t('growth.percentile.unavailable.ageOutOfRange');
  }
}

/**
 * The z-score behind a computed percentile, or `null` when there is none.
 *
 * W-9 asks for the percentile **and** the z-score to be shown: the percentile
 * is what a parent reads, the z-score is what a pediatrician asks for, and the
 * two are not interchangeable at the tails (the 1st and the 3rd percentile are
 * visually adjacent but clinically far apart).
 */
export function growthZScoreText(
  t: TFunction,
  language: string,
  percentile: GrowthPercentile | null,
): string | null {
  if (percentile === null || percentile.status !== 'COMPUTED') {
    return null;
  }
  return t('growth.percentile.zScore', { value: formatZScore(percentile.zScore, language) });
}
