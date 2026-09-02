# ADR-0014: visx as the charting library for the growth trend

## Status

Accepted

## Context

Roadmap Phase 7.1 ("Wachstumstracking") is the first feature in this app that needs a real chart.
The requirements are unusually specific for what is nominally "a line chart":

- **W-12** — plot the child's measurements over their age *and* render the WHO percentile bands
  (at least P3/P15/P50/P85/P97) as a stacked background, with the length↔height reference switching
  at 24 months.
- **W-13** — a point must be inspectable: pointer hover, and on touch a **long-press** that then
  scrubs a cursor along the time axis.
- **W-14** — the chart must be fully operable **without a pointer**: focusable, arrow keys move
  point-to-point, and the active value is announced through an `aria-live` region as text.
- Phase 6 M4's contrast/focus rules apply, and everything must be styled from the design tokens in
  `design-system/tokens/color.json` — i.e. from CSS custom properties that flip with
  `prefers-color-scheme`, not from hard-coded hex values passed as props.

The repo had no charting dependency at all before this phase, so this is a greenfield choice rather
than a migration.

## Decision

Use **[visx](https://airbnb.io/visx/)** (`@visx/scale`, `shape`, `axis`, `group`, `text`, `curve`,
`tooltip`, `event`, `responsive`, all pinned at `4.0.0`) and assemble the chart from its primitives,
rather than adopting an all-in-one charting component.

Concretely:

- visx supplies **scales, path/area generators, axes, tooltip positioning and pointer↔SVG coordinate
  translation**. It does *not* own the chart's structure: `GrowthChartInner` renders plain SVG
  elements we control, so every stroke and fill is `var(--color-growth-…)` and inherits the token
  system's light/dark pairs for free.
- The interaction layer is **ours**, in one hook (`useGrowthChartCursor`). A single cursor state is
  driven by pointer hover, a touch long-press (`LONG_PRESS_MS = 400`, `touch-action: none` only
  while scrubbing so an ordinary swipe still scrolls the page) and arrow keys, so the tooltip, the
  highlighted marker and the `aria-live` readout can never disagree about which point is active.
- Accessibility is expressed on a transparent overlay `<rect>` carrying `role="slider"`,
  `tabIndex={0}`, `aria-valuemin/max/now/text` and a token-bound focus ring, which is what makes
  W-14 achievable at all.
- The whole chart is a **`React.lazy()` chunk** (`GrowthChart.tsx` is default-exported for exactly
  that reason) behind a `<Suspense>` skeleton on the growth page.
- **No entrance or draw animation.** Rather than adding one and guarding it with
  `prefers-reduced-motion` (as `styles/animations.css` does elsewhere), the chart simply does not
  animate — a trend chart gains nothing from drawing itself in.

## Alternatives considered

**Recharts** — the obvious default. Rejected on three counts. Theming: colors are passed as props,
so token-driven light/dark theming means threading resolved CSS-variable values through React
instead of letting the cascade do it, and its internal defaults (grid, legend, tooltip chrome) have
to be overridden rather than simply not rendered. Accessibility: its keyboard/ARIA story is thin —
there is no built-in "arrow keys step through data points with an announced value", so W-14 would
have meant fighting the component's own event handling to bolt a custom cursor on top of an
abstraction that assumes it owns interaction. Bundle: it pulls in a large baseline (its own
d3 subset plus `react-smooth` for animations we explicitly do not want) for a chart we would then
mostly override.

**Chart.js (incl. `react-chartjs-2`)** — rejected outright on accessibility. It renders to
`<canvas>`, so there is no DOM for a screen reader or the keyboard to address; W-13's cursor and
W-14's arrow-key navigation would have to be reimplemented against a bitmap, and the `aria-live`
readout would describe something the user cannot focus. Canvas also puts the chart outside the CSS
token system entirely.

