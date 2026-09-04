# ADR-0015: PDF report generation — `@react-pdf/renderer` behind a renderer-neutral `ReportDocument`

## Status

Accepted (partially implemented — see "Deferred: the remote renderer")

## Context

Roadmap Phase 7.4 asks for a **curated, human-readable PDF** a parent can take to a paediatric
appointment: master data, the growth table plus WHO-banded trend curves, milestones reached,
medications/vaccinations, and an aggregated tracking summary (EXP-1…EXP-9). It sits beside — not
instead of — the Phase 5 raw-data export, which exists for archival and re-processing.

Four constraints shaped the decision:

- **EXP-9** — the report must visibly be the same design system as the app: colors, typography and
  spacing from `design-system/tokens/*.json`, not a second palette maintained by hand.
- **EXP-10** — there are to be **two interchangeable renderers**: a built-in one with no additional
  system dependency, and an external HTTP service. The built-in one is the default.
- **EXP-4** — the growth chart in the report must be the same curve the app draws, with the same
  percentile bands. Phase 7.1 built that chart with visx (see [ADR-0014](0014-charting-library-visx.md)),
  i.e. as React SVG.
- **Self-hosted-only** (PRD 5) — nothing may require an outbound network call at render time, and
  the application image should stay small.

The core problem EXP-10 creates: **the built-in path cannot render HTML, and a browser-based service
cannot render JSX.** Without a countermeasure the report's layout would be written twice and would
drift on the first change.

## Decision

### 1. A `ReportDocument` intermediate representation

`ReportDocumentBuilder` produces exactly one `ReportDocument`
(`apps/backend/src/export/report/report-document.types.ts`): a serialisable list of seven block
kinds — `documentHeader`, `sectionHeading`, `keyFigures`, `table`, `chart`, `bodyText`,
`emptySectionNote`. A renderer implements only those.

Two rules keep the boundary real, and both are enforced by the module graph rather than by
convention:

1. **Every value in a block is an already-formatted, already-localized string.** The renderer does
   no translation, no number formatting and no date logic — otherwise two renderers could format the
   same measurement differently, which is exactly the drift the IR exists to prevent.
2. **Neither the types nor the builder may reference a renderer.** `report-document.types.ts` imports
   nothing at all; `report-document.builder.ts` imports only domain services.

So data selection, period logic, aggregation, percentile lookup and ordering exist **once**. What a
second renderer duplicates is only the appearance of a small, stable block set.

### 2. `@react-pdf/renderer` as the built-in renderer

React on its own layout engine — no Chromium, no system binary, nothing added to the Docker image
beyond an npm dependency. The renderer (`renderers/react-pdf/`) is bound to a `REPORT_RENDERER`
injection token, so selecting a different implementation later is a one-line provider change.

### 3. The chart is the *same component*, rendered to SVG on the server

`packages/growth-chart-static/` is a new workspace package holding the chart's SVG body. The
frontend renders it in the browser and layers its interactive parts (cursor, active marker,
`role="slider"` overlay, tooltip) on top through an `overlay` prop; the backend renders it with
`renderToStaticMarkup` and embeds the resulting string as a vector image. The geometry module moved
here from `apps/frontend/src/components/growth/` — it was moved, not copied, precisely so the two
cannot diverge.

The component is pure and prop-driven: every label arrives as a `format*` function, every color as a
literal string. `var(--color-…)` resolves to nothing outside a browser, so the frontend passes
`var(…)` strings and the report passes hex from the generated report tokens — both derived from the
same design tokens.

### 4. Design tokens gain a react-pdf output target

`bun run design-tokens:build` now emits a fourth artifact,
`apps/backend/src/export/report/renderers/react-pdf/report-tokens.generated.ts`. Colors are the
**light** values only (a printed page has no `prefers-color-scheme`); every length is converted from
CSS to PostScript points (`1rem` = `12`, `1px` = `0.75`), because react-pdf measures in points and
rejects CSS units. An unconvertible unit throws at build time rather than rendering at the wrong
size. The generated module is a plain object, not a `StyleSheet.create(...)` call, so no
design-system artifact imports the backend's renderer.

### 5. Inter, vendored, instead of the design system's font stack

