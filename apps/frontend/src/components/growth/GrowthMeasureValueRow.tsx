import { useTranslation } from 'react-i18next';
import type { GrowthMeasurementSummary } from '../../api/growth-api';
import { formatGrowthValue } from '../../lib/growthFormat';
import {
  growthMeasureFields,
  growthMeasureVisuals,
  type GrowthMeasure,
} from '../../lib/growthMeasureVisuals';
import { Badge } from '../ui';
import { growthPercentileText, growthZScoreText } from './growthPercentileText';

export interface GrowthMeasureValueRowProps {
  measure: GrowthMeasure;
  measurement: GrowthMeasurementSummary;
  /** Whether to show the recumbent/standing badge for the body measure (W-19). */
  showMeasurementMethod?: boolean;
}

/**
 * One `<li>` describing a single measure of a measurement: icon, labelled
 * value in its display unit, the percentile (or the reason it is unavailable),
 * the z-score, and — for the body measure — the method used.
 *
 * Shared by `GrowthMeasurementList` and `GrowthSummaryCard`, which previously
 * carried near-identical copies of this markup and drifted apart in what they
 * showed. Renders `null` when the measurement does not carry this value (W-2).
 */
export function GrowthMeasureValueRow({
  measure,
  measurement,
  showMeasurementMethod = true,
}: GrowthMeasureValueRowProps) {
  const { t, i18n } = useTranslation();
  const fields = growthMeasureFields[measure];
  const value = measurement[fields.valueField];
  if (value === null) {
    return null;
  }

  const visual = growthMeasureVisuals[measure];
  const percentile = measurement.percentiles[fields.percentileSlot];
  const percentileText = growthPercentileText(t, i18n.language, percentile);
  const zScoreText = growthZScoreText(t, i18n.language, percentile);
  const method =
    fields.isBodyMeasure && showMeasurementMethod
      ? measurement.effectiveLengthMeasurementPosition
      : null;

  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      <visual.Icon
        aria-hidden="true"
        className="h-4 w-4"
        style={{ color: `var(${visual.colorVar})` }}
      />
      <span className="text-foreground">
        {t(visual.labelKey)}: {formatGrowthValue(measure, value, i18n.language)} {t(visual.unitKey)}
      </span>
      {percentileText && <Badge variant="default">{percentileText}</Badge>}
      {/* W-9: the z-score is shown next to the percentile, not instead of it. */}
      {zScoreText && <span className="text-xs text-muted-foreground">{zScoreText}</span>}
      {method && (
        <Badge variant="default">
          {method === 'LYING'
            ? t('growth.chart.position.lying')
            : t('growth.chart.position.standing')}
        </Badge>
      )}
    </li>
  );
}
