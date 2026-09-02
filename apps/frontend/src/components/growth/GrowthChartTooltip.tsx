import { useTranslation } from 'react-i18next';
import { TooltipWithBounds } from '@visx/tooltip';
import { formatGrowthValue } from '../../lib/growthFormat';
import { growthMeasureVisuals, type GrowthMeasure } from '../../lib/growthMeasureVisuals';
import type { GrowthPoint } from './growthChartData';
import { growthPercentileText } from './growthPercentileText';

export interface GrowthChartTooltipProps {
  measure: GrowthMeasure;
  point: GrowthPoint;
  /** Pixel position of the active marker inside the chart's relative wrapper. */
  left: number;
  top: number;
}

/**
 * The inspection readout for the active point (W-13): date, value and
 * percentile — or, when the percentile could not be computed, the reason
 * (W-10/W-11) rather than a blank line.
 *
 * `TooltipWithBounds` flips the box near the plot edges so the readout for the
 * newest measurement (always at the right edge) stays on screen.
 */
export function GrowthChartTooltip({ measure, point, left, top }: GrowthChartTooltipProps) {
  const { t, i18n } = useTranslation();
  const visual = growthMeasureVisuals[measure];
  const percentileText = growthPercentileText(t, i18n.language, point.percentile);

  return (
    <TooltipWithBounds
      key={point.measurementId}
      left={left}
      top={top}
      unstyled
      applyPositionStyle
      className="pointer-events-none z-10 rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
    >
      <div data-testid="growth-chart-tooltip" className="flex flex-col gap-0.5">
        <span className="font-medium">
          {new Date(point.measuredAt).toLocaleDateString(i18n.language)}
        </span>
        <span>
          {formatGrowthValue(measure, point.value, i18n.language)} {t(visual.unitKey)}
        </span>
        {percentileText && <span className="text-muted-foreground">{percentileText}</span>}
        {point.position && (
          <span className="text-muted-foreground">
            {point.position === 'LYING'
              ? t('growth.chart.position.lying')
              : t('growth.chart.position.standing')}
          </span>
        )}
      </div>
    </TooltipWithBounds>
  );
}
