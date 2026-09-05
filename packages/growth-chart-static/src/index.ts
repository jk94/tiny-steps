export { GrowthChartStatic } from './GrowthChartStatic.js';
export type {
  GrowthChartColors,
  GrowthChartSeriesPoint,
  GrowthChartStaticProps,
} from './GrowthChartStatic.js';
// `renderGrowthChartSvg` is deliberately NOT re-exported here: it imports
// `react-dom/server`, which rolldown keeps in the browser bundle even when
// unused (~180 kB) because the module is not side-effect-free. It lives behind
// the `./server` subpath instead, so the boundary is explicit rather than a
// tree-shaking accident waiting to regress.
export { clipBandsToAge, growthChartScales } from './growthChartScales.js';
export type {
  GrowthChartBand,
  GrowthChartPoint,
  GrowthChartScale,
  GrowthChartScales,
} from './growthChartScales.js';
export {
  DAYS_PER_MONTH,
  DAYS_PER_YEAR,
  GROWTH_CHART_HEIGHT,
  GROWTH_CHART_MARGIN,
  MONTH_AXIS_MAX_DAYS,
  buildAgeTicks,
  growthChartGeometry,
} from './growthChartGeometry.js';
export type { GrowthChartGeometry } from './growthChartGeometry.js';
