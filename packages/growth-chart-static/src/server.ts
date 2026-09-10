/**
 * Server-only entry point: everything that needs `react-dom/server`.
 *
 * Kept out of the package's main barrel so a browser bundle importing the chart
 * component can never drag the server renderer in with it.
 */
export { renderGrowthChartSvg } from './renderGrowthChartSvg.js';
export type { GrowthChartStaticProps } from './GrowthChartStatic.js';
