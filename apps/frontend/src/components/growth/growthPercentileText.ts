import type { TFunction } from 'i18next';
import type { GrowthPercentile } from '../../api/growth-api';
import { formatPercentile } from '../../lib/growthFormat';

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
  return percentile.reason === 'CHILD_SEX_NOT_SET'
    ? t('growth.percentile.unavailable.sexUnknown')
    : t('growth.percentile.unavailable.ageOutOfRange');
}