react-pdf has no system-font access: every glyph comes from a file it can read. `--font-family-sans`
is a CSS stack naming families that only exist on the reader's device, so it is unusable here. Four
static Inter instances (400/500/600/700, **SIL OFL 1.1**) are vendored under `renderers/react-pdf/fonts/`
and copied into `dist/` by a `nest-cli.json` asset entry — the same "vendor it, never fetch it"
posture as the WHO reference tables. Provenance and licence obligations are in that directory's
README. Only upright faces are vendored, so the report uses no italics; react-pdf throws rather than
synthesising a style it has no file for.

### 6. A backend report-i18n catalog, deliberately duplicated

`report-i18n/{de,en}.json` holds ~60 strings with a ~30-line lookup helper (key, `{{name}}`
interpolation, a two-form plural). Sharing the frontend's catalog would mean either shipping its
~1000-key bundle into the backend or extracting a fourth package for these strings, and it would
couple the wording of a printed medical document to the wording of a screen that is free to change.
No i18n library: the report needs nothing i18next provides beyond those three features.

## Alternatives considered

**Chromium in the application image (Puppeteer/Playwright).** The obvious way to get "HTML I already
know how to write" into a PDF. Rejected on image size and operational weight: a headless Chromium is
roughly 300–400 MB plus a long list of shared libraries in a `node:slim` base, it needs sandbox
flags and extra memory per render, and it turns every browser CVE into a patch obligation for a
self-hosted family app. EXP-10's premise — *builtin without additional system dependency* — rules it
out directly.

**Gotenberg (or any HTTP PDF service) as the only path.** Would make the report unavailable in the
default single-container deployment, contradicting EXP-11's "without any configuration the built-in
renderer runs". It remains the intended *optional* second renderer; see below.

**`pdfkit` directly.** react-pdf is built on it, so this is the "one layer lower" option. Rejected
because pdfkit has no layout engine at all: every table column, every page break and every wrap
would be manual coordinate arithmetic, which is precisely the work react-pdf's flexbox
implementation does. The report has tables that must repeat headers across pages — hand-computing
that is a lot of fragile code for no benefit.

**`pdfmake`.** Has a declarative document definition and would have covered the tables well.
Rejected on the chart: its content model has no SVG primitive that would take our rendered chart as
vectors, so EXP-4 would have fallen back to a rasterised image. Its font embedding also expects
pre-built "vfs" font bundles, which is a clumsier vendoring story than a plain `.ttf`.

**A second, PDF-specific chart implementation.** Rejected outright: two chart implementations for
one clinical curve is exactly the duplication the whole `ReportDocument` design exists to avoid.

**Separate `growth.csv` / `milestones.csv` / `health.csv` endpoints** — see "Divergence" below.

## Measured

### Decision gate: does the chart survive the round trip? (spike, Step 1)

The riskiest assumption was that a visx-based React SVG chart renders in a plain backend Node
process and then survives embedding into a PDF. It was proven **before** anything else was built,
with a throwaway spike that has since been deleted. Findings, all folded into the real modules:

| Question | Outcome |
|---|---|
| Does `renderToStaticMarkup(<visx chart/>)` work server-side? | **Yes** — under Bun, under ts-jest/CJS, and under `nest build` → `node dist/`. The d3 packages visx depends on are ESM-only; Node's `require(esm)` covers them. |
| Does `@react-pdf/renderer` accept an SVG string? | **Yes** — v4.9 parses SVG through `@react-pdf/svg` and draws it as **vectors**. |
| Is the result usable? | **Yes** — bands, curves, markers, axis lines and all tick/band labels render correctly and stay sharp at any zoom. |
| Do the vendored Inter faces embed? | **Yes**, including umlauts and ligatures; `__dirname` + `nest-cli.json` assets resolve in both the source tree and `dist/`. |

Two constraints emerged and are documented at their call sites:

- visx emits `transform=""` on a group with no offset, and `@react-pdf/stylesheet`'s transform parser
  crashes on any transform string without a `(`. `renderGrowthChartSvg` strips empty transforms.
- `@visx/text` wraps its content in a **nested `<svg>`**, which `@react-pdf/render` has no renderer
  for — it warns and drops the node. The shared chart therefore uses plain `<text>` and a custom
  `tickComponent`, and does not depend on `@visx/text` at all.

**Gate outcome: the SVG path.** The `chart` block carries `svg: string`. The prepared raster fallback
(`@resvg/resvg-js` → PNG → `<Image>`) was **not** needed and that dependency was never added — a
raster chart would have been strictly worse in print for no compensating benefit.

### EXP-15: runtime and memory over growing periods

