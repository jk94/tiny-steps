# `@baby-tracker/growth-chart-static`

The growth trend chart's SVG body, as a pure, prop-driven React component shared
by two very different consumers:

- **`apps/frontend`** renders it in the browser and layers its interactive parts
  (cursor line, enlarged active marker, `role="slider"` input overlay, tooltip)
  on top through the `overlay` prop — see `components/growth/GrowthChartInner.tsx`.
- **`apps/backend`** renders it to an SVG string in a plain Node process
  (`renderGrowthChartSvg`, exported from the `./server` subpath) and embeds that
  string in the PDF report — see `src/export/report/chart/`.

Sharing the component rather than writing a second chart is the whole point: the
scales, the WHO percentile band stacking, the axis ticks and the margins exist
once, so a report can never disagree with the screen it was generated from. See
[ADR-0014](../../docs/adr/0014-charting-library-visx.md) for the charting-library
choice and [ADR-0015](../../docs/adr/0015-pdf-report-generation.md) for the split.

## Constraints this package must keep

These look arbitrary in a browser and are load-bearing for the PDF:

1. **No i18n, no CSS custom properties, no browser APIs, no interaction.** Every
   label arrives through a `format*` function prop, every color through
   `colors`, and both consumers pass their own. `var(--color-…)` resolves to
   nothing outside a browser.
2. **Text is plain `<text>`, never `@visx/text`'s `<Text>`.** The latter wraps
   its content in a nested `<svg>` for word wrapping, and `@react-pdf/render`
   has no renderer for a nested SVG node — it warns and drops it.
3. **`react-dom/server` stays behind the `./server` subpath.** It is not
   side-effect-free, so a barrel re-export lands ~180 kB of it in the browser
   bundle even when unused.

## Build

The package compiles to a dual ESM/CJS build under `dist/`, driven by
`bun run build` (wired to `prepare`, so `bun install` produces it):

- the **backend** consumes that build, because its `tsc` cannot emit files from
  outside its own `rootDir`;
- the **frontend** ignores it entirely and consumes `src/` directly, via
  `resolve.alias` in `apps/frontend/vite.config.ts` / `vitest.config.ts` and the
  matching `paths` in `tsconfig.app.json` — so the chart hot-reloads while
  editing and no frontend spec can run against a stale `dist/`.

## Tests

This package's specs run inside the frontend's Vitest suite
(`bun run --cwd apps/frontend test`), which already provides the jsdom
environment they need; see the `test.include` entry in
`apps/frontend/vitest.config.ts`.
