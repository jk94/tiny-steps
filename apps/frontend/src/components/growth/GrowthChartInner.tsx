import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { curveMonotoneX } from '@visx/curve';
import { Group } from '@visx/group';
import { scaleLinear } from '@visx/scale';
import { Area, Circle, LinePath } from '@visx/shape';
import { Text } from '@visx/text';
import type { GrowthReferenceResponse } from '../../api/growth-api';
import { formatCalendarDate, formatGrowthValue } from '../../lib/growthFormat';
import { growthMeasureVisuals, type GrowthMeasure } from '../../lib/growthMeasureVisuals';
import type { GrowthPoint } from './growthChartData';
import { GROWTH_CHART_HEIGHT, GROWTH_CHART_MARGIN as MARGIN } from './growthChartGeometry';
import { GrowthChartTooltip } from './GrowthChartTooltip';
import type { GrowthChartCursor } from './useGrowthChartCursor';

const DAYS_PER_MONTH = 30.4375;
const DAYS_PER_YEAR = 365.25;
/** Below this age the x axis is labelled in months, above it in years. */
const MONTH_AXIS_MAX_DAYS = 2 * DAYS_PER_YEAR;
const MONTH_TICK_STEP = 3;
const AXIS_TICK_COUNT = 5;

/** Head-room added above/below the plotted range so markers are never clipped. */
const Y_PADDING_RATIO = 0.08;

const MARKER_RADIUS = 4;
const ACTIVE_MARKER_RADIUS = 7;
const CURSOR_LINE_WIDTH = 1;
const SERIES_LINE_WIDTH = 2;
const BAND_LINE_WIDTH = 1;

/**
 * Opacity of the four stacked reference bands, from the outermost
 * (P3–P15, P85–P97) inwards. The inner bands are darker so the median corridor
 * reads as the "normal" region without any of them competing with the
 * measurement line itself.
 */
const BAND_OPACITIES = [0.1, 0.2, 0.2, 0.1];

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

/** Tick positions in days, labelled in months or years depending on the range. */
function buildAgeTicks(maxAgeDays: number): number[] {
  if (maxAgeDays <= MONTH_AXIS_MAX_DAYS) {
    const ticks: number[] = [];
    for (let month = 0; month * DAYS_PER_MONTH <= maxAgeDays; month += MONTH_TICK_STEP) {
      ticks.push(month * DAYS_PER_MONTH);
    }
    return ticks;
  }
  const ticks: number[] = [];
  for (let year = 0; year * DAYS_PER_YEAR <= maxAgeDays; year += 1) {
    ticks.push(year * DAYS_PER_YEAR);
  }
  return ticks;
}

