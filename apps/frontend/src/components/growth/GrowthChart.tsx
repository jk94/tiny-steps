import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParentSize } from '@visx/responsive';
import type { GrowthReferenceResponse } from '../../api/growth-api';
import { formatGrowthValue } from '../../lib/growthFormat';
import { growthMeasureVisuals, type GrowthMeasure } from '../../lib/growthMeasureVisuals';
import type { GrowthPoint } from './growthChartData';
import { GROWTH_CHART_HEIGHT, growthChartGeometry } from './growthChartGeometry';
import { GrowthChartInner } from './GrowthChartInner';
import { growthPercentileText } from './growthPercentileText';
import { useGrowthChartCursor } from './useGrowthChartCursor';

export interface GrowthChartProps {
  measure: GrowthMeasure;
  series: GrowthPoint[];
  /** `null` or `available: false` renders the series without bands (W-11). */
  reference: GrowthReferenceResponse | null;
  /** Right edge of the age axis, in days — normally the child's current age. */
  maxAgeDays: number;
  /**
   * Fixed width instead of measuring the container. Used by tests, where jsdom
   * has no layout and `ResizeObserver` would always report 0.
   */
  fixedWidth?: number;
}

/**
 * The growth trend chart (W-12/W-13/W-14).
 *
 * Default-exported because it is the `React.lazy()` target: visx and its d3
 * dependencies are the largest library in this app and are only needed on the
 * growth page, so they live in their own async chunk (see ADR-0014).
 *
 * This component owns the cursor state and the visually-hidden `aria-live`
 * readout; `GrowthChartInner` owns the SVG. That split is what lets one cursor
 * drive the pointer tooltip *and* the screen-reader announcement — a keyboard
 * user gets the identical date/value/percentile a mouse user sees.
 */
export default function GrowthChart({
  measure,
  series,
  reference,
  maxAgeDays,
  fixedWidth,
}: GrowthChartProps) {
  const { t, i18n } = useTranslation();
  const visual = growthMeasureVisuals[measure];
  const { parentRef, width: measuredWidth } = useParentSize({ debounceTime: 0 });
  const width = fixedWidth ?? measuredWidth;

  // The cursor has to translate a pixel x back into an age, which needs the
  // same geometry the SVG uses — hence the shared `growthChartGeometry`
  // rather than a second, drift-prone copy of the margins.
  const ageFromX = useCallback(
    (x: number) => {
      const { margin, innerWidth } = growthChartGeometry(width);
      if (innerWidth <= 0) {
        return 0;
      }
      return ((x - margin.left) / innerWidth) * Math.max(maxAgeDays, 1);
    },
    [maxAgeDays, width],
  );

  const cursor = useGrowthChartCursor({ series, ageFromX });

  const liveMessage = useMemo(() => {
    const point = cursor.activePoint;
    if (!point) {
      return '';
    }
    const values = {
      date: new Date(point.measuredAt).toLocaleDateString(i18n.language),
      measure: t(visual.labelKey),
      value: formatGrowthValue(measure, point.value, i18n.language),
      unit: t(visual.unitKey),
    };
    const percentileText = growthPercentileText(t, i18n.language, point.percentile);
    return percentileText
      ? t('growth.chart.liveReadout', { ...values, percentile: percentileText })
      : t('growth.chart.liveReadoutNoPercentile', values);
  }, [cursor.activePoint, i18n.language, measure, t, visual.labelKey, visual.unitKey]);

  return (
    <div className="flex flex-col gap-1">
      <div ref={parentRef} className="relative w-full" style={{ height: GROWTH_CHART_HEIGHT }}>
        {width > 0 && (
          <GrowthChartInner
            width={width}
            measure={measure}
            series={series}
            reference={reference}
            maxAgeDays={maxAgeDays}
            cursor={cursor}
          />
        )}
      </div>

      <p className="text-xs text-muted-foreground">{t('growth.chart.keyboardHint')}</p>

      {/*
        W-14: the active value as text. Announced no matter which input moved
        the cursor, so keyboard and touch users get the readout the tooltip
        shows to a mouse user.
      */}
      <div className="sr-only" role="status" aria-live="polite" data-testid="growth-chart-readout">
        {liveMessage}
      </div>
    </div>
  );
}
