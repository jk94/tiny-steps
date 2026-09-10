/**
 * The react-pdf output target of the token codegen (roadmap Phase 7.4, EXP-9).
 *
 * The PDF report has to look like the application, and the only way to
 * guarantee that over time is to feed it from the same `design-system/tokens/`
 * source the CSS and the Markdown styleguide come from — a hand-maintained
 * second palette in the backend would drift on the first token change.
 *
 * Kept in its own module (rather than inline in `build-tokens.ts`) so it can be
 * unit-tested: `build-tokens.ts` performs its `writeFileSync` calls at import
 * time, which a spec must not trigger.
 */

export type ColorPair = { light: string; dark: string };
export type ColorTokens = Record<string, ColorPair>;
export type ScaleTokens = Record<string, string>;
export interface TypographyTokens {
  fontFamily: ScaleTokens;
  fontSize: ScaleTokens;
  lineHeight: ScaleTokens;
  fontWeight: ScaleTokens;
}

export interface ReportTokenSource {
  color: ColorTokens;
  typography: TypographyTokens;
  spacing: ScaleTokens;
  radii: ScaleTokens;
}

export interface ReportTokens {
  color: Record<string, string>;
  spacing: Record<string, number>;
  radii: Record<string, number>;
  fontSize: Record<string, number>;
  lineHeight: Record<string, number>;
  fontWeight: Record<string, number>;
  fontFamily: Record<string, string>;
}

/**
 * `@react-pdf/renderer` measures everything in PostScript points (72 per inch)
 * and rejects CSS units outright, so every length token has to be converted to
 * a bare number here rather than at render time.
 *
 * The web side's `rem` is 16 CSS px, and a CSS px is 1/96 inch, so
 * 1rem = 16/96 inch = 12pt and 1px = 0.75pt. Keeping the ratio (rather than
 * rounding "1rem" to a nicer 10 or 12 by eye) is what makes the report's
 * spacing rhythm actually the same rhythm as the app's.
 */
const POINTS_PER_REM = 12;
const POINTS_PER_PIXEL = 0.75;

/** Two decimals is below a printer's resolution; more would only add noise. */
const MAX_DECIMALS = 2;

function roundToPoints(value: number): number {
  const factor = 10 ** MAX_DECIMALS;
  return Math.round(value * factor) / factor;
}

/**
 * Converts one CSS length token to points. Unitless values (e.g. spacing `"0"`)
 * pass through as-is; anything else must carry a unit this function knows, so a
 * token added in an unsupported unit fails the build instead of silently
 * rendering at the wrong size.
 */
export function cssLengthToPoints(value: string): number {
  const trimmed = value.trim();

  if (trimmed.endsWith('rem')) {
    return roundToPoints(Number.parseFloat(trimmed) * POINTS_PER_REM);
  }
  if (trimmed.endsWith('px')) {
    return roundToPoints(Number.parseFloat(trimmed) * POINTS_PER_PIXEL);
  }

  const unitless = Number(trimmed);
  if (Number.isFinite(unitless)) {
    return roundToPoints(unitless);
  }

  throw new Error(`Cannot convert CSS length "${value}" to PDF points`);
}

function mapValues<T>(record: ScaleTokens, transform: (value: string) => T): Record<string, T> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, transform(value)]));
}

/**
 * Projects the design tokens onto the subset a PDF can express.
 *
 * Only the **light** color values are emitted: a printed page has no
 * `prefers-color-scheme`, and a report that came out dark because the server
 * happened to prefer dark would be both surprising and unprintable.
 */
export function toReportTokens(source: ReportTokenSource): ReportTokens {
  return {
    color: Object.fromEntries(
      Object.entries(source.color).map(([name, pair]) => [name, pair.light]),
    ),
    spacing: mapValues(source.spacing, cssLengthToPoints),
    radii: mapValues(source.radii, cssLengthToPoints),
    fontSize: mapValues(source.typography.fontSize, cssLengthToPoints),
    // Line heights and weights are already unitless CSS numbers.
    lineHeight: mapValues(source.typography.lineHeight, Number),
    fontWeight: mapValues(source.typography.fontWeight, Number),
    fontFamily: { ...source.typography.fontFamily },
  };
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const NON_NEGATIVE_INTEGER = /^(0|[1-9][0-9]*)$/;

/**
 * Quotes an object key only where JavaScript requires it — matching Prettier's
 * default `quoteProps: "as-needed"`. The emitted file is committed and must
 * pass `bun run format:check`, so the generator has to produce exactly what
 * Prettier would (the same reason `build-tokens.ts` pre-wraps its CSS lines).
 */
function formatKey(key: string): string {
  return IDENTIFIER.test(key) || NON_NEGATIVE_INTEGER.test(key) ? key : `'${key}'`;
}

function serialize(value: unknown, indent: string): string {
  if (typeof value === 'string') {
    return `'${value}'`;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  const entries = Object.entries(value as Record<string, unknown>).map(
    ([key, nested]) => `${indent}  ${formatKey(key)}: ${serialize(nested, `${indent}  `)},`,
  );
  return ['{', ...entries, `${indent}}`].join('\n');
}

/**
 * Renders the report tokens as a TypeScript module.
 *
 * Emits a **plain object**, deliberately not a `StyleSheet.create(...)` call:
 * that would make a generated artifact import `@react-pdf/renderer`, coupling
 * the design system to the backend's renderer choice. The renderer wraps this
 * object itself (see `renderers/react-pdf/styles.ts`).
 */
export function buildReportTokensModule(source: ReportTokenSource, header: string): string {
  const tokens = toReportTokens(source);

  return [
    header,
    '',
    '/**',
    ' * Design tokens in the units `@react-pdf/renderer` understands: colors as',
    ' * literal hex (light values only — a printed page has no dark mode) and every',
    ' * length as a bare number of PostScript points.',
    ' *',
    ' * Consumed by `styles.ts`, which is what actually calls `StyleSheet.create`.',
    ' */',
    `export const reportTokens = ${serialize(tokens, '')} as const;`,
    '',
    'export type ReportTokens = typeof reportTokens;',
    '',
  ].join('\n');
}
