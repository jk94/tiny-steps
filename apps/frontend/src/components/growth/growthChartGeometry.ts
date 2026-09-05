/**
 * Re-export of the plot geometry, which now lives in
 * `@baby-tracker/growth-chart-static` so the backend's PDF report renders the
 * chart with the exact same margins (see ADR-0015). Kept as a module here so
 * the existing frontend imports keep working and there is still one obvious
 * place to look for "where do the chart margins come from".
 */
export {
  GROWTH_CHART_HEIGHT,
  GROWTH_CHART_MARGIN,
  growthChartGeometry,
} from '@baby-tracker/growth-chart-static/geometry';
export type { GrowthChartGeometry } from '@baby-tracker/growth-chart-static/geometry';