`bun run --cwd apps/backend report:bench`, run against the compiled output on the production runtime
(`node dist/…`, Node 26.8, Apple Silicon), 5 runs per period. Synthetic data: dense
feeding/sleep/diaper counts, ~monthly measurements, 10 milestones, 20 health records, all five
sections selected, three charts with full WHO bands.

| Period | min ms | median ms | max ms | peak heap MB | PDF size |
|---|---|---|---|---|---|
| 1 month | 76 | 79 | 191 | 47.0 | 94 kB |
| 3 months | 78 | 79 | 80 | 12.0 | 95 kB |
| 12 months | 93 | 94 | 95 | 12.9 | 101 kB |
| 24 months | 114 | 115 | 123 | 23.0 | 107 kB |

Reading: the first run's 191 ms / 47 MB is one-off font parsing and module warm-up, not per-report
cost. Steady state is **≈80–115 ms and ≈12–23 MB** across the whole supported range, and growth with
period length is gentle — the charts and the header dominate, while the tracking section is three
aggregate numbers regardless of how many events they summarise.

**Consequence:** no background job and no worker thread. Generation stays synchronous on the request
thread, and the period is capped at `MAX_REPORT_PERIOD_DAYS = 731` (two years, the span a check-up
actually looks back over) so an accidental "from 1970" cannot become an unbounded stall. If the
report ever grows features that change this profile — per-milestone photos, per-event tables — the
first step is to re-run the benchmark, and the second is a worker thread rather than a longer cap.

## Divergence: no separate per-domain CSV endpoints

The Phase 7.4 API table lists `growth.csv`, `milestones.csv` and `health.csv` alongside the report
endpoint, and roadmap decision #3 asks for that choice to be justified in the PR. **They were not
built**, and EXP-13 is nevertheless satisfied.

Phases 7.1, 7.2 and 7.3 each already appended their domain to the existing flat export: a
`recordKind` discriminator plus per-domain columns strictly at the end of `RawExportRow`/`CSV_COLUMNS`,
with the pre-existing event columns untouched. Growth, milestones and medications/vaccinations are
therefore already exportable, which is precisely what EXP-13 asks for. Building three more endpoints
now would add a third export shape (one flat file, three narrow files, one report) for data that is
already in the first one, and would leave two overlapping CSV formats to keep in sync.

`export.service.ts` is consequently untouched by this phase. The phase-7 README's "Festlegung 5"
(one dataset per domain) is superseded by what 7.1–7.3 actually did; the per-domain *presentation*
lives in this report instead.

## Deferred: the remote renderer