/**
 * The SVG body of the growth chart: reference bands, the measurement line and
 * the shared cursor overlay. Split out from `GrowthChart` so it receives a
 * concrete `width` from `<ParentSize>` and stays synchronously renderable in
 * tests without a ResizeObserver.
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

  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 0);
  const innerHeight = Math.max(height - MARGIN.top - MARGIN.bottom, 0);

  const bands = useMemo(() => (reference?.available ? reference.curves : []), [reference]);

  const xScale = useMemo(
    () => scaleLinear<number>({ domain: [0, Math.max(maxAgeDays, 1)], range: [0, innerWidth] }),
    [innerWidth, maxAgeDays],
  );

  const yScale = useMemo(() => {
    // The domain has to cover both the child's own values and the visible part
    // of the reference bands, otherwise a child tracking near P97 would push
    // the band off the top of the plot.
    const values: number[] = series.map((point) => point.value);
    for (const curve of bands) {
      for (const point of curve.points) {
        if (point.ageInDays <= maxAgeDays) {
          values.push(point.value);
        }
      }
    }
    if (values.length === 0) {
      return scaleLinear<number>({ domain: [0, 1], range: [innerHeight, 0] });
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * Y_PADDING_RATIO, 1);
    return scaleLinear<number>({
      domain: [min - padding, max + padding],
      range: [innerHeight, 0],
      nice: true,
    });
  }, [bands, innerHeight, maxAgeDays, series]);

  const visibleBands = useMemo(
    () =>
      bands.map((curve) => ({
        ...curve,
        points: curve.points.filter((point) => point.ageInDays <= maxAgeDays),
      })),
    [bands, maxAgeDays],
  );

  const ageTicks = useMemo(() => buildAgeTicks(maxAgeDays), [maxAgeDays]);

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
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={t('growth.chart.figureLabel', { measure: t(visual.labelKey) })}
        // No entrance/draw animation at all — the alternative would need a
        // `prefers-reduced-motion` guard like the ones in styles/animations.css,
        // and a trend chart gains nothing from animating itself in.
        className="overflow-visible"
      >
        <Group left={MARGIN.left} top={MARGIN.top}>
          {/* W-12: the P3–P15 / P15–P50 / P50–P85 / P85–P97 corridors. */}
          {visibleBands.slice(0, -1).map((lower, index) => {
            const upper = visibleBands[index + 1];
            return (
              <Area
                key={`band-${lower.percentile}-${upper.percentile}`}
                data={lower.points}
                x={(point) => xScale(point.ageInDays)}
                y0={(point) => yScale(point.value)}
                y1={(_point, pointIndex) => yScale(upper.points[pointIndex]?.value ?? _point.value)}
                curve={curveMonotoneX}
                fill="var(--color-growth-band)"
                opacity={BAND_OPACITIES[index] ?? BAND_OPACITIES[0]}
                data-testid={`growth-band-${lower.percentile}-${upper.percentile}`}
              />
            );
          })}

          {visibleBands.map((curve) => (
            <g key={`curve-${curve.percentile}`}>
              <LinePath
                data={curve.points}
                x={(point) => xScale(point.ageInDays)}
                y={(point) => yScale(point.value)}
                curve={curveMonotoneX}
                stroke="var(--color-growth-band)"
                strokeWidth={BAND_LINE_WIDTH}
                strokeOpacity={0.5}
                fill="none"
                data-testid={`growth-percentile-line-${curve.percentile}`}
              />
              <Text
                x={innerWidth + 2}
                y={yScale(curve.points.at(-1)?.value ?? 0)}
                verticalAnchor="middle"
                fontSize={9}
                fill="var(--color-muted-foreground)"
              >
                {t('growth.chart.band.label', { percentile: curve.percentile })}
              </Text>
            </g>
          ))}

          <AxisLeft
            scale={yScale}
            numTicks={AXIS_TICK_COUNT}
            stroke="var(--color-border)"
            tickStroke="var(--color-border)"
            tickFormat={(value) => formatGrowthValue(measure, Number(value), i18n.language)}
            tickLabelProps={() => ({
              fill: 'var(--color-muted-foreground)',
              fontSize: 10,
              textAnchor: 'end',
              dx: -4,
              dy: 3,
            })}
          />
          <AxisBottom
            top={innerHeight}
            scale={xScale}
            tickValues={ageTicks}
            stroke="var(--color-border)"
            tickStroke="var(--color-border)"
            tickFormat={(value) => formatAgeTick(Number(value))}
            tickLabelProps={() => ({
              fill: 'var(--color-muted-foreground)',
              fontSize: 10,
              textAnchor: 'middle',
              dy: 2,
            })}
          />

          <LinePath
            data={series}
            x={(point) => xScale(point.ageInDays)}
            y={(point) => yScale(point.value)}
            curve={curveMonotoneX}
            stroke={`var(${visual.colorVar})`}
            strokeWidth={SERIES_LINE_WIDTH}
            fill="none"
            data-testid="growth-series-line"
          />

          {activePoint && (
            <line
              x1={xScale(activePoint.ageInDays)}
              x2={xScale(activePoint.ageInDays)}
              y1={0}
              y2={innerHeight}
              stroke={`var(${visual.colorVar})`}
              strokeWidth={CURSOR_LINE_WIDTH}
              strokeDasharray="3 3"
              data-testid="growth-cursor-line"
            />
          )}

          {series.map((point, index) => (
            <Circle
              key={point.measurementId}
              cx={xScale(point.ageInDays)}
              cy={yScale(point.value)}
              r={index === cursor.activeIndex ? ACTIVE_MARKER_RADIUS : MARKER_RADIUS}
              fill={`var(${visual.colorVar})`}
              stroke="var(--color-background)"
              strokeWidth={1}
              data-testid="growth-series-marker"
              // W-19: the measurement method travels with the point itself, so
              // an assistive technology reading the marker still learns it.
              data-position={point.position ?? undefined}
            />
          ))}

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
        </Group>
      </svg>

      {activePoint && (
        <GrowthChartTooltip
          measure={measure}
          point={activePoint}
          left={MARGIN.left + xScale(activePoint.ageInDays)}
          top={MARGIN.top + yScale(activePoint.value)}
        />
      )}
    </>
  );
}
