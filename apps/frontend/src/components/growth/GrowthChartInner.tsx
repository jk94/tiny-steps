import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DAYS_PER_MONTH,
  DAYS_PER_YEAR,
  GROWTH_CHART_HEIGHT,
  GrowthChartStatic,
  MONTH_AXIS_MAX_DAYS,
  growthChartGeometry,
  growthChartScales,
  type GrowthChartColors,
  type GrowthChartSeriesPoint,
} from '@baby-tracker/growth-chart-static';
import type { GrowthReferenceResponse } from '../../api/growth-api';
import { formatCalendarDate } from '../../lib/calendarDate';
import { formatGrowthValue } from '../../lib/growthFormat';
import { growthMeasureVisuals, type GrowthMeasure } from '../../lib/growthMeasureVisuals';
import type { GrowthPoint } from './growthChartData';
import { GrowthChartTooltip } from './GrowthChartTooltip';
import type { GrowthChartCursor } from './useGrowthChartCursor';

const ACTIVE_MARKER_RADIUS = 7;
const CURSOR_LINE_WIDTH = 1;

export interface GrowthChartInnerProps {
  width: number;
  height?: number;
  measure: GrowthMeasure;
  series: GrowthPoint[];
  reference: GrowthReferenceResponse | null;
  /** Right edge of the x axis, in days — the child's current age. */
  maxAgeDays: number;
  cursor: GrowthChartCursor;
}

/**
 * The interactive growth chart: the shared static SVG body from
 * `@baby-tracker/growth-chart-static` with this app's cursor, active marker and
 * input overlay layered on top of it.
 *
 * The body is shared with the backend's PDF report (ADR-0015), so everything
 * the report cannot have — translated labels, CSS custom properties, pointer
 * and keyboard handling — is supplied from here as props rather than baked into
 * the chart. Split out from `GrowthChart` so it receives a concrete `width`
 * from `useParentSize` and stays synchronously renderable in tests without a
 * ResizeObserver.
 */
export function GrowthChartInner({
  width,
  height = GROWTH_CHART_HEIGHT,
  measure,
  series,
  reference,
  maxAgeDays,
  cursor,
}: GrowthChartInnerProps) {
  const { t, i18n } = useTranslation();
  const visual = growthMeasureVisuals[measure];

  const { margin, innerWidth, innerHeight } = growthChartGeometry(width, height);

  const bands = useMemo(() => (reference?.available ? reference.curves : []), [reference]);

  const chartSeries = useMemo<GrowthChartSeriesPoint[]>(
    () =>
      series.map((point) => ({
        id: point.measurementId,
        ageInDays: point.ageInDays,
        value: point.value,
        position: point.position,
      })),
    [series],
  );

  // The overlay has to land on the exact pixels the static body drew, so it
  // reuses the body's own scale factory rather than deriving a second one.
  const { xScale, yScale } = useMemo(
    () => growthChartScales({ series: chartSeries, bands, maxAgeDays, innerWidth, innerHeight }),
    [bands, chartSeries, innerHeight, innerWidth, maxAgeDays],
  );

  const colors = useMemo<GrowthChartColors>(
    () => ({
      series: `var(${visual.colorVar})`,
      band: 'var(--color-growth-band)',
      axis: 'var(--color-border)',
      label: 'var(--color-muted-foreground)',
      markerHalo: 'var(--color-background)',
    }),
    [visual.colorVar],
  );

  if (innerWidth <= 0 || innerHeight <= 0) {
    return null;
  }

  const formatAgeTick = (ageInDays: number): string =>
    maxAgeDays <= MONTH_AXIS_MAX_DAYS
      ? t('growth.chart.axis.months', { count: Math.round(ageInDays / DAYS_PER_MONTH) })
      : t('growth.chart.axis.years', { count: Math.round(ageInDays / DAYS_PER_YEAR) });

  const activePoint = cursor.activePoint;

  return (
    <>
      <GrowthChartStatic
        width={width}
        height={height}
        series={chartSeries}
        bands={bands}
        maxAgeDays={maxAgeDays}
        colors={colors}
        formatValue={(value) => formatGrowthValue(measure, value, i18n.language)}
        formatAgeTick={formatAgeTick}
        formatBandLabel={(percentile) => t('growth.chart.band.label', { percentile })}
        ariaLabel={t('growth.chart.figureLabel', { measure: t(visual.labelKey) })}
        // No entrance/draw animation at all — the alternative would need a
        // `prefers-reduced-motion` guard like the ones in styles/animations.css,
        // and a trend chart gains nothing from animating itself in.
        className="overflow-visible"
        overlay={
          <>
            {activePoint && (
              <>
                <line
                  x1={xScale(activePoint.ageInDays)}
                  x2={xScale(activePoint.ageInDays)}
                  y1={0}
                  y2={innerHeight}
                  stroke={colors.series}
                  strokeWidth={CURSOR_LINE_WIDTH}
                  strokeDasharray="3 3"
                  data-testid="growth-cursor-line"
                />
                <circle
                  cx={xScale(activePoint.ageInDays)}
                  cy={yScale(activePoint.value)}
                  r={ACTIVE_MARKER_RADIUS}
                  fill={colors.series}
                  stroke={colors.markerHalo}
                  strokeWidth={1}
                  data-testid="growth-active-marker"
                />
              </>
            )}

            {/*
              One transparent overlay carries every input modality (W-13/W-14):
              pointer hover, touch long-press scrubbing and arrow-key stepping.

              `touchAction: 'none'` is set unconditionally, not just while
              scrubbing: the browser decides whether a gesture is a scroll before
              the long-press timer could ever fire, so a conditional value arrives
              too late and the scrub never starts on a real device. The accepted
              cost is that a swipe starting inside the plot area does not scroll
              the page — every other part of the page still does.
            */}
            <rect
              width={innerWidth}
              height={innerHeight}
              fill="transparent"
              tabIndex={0}
              role="slider"
              aria-label={t('growth.chart.ariaLabel', { measure: t(visual.labelKey) })}
              aria-valuemin={0}
              aria-valuemax={Math.max(series.length - 1, 0)}
              aria-valuenow={cursor.activeIndex ?? 0}
              aria-valuetext={
                activePoint
                  ? t('growth.chart.valueText', {
                      date: formatCalendarDate(activePoint.measuredAt, i18n.language),
                      value: formatGrowthValue(measure, activePoint.value, i18n.language),
                      unit: t(visual.unitKey),
                    })
                  : t('growth.chart.valueTextEmpty')
              }
              className="cursor-crosshair outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
              style={{ touchAction: 'none' }}
              data-testid="growth-chart-overlay"
              onKeyDown={cursor.keyDownHandler}
              {...cursor.pointerHandlers}
            />
          </>
        }
      />

      {activePoint && (
        <GrowthChartTooltip
          measure={measure}
          point={activePoint}
          left={margin.left + xScale(activePoint.ageInDays)}
          top={margin.top + yScale(activePoint.value)}
        />
      )}
    </>
  );
}
