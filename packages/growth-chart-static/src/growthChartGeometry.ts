/**
 * Plot geometry shared by every consumer of the growth chart: the static SVG
 * body (`GrowthChartStatic`), the frontend's interactive overlay (which has to
 * invert a pixel x back into an age) and the backend's PDF report.
 *
 * Kept in its own module rather than exported from the component file: two
 * copies of the margins would drift, and a non-component export next to a
 * component breaks React Fast Refresh.
 */

/** Left margin fits a "110.0" tick label; right margin fits the "P97" label. */
export const GROWTH_CHART_MARGIN = { top: 12, right: 34, bottom: 32, left: 44 } as const;

export const GROWTH_CHART_HEIGHT = 288;

export interface GrowthChartGeometry {
  margin: typeof GROWTH_CHART_MARGIN;
  innerWidth: number;
  innerHeight: number;
}

export function growthChartGeometry(
  width: number,
  height: number = GROWTH_CHART_HEIGHT,
): GrowthChartGeometry {
  return {
    margin: GROWTH_CHART_MARGIN,
    innerWidth: Math.max(width - GROWTH_CHART_MARGIN.left - GROWTH_CHART_MARGIN.right, 0),
    innerHeight: Math.max(height - GROWTH_CHART_MARGIN.top - GROWTH_CHART_MARGIN.bottom, 0),
  };
}

const DAYS_PER_MONTH = 30.4375;
const DAYS_PER_YEAR = 365.25;

/** Below this age the x axis is labelled in months, above it in years. */
export const MONTH_AXIS_MAX_DAYS = 2 * DAYS_PER_YEAR;

const MONTH_TICK_STEP = 3;

export { DAYS_PER_MONTH, DAYS_PER_YEAR };

/**
 * Tick positions in days. Callers label them in months or years — the same
 * `maxAgeDays <= MONTH_AXIS_MAX_DAYS` test decides both, so the step size and
 * the unit in the label can never disagree.
 */
export function buildAgeTicks(maxAgeDays: number): number[] {
  const ticks: number[] = [];
  if (maxAgeDays <= MONTH_AXIS_MAX_DAYS) {
    for (let month = 0; month * DAYS_PER_MONTH <= maxAgeDays; month += MONTH_TICK_STEP) {
      ticks.push(month * DAYS_PER_MONTH);
    }
    return ticks;
  }
  for (let year = 0; year * DAYS_PER_YEAR <= maxAgeDays; year += 1) {
    ticks.push(year * DAYS_PER_YEAR);
  }
  return ticks;
}
