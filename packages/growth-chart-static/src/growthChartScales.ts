import { scaleLinear } from '@visx/scale';

/** One plotted point: the child's age in days against a value in its base unit. */
export interface GrowthChartPoint {
  ageInDays: number;
  value: number;
}

/** One WHO percentile curve, sampled on a fixed age grid. */
export interface GrowthChartBand {
  percentile: number;
  points: GrowthChartPoint[];
}

export interface GrowthChartScalesInput {
  series: GrowthChartPoint[];
  bands: GrowthChartBand[];
  maxAgeDays: number;
  innerWidth: number;
  innerHeight: number;
}

/**
 * A d3/visx linear scale over numbers. Aliased rather than re-declared as a
 * bare `(value: number) => number` because visx's `AxisLeft`/`AxisBottom` also
 * read the scale's `domain`/`range`/`ticks` methods off it.
 */
export type GrowthChartScale = ReturnType<typeof scaleLinear<number>>;

export interface GrowthChartScales {
  xScale: GrowthChartScale;
  yScale: GrowthChartScale;
}

/** Head-room added above/below the plotted range so markers are never clipped. */
const Y_PADDING_RATIO = 0.08;

/**
 * The chart's two linear scales.
 *
 * Exported separately from the component because the frontend's interactive
 * layer needs them too — the cursor line, the enlarged active marker and the
 * tooltip all have to land on the exact pixel the static body drew the point
 * at, which a second, independently-derived scale would only approximate.
 */
export function growthChartScales({
  series,
  bands,
  maxAgeDays,
  innerWidth,
  innerHeight,
}: GrowthChartScalesInput): GrowthChartScales {
  const xScale = scaleLinear<number>({
    domain: [0, Math.max(maxAgeDays, 1)],
    range: [0, innerWidth],
  });

  // The domain has to cover both the child's own values and the visible part of
  // the reference bands, otherwise a child tracking near P97 would push the
  // band off the top of the plot.
  const values: number[] = series.map((point) => point.value);
  for (const band of bands) {
    for (const point of band.points) {
      if (point.ageInDays <= maxAgeDays) {
        values.push(point.value);
      }
    }
  }

  if (values.length === 0) {
    return {
      xScale,
      yScale: scaleLinear<number>({ domain: [0, 1], range: [innerHeight, 0] }),
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * Y_PADDING_RATIO, 1);

  return {
    xScale,
    yScale: scaleLinear<number>({
      domain: [min - padding, max + padding],
      range: [innerHeight, 0],
      nice: true,
    }),
  };
}

/** Drops the part of every band that lies beyond the chart's right edge. */
export function clipBandsToAge(bands: GrowthChartBand[], maxAgeDays: number): GrowthChartBand[] {
  return bands.map((band) => ({
    ...band,
    points: band.points.filter((point) => point.ageInDays <= maxAgeDays),
  }));
}
