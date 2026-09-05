import type { ReactNode } from 'react';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { curveMonotoneX } from '@visx/curve';
import { Group } from '@visx/group';
import { Area, Circle, LinePath } from '@visx/shape';
import { GROWTH_CHART_HEIGHT, buildAgeTicks, growthChartGeometry } from './growthChartGeometry.js';
import {
  clipBandsToAge,
  growthChartScales,
  type GrowthChartBand,
  type GrowthChartPoint,
} from './growthChartScales.js';

/** A plotted measurement, plus the bits the frontend needs to key/annotate it. */
export interface GrowthChartSeriesPoint extends GrowthChartPoint {
  /** Stable React key — the frontend passes the measurement id. */
  id: string;
  /**
   * The measurement method attributed to this point (W-19), emitted as a
   * `data-position` attribute. Only meaningful for the body measure.
   */
  position?: string | null;
}

/**
 * Every color the chart draws with, as literal strings.
 *
 * Deliberately *not* CSS custom-property references: the same component has to
 * render into a PDF, where `var(--color-…)` resolves to nothing. The frontend
 * therefore passes `var(…)` strings and the report passes hex values from
 * `report-tokens.generated.ts` — both from the same design tokens.
 */
export interface GrowthChartColors {
  /** The child's own measurement line and markers. */
  series: string;
  /** The WHO percentile bands and their outline curves. */
  band: string;
  /** Axis lines and tick marks. */
  axis: string;
  /** Axis tick labels and the P3…P97 band labels. */
  label: string;
  /** Halo around a marker, so a marker on a dark band stays visible. */
  markerHalo: string;
}

export interface GrowthChartStaticProps {
  width: number;
  height?: number;
  series: GrowthChartSeriesPoint[];
  /** Empty renders the series without bands (W-11: no sex, or age off-scale). */
  bands: GrowthChartBand[];
  /** Right edge of the age axis, in days — normally the child's current age. */
  maxAgeDays: number;
  colors: GrowthChartColors;
  /** Formats a y-axis tick from a value in its base unit (grams/millimetres). */
  formatValue: (valueInBaseUnit: number) => string;
  /** Formats an x-axis tick from an age in days ("6 Monate", "2 Jahre"). */
  formatAgeTick: (ageInDays: number) => string;
  /** Formats a band's right-edge label from its percentile ("P97"). */
  formatBandLabel: (percentile: number) => string;
  /** Sets `role="img"` on the root `<svg>`. Omitted for the PDF report. */
  ariaLabel?: string;
  className?: string;
  /**
   * Rendered last, inside the margin-translated group, so it shares the plot's
   * coordinate system. The frontend puts its cursor line, enlarged active
   * marker and input overlay here; the report passes nothing.
   */
  overlay?: ReactNode;
}

/**
 * Opacity of the four stacked reference bands, from the outermost
 * (P3–P15, P85–P97) inwards. The inner bands are darker so the median corridor
 * reads as the "normal" region without any of them competing with the
 * measurement line itself.
 */
const BAND_OPACITIES = [0.1, 0.2, 0.2, 0.1];

const MARKER_RADIUS = 4;
const SERIES_LINE_WIDTH = 2;
const BAND_LINE_WIDTH = 1;
const AXIS_TICK_COUNT = 5;
const BAND_LABEL_FONT_SIZE = 9;
const AXIS_LABEL_FONT_SIZE = 10;
/** Half a cap height, to centre a label on its tick without `dominantBaseline`. */
const LABEL_BASELINE_OFFSET = 3;

/**
 * The growth chart's SVG body: WHO percentile bands, the measurement series and
 * the two axes. Pure and prop-driven — no i18n, no CSS variables, no browser
 * APIs, no interaction — so the identical component renders in the browser and
 * in the backend Node process that builds the PDF report (see ADR-0015).
 *
 * Two constraints follow from the PDF side and apply even though they look
 * arbitrary in the browser:
 *
 * 1. Text is plain `<text>`, never `@visx/text`'s `<Text>`. The latter wraps its
 *    content in a nested `<svg>` for word wrapping, and `@react-pdf/render` has
 *    no renderer for a nested SVG node — it warns and drops it.
 * 2. Every color arrives as a prop. See `GrowthChartColors`.
 */