**nivo** — rejected on bundle size and opinionated theming: it ships a full theme object and
`react-spring`-based animation by default, which is a lot of machinery to install in order to switch
most of it off, and its theming layer would sit awkwardly between our tokens and the rendered SVG.

**Hand-rolled SVG with no library** — genuinely considered, since the chart is "just" a line plus
some areas. Rejected because the parts we would have had to write are precisely the parts that are
easy to get subtly wrong: the linear scales, `curveMonotoneX` (a monotone interpolation that does
not overshoot between points — important when drawing percentile bands that must never cross), axis
tick generation, and edge-aware tooltip placement. visx supplies exactly those and nothing else,
which is the reason it was preferred over a component library in the first place.

## Bundle-size impact (measured)

Measured with `bun run --cwd apps/frontend build` on this branch, before and after the growth
feature:

| | raw | gzip |
|---|---|---|
| Initial bundle, before Phase 7.1 | 689.01 kB | 201.26 kB |
| Initial bundle, after Phase 7.1 | 718.11 kB | 208.41 kB |
| `GrowthChart-*.js` (async chunk) | 71.93 kB | **25.88 kB** |

**visx adds 0 kB to the initial bundle.** The entire library plus its d3 dependencies lands in the
lazily-loaded `GrowthChart` chunk, verified by grepping the built `index-*.js` for visx/d3 markers
(zero hits). The ~29 kB / ~7 kB gzip the initial bundle *does* grow by is the growth feature's own
non-chart code — the page, form, list, API client and i18n strings — which any charting choice would
have cost equally.

## Consequences

- **The chart is code we own.** There is no component API to work around when a requirement is
  unusual (and W-13/W-14 are unusual), but there is also no component API doing work for us: axes,
  bands, markers, tooltip and cursor are all explicit. That is a deliberate trade of upfront lines
  of code for control over accessibility and theming.
- **Interaction logic is unit-testable in isolation.** `useGrowthChartCursor` is a plain hook over a
  data array, so the long-press timing, the nearest-point search and the arrow-key clamping are
  tested without rendering SVG (`useGrowthChartCursor.spec.ts`), and the rendered chart is tested
  for bands/series/ARIA separately (`GrowthChart.spec.tsx`).
- **jsdom has no layout**, so `useParentSize` reports width 0 in tests. `GrowthChart` therefore
  accepts a `fixedWidth` prop used only by specs, and `src/test/setup.ts` gained a no-op
  `ResizeObserver` stub next to the existing `matchMedia` one (missing browser plumbing, not
  per-test behaviour).
- **A second chart would reuse this stack**, not a different one. If more charts appear, the shared
  parts (geometry, cursor hook, tooltip) are already extracted; if a future chart needs none of
  W-13/W-14's interaction demands, that is the moment to reconsider whether a component library
  would be cheaper for *that* case.
- **Nine `@visx/*` packages are pinned exactly** (`4.0.0`). visx publishes one package per concern,
  so the dependency list is long but each entry is small and independently versioned; pinning keeps
  the async chunk's size reproducible.

## Related

- [Phase 7 roadmap](../roadmap/phase-7-v2-erweiterungen.md) — sub-phase 7.1 and requirements
  W-12/W-13/W-14.
- [ADR-0013](0013-design-system-styling-approach.md) — the token/`cva` styling approach the chart's
  colors come from, and the precedent for measuring bundle impact before committing to a UI
  dependency.
- [ADR-0006](0006-event-base-table-with-per-type-detail-tables.md) — its `GrowthMeasurement`
  addendum describes the data this chart renders.
- `apps/frontend/src/components/growth/` — `GrowthChart.tsx` (lazy entry point + `aria-live`
  readout), `GrowthChartInner.tsx` (SVG), `useGrowthChartCursor.ts` (pointer/touch/keyboard cursor),
  `GrowthChartTooltip.tsx`, `growthChartGeometry.ts`, `growthChartData.ts`.
