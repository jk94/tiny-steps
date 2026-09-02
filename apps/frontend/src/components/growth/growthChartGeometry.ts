/**
 * Plot geometry shared by the SVG (`GrowthChartInner`) and the cursor
 * (`GrowthChart`, which has to invert a pixel x back into an age).
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