export function GrowthChartStatic({
  width,
  height = GROWTH_CHART_HEIGHT,
  series,
  bands,
  maxAgeDays,
  colors,
  formatValue,
  formatAgeTick,
  formatBandLabel,
  ariaLabel,
  className,
  overlay,
}: GrowthChartStaticProps) {
  const { margin, innerWidth, innerHeight } = growthChartGeometry(width, height);

  if (innerWidth <= 0 || innerHeight <= 0) {
    return null;
  }

  const visibleBands = clipBandsToAge(bands, maxAgeDays);
  const { xScale, yScale } = growthChartScales({
    series,
    bands,
    maxAgeDays,
    innerWidth,
    innerHeight,
  });
  const ageTicks = buildAgeTicks(maxAgeDays);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      {...(ariaLabel ? { role: 'img', 'aria-label': ariaLabel } : {})}
      className={className}
    >
      <Group left={margin.left} top={margin.top}>
        {/* W-12: the P3–P15 / P15–P50 / P50–P85 / P85–P97 corridors. */}
        {visibleBands.slice(0, -1).map((lower, index) => {
          const upper = visibleBands[index + 1];
          return (
            <Area
              key={`band-${lower.percentile}-${upper.percentile}`}
              data={lower.points}
              x={(point) => xScale(point.ageInDays)}
              y0={(point) => yScale(point.value)}
              y1={(point, pointIndex) => yScale(upper.points[pointIndex]?.value ?? point.value)}
              curve={curveMonotoneX}
              fill={colors.band}
              opacity={BAND_OPACITIES[index] ?? BAND_OPACITIES[0]}
              data-testid={`growth-band-${lower.percentile}-${upper.percentile}`}
            />
          );
        })}

        {visibleBands.map((band) => (
          <g key={`curve-${band.percentile}`}>
            <LinePath
              data={band.points}
              x={(point) => xScale(point.ageInDays)}
              y={(point) => yScale(point.value)}
              curve={curveMonotoneX}
              stroke={colors.band}
              strokeWidth={BAND_LINE_WIDTH}
              strokeOpacity={0.5}
              fill="none"
              data-testid={`growth-percentile-line-${band.percentile}`}
            />
            <text
              x={innerWidth + 2}
              y={yScale(band.points.at(-1)?.value ?? 0) + LABEL_BASELINE_OFFSET}
              fontSize={BAND_LABEL_FONT_SIZE}
              fill={colors.label}
              data-testid={`growth-band-label-${band.percentile}`}
            >
              {formatBandLabel(band.percentile)}
            </text>
          </g>
        ))}

        <AxisLeft
          scale={yScale}
          numTicks={AXIS_TICK_COUNT}
          stroke={colors.axis}
          tickStroke={colors.axis}
          tickFormat={(value) => formatValue(Number(value))}
          tickComponent={({ x, y, formattedValue }) => (
            <text
              x={x - 4}
              y={y + LABEL_BASELINE_OFFSET}
              fontSize={AXIS_LABEL_FONT_SIZE}
              fill={colors.label}
              textAnchor="end"
              data-testid="growth-axis-tick-y"
            >
              {formattedValue}
            </text>
          )}
        />
        <AxisBottom
          top={innerHeight}
          scale={xScale}
          tickValues={ageTicks}
          stroke={colors.axis}
          tickStroke={colors.axis}
          tickFormat={(value) => formatAgeTick(Number(value))}
          tickComponent={({ x, y, formattedValue }) => (
            <text
              x={x}
              y={y + 2}
              fontSize={AXIS_LABEL_FONT_SIZE}
              fill={colors.label}
              textAnchor="middle"
              data-testid="growth-axis-tick-x"
            >
              {formattedValue}
            </text>
          )}
        />

        <LinePath
          data={series}
          x={(point) => xScale(point.ageInDays)}
          y={(point) => yScale(point.value)}
          curve={curveMonotoneX}
          stroke={colors.series}
          strokeWidth={SERIES_LINE_WIDTH}
          fill="none"
          data-testid="growth-series-line"
        />

        {series.map((point) => (
          <Circle
            key={point.id}
            cx={xScale(point.ageInDays)}
            cy={yScale(point.value)}
            r={MARKER_RADIUS}
            fill={colors.series}
            stroke={colors.markerHalo}
            strokeWidth={1}
            data-testid="growth-series-marker"
            // W-19: the measurement method travels with the point itself, so an
            // assistive technology reading the marker still learns it.
            data-position={point.position ?? undefined}
          />
        ))}

        {overlay}
      </Group>
    </svg>
  );
}