`RemoteHtmlRenderer` (EXP-10's second renderer), the `ReportDocument`→HTML output, the optional
Gotenberg service in `docker-compose.yml` and the `export.pdf` configuration section (EXP-11/EXP-12)
are **not implemented**. With only one renderer, a `renderer: builtin | remote` setting would be a
config key with exactly one legal value — configuration that documents an intention rather than
controlling behaviour.

The design is fixed, and the code is already shaped for it, so adding it is additive:

- `ReportRenderer` is an interface with a single `render(document): Promise<Buffer>` method, and the
  active implementation is bound to the `REPORT_RENDERER` token in `report.module.ts`.
- The second renderer walks the same seven block kinds, emitting HTML that references the existing
  CSS custom properties, and POSTs it to a configured endpoint (Gotenberg's
  `/forms/chromium/convert/html` is an off-the-shelf counterpart, so no service has to be written —
  and Chromium stays outside the application image).
- Configuration follows the established precedence — code default → YAML → environment variable —
  with start-up validation failing fast when `renderer: remote` is set without a URL.
- **EXP-12 is deliberate: no silent fallback.** An unreachable remote renderer must fail visibly,
  because falling back would hand the user a differently-designed document without telling them. The
  frontend's error handling has a matching gap on purpose: it distinguishes only "no data in this
  period" from a generic failure, with a code comment stating that "service unreachable" is absent
  because the service does not exist yet.
- **Data-protection exception to document when it lands.** The remote renderer sees a child's health
  data. Inside the same Compose network nothing leaves the installation, but an endpoint pointed at a
  foreign host would be a real exception to the self-hosted-only principle — directly comparable to
  the FCM/APNs exception in [ADR-0012](0012-capacitor-native-wrapper.md), and to be spelled out both
  here and in the commented example configuration.

## Consequences

- **The report is a second consumer of four domain services.** `GrowthModule`, `MilestoneModule`,
  `HealthRecordModule` and `EventModule` now export their services. The builder deliberately reads
  through them rather than querying Prisma directly, so a printed percentile is by construction the
  same number the screen showed — never a second derivation of W-17/W-18/W-19's reference selection.
- **`EventService` gained `getPeriodTrackingSummary`**, separate from `getStatsSummary` rather than a
  generalisation of it: that shape means "today" and feeds a live screen, and widening it for a
  document's benefit would have changed a screen's contract.
- **The chart package must be compiled.** The backend's `tsc` cannot emit files from outside its
  `rootDir`, so `packages/growth-chart-static` ships a dual ESM/CJS build (wired to `prepare`, plus an
  explicit step in the Dockerfile, whose manifest-first layer copy makes `prepare` a no-op). The
  frontend ignores that build and consumes the source through a Vite alias, so the chart still
  hot-reloads and no frontend spec can run against a stale `dist/`.
- **`react-dom/server` is behind a `./server` subpath**, not the package barrel. It is not
  side-effect-free, so a barrel re-export put ~187 kB raw / 57 kB gzip of it into the browser's lazy
  `GrowthChart` chunk even though nothing used it. With the split, the chunk is 73.3 kB / 26.3 kB
  gzip — within noise of the 72.2 kB / 25.9 kB [ADR-0014](0014-charting-library-visx.md) measured.
- **Jest cannot load `@react-pdf/renderer`.** It and its `@react-pdf/*` chain are ESM-only, and
  `yoga-layout` (the layout engine) uses `import.meta.url`, which has no CommonJS translation.
  Transforming the chain therefore cannot work, and `customExportConditions: ['import']` — globally
  or per file — flips well-behaved dual packages onto their ESM builds and breaks Jest's own
  internals. The suite instead maps the module to a three-line shim that loads it through
  `process.getBuiltinModule('node:module').createRequire`, i.e. Node's real `require(esm)`. The
  renderer spec therefore exercises actual PDF bytes rather than a mock. Revisit when react-pdf or
  Jest changes.
- **The backend now compiles `.tsx`.** `tsconfig` gained `jsx: react-jsx`, the Jest config gained
  `.tsx` handling, and ESLint's backend block was widened. `@types/react`/`@types/react-dom` are
  explicit devDependencies because tsc otherwise cannot name the inferred JSX return type under
  Bun's isolated `node_modules` (TS2742).
- **An entirely empty report is a 422, not a PDF.** `REPORT_EMPTY_PERIOD` is returned when every
  selected section came back empty; a *partially* empty report is still generated, with an explicit
  "no data in this period" note per section — a reader must be able to tell "nothing was recorded"
  apart from "this section was not requested".
- **Milestone photos are out of scope**, as the phase's scope note already stated: low clinical
  value, high file size.
- **The report's German and English wording is now a thing to maintain**, separately from the UI's.
  `report-i18n.spec.ts` enforces that the two catalogs have identical key sets and identical
  placeholders, so a one-sided edit fails the suite rather than surfacing as a raw key in a PDF.
- **The output has not been checked in a real PDF viewer.** Unit tests assert valid PDF bytes and a
  spike rasterised a page with `sips`, but Acrobat / a browser viewer / an actual print run are
  outstanding — font embedding, the vector chart and multi-page table behaviour are unverified on a
  real renderer. Deferred; tracked in `docs/known-issues.md`, same posture as the Phase 4/5
  real-device items.

## Related

- [Phase 7.4 roadmap](../roadmap/phase-7/phase-7-4-erweiterter-export-pdf.md) — EXP-1…EXP-15 and the
  implementation note recording what this phase deliberately left out.
- [ADR-0014](0014-charting-library-visx.md) — the visx chart this report reuses, and the precedent
  for measuring before committing to a UI dependency.
- [ADR-0013](0013-design-system-styling-approach.md) — the token pipeline the react-pdf target
  extends; see also `docs/design-system/reconciliation-process.md`.
- [ADR-0012](0012-capacitor-native-wrapper.md) — the FCM/APNs precedent for documenting an explicit
  exception to the self-hosted-only principle.
- [ADR-0006](0006-event-base-table-with-per-type-detail-tables.md) — its `GrowthMeasurement`
  addendum describes the data the growth section reports.
- `apps/backend/src/export/report/` — the builder, section builders, i18n catalog and renderer.
- `packages/growth-chart-static/` — the shared chart, including its README's list of constraints the
  PDF side imposes.
