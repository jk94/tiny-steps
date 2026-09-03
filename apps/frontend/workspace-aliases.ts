import { fileURLToPath } from 'node:url';

/**
 * Resolves `@baby-tracker/growth-chart-static` to its TypeScript **source**
 * rather than its built `dist/` output.
 *
 * The package publishes a compiled dual (ESM/CJS) build because the backend's
 * `tsc` cannot emit files from outside its own `rootDir`. The frontend has no
 * such constraint: Vite compiles the source directly, so the chart hot-reloads
 * while editing and no spec can ever run against a stale `dist/`. The matching
 * compile-time mapping is `paths` in `tsconfig.app.json`.
 *
 * Shared by `vite.config.ts` and `vitest.config.ts` so the two can't drift.
 */
export const workspaceAliases = {
  '@baby-tracker/growth-chart-static/server': fileURLToPath(
    new URL('../../packages/growth-chart-static/src/server.ts', import.meta.url),
  ),
  '@baby-tracker/growth-chart-static/geometry': fileURLToPath(
    new URL('../../packages/growth-chart-static/src/growthChartGeometry.ts', import.meta.url),
  ),
  '@baby-tracker/growth-chart-static': fileURLToPath(
    new URL('../../packages/growth-chart-static/src/index.ts', import.meta.url),
  ),
};
