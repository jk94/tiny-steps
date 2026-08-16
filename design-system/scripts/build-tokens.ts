/**
 * Token codegen: reads `design-system/tokens/*.json` (the single source of
 * truth) and writes the three generated artifacts consumed by the frontend and
 * the Markdown styleguide. Deliberately a small hand-rolled script rather than
 * Style Dictionary — see ADR-0013's "Consequences" note on why that trade-off
 * is right for this repo's fixed token set and bespoke Markdown-table output.
 *
 * Run via `bun run design-tokens:build`. Re-run after any token JSON edit and
 * commit the regenerated outputs (see docs/design-system/reconciliation-process.md).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const tokensDir = resolve(scriptDir, '../tokens');
const repoRoot = resolve(scriptDir, '../..');

const CSS_HEADER =
  "/* GENERATED FILE — do not edit by hand. Run 'bun run design-tokens:build' to regenerate. Source: design-system/tokens/*.json */";
const TS_HEADER =
  "/* GENERATED FILE — do not edit by hand. Run 'bun run design-tokens:build' to regenerate. Source: design-system/tokens/*.json */";
const MD_HEADER =
  '<!-- GENERATED FILE — do not edit by hand. Run `bun run design-tokens:build` to regenerate. Source: design-system/tokens/*.json -->';

type ColorPair = { light: string; dark: string };
type ColorTokens = Record<string, ColorPair>;
type ScaleTokens = Record<string, string>;
type TypographyTokens = {
  fontFamily: ScaleTokens;
  fontSize: ScaleTokens;
  lineHeight: ScaleTokens;
  fontWeight: ScaleTokens;
};
type EventTypeTokens = Record<string, { colorToken: string; iconKey: string }>;

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(tokensDir, name), 'utf8')) as T;
}

const color = readJson<ColorTokens>('color.json');
const typography = readJson<TypographyTokens>('typography.json');
const spacing = readJson<ScaleTokens>('spacing.json');
const radii = readJson<ScaleTokens>('radii.json');
const shadows = readJson<ScaleTokens>('shadows.json');
const breakpoints = readJson<ScaleTokens>('breakpoints.json');
const eventTypes = readJson<EventTypeTokens>('event-types.json');

const colorNames = Object.keys(color);

/** Emits `  --name: value;` lines for a flat record, given a prefix. */
function cssVars(prefix: string, record: ScaleTokens): string[] {
  return Object.entries(record).map(([key, value]) => `  --${prefix}-${key}: ${value};`);
}

function buildCss(): string {
  const rootLines: string[] = [
    '  /* Color (light / default) */',
    ...colorNames.map((name) => `  --color-${name}: ${color[name].light};`),
    '',
    '  /* Breakpoints */',
    ...cssVars('breakpoint', breakpoints),
    '',
    '  /* Spacing */',
    ...cssVars('spacing', spacing),
    '',
    '  /* Typography */',
    ...cssVars('font-family', typography.fontFamily),
    ...cssVars('font-size', typography.fontSize),
    ...cssVars('line-height', typography.lineHeight),
    ...cssVars('font-weight', typography.fontWeight),
    '',
    '  /* Radii */',
    ...cssVars('radius', radii),
    '',
    '  /* Shadows */',
    ...cssVars('shadow', shadows),
  ];

  const darkColorLines = colorNames.map((name) => `    --color-${name}: ${color[name].dark};`);
  const darkOverrideLines = colorNames.map((name) => `  --color-${name}: ${color[name].dark};`);

  // `@theme inline` maps our runtime custom properties into Tailwind v4's
  // utility namespaces (see ADR-0013). `inline` means Tailwind substitutes the
  // `var(...)` reference into generated utilities instead of re-emitting the
  // variable to `:root`, so our own `:root`/dark-mode definitions above stay
  // the single source of the value (no circular self-definition). Breakpoints
  // are the one exception: media-query conditions can't read a CSS variable, so
  // they carry literal values here.
  const themeLines: string[] = [
    '  /* Colors */',
    ...colorNames.map((name) => `  --color-${name}: var(--color-${name});`),
    '  /* Breakpoints (literal — media queries cannot read a CSS variable) */',
    ...Object.entries(breakpoints).map(([key, value]) => `  --breakpoint-${key}: ${value};`),
    '  /* Spacing */',
    ...Object.keys(spacing).map((key) => `  --spacing-${key}: var(--spacing-${key});`),
    '  /* Typography */',
    ...Object.keys(typography.fontFamily).map(
      (key) => `  --font-${key}: var(--font-family-${key});`,
    ),
    ...Object.keys(typography.fontSize).map((key) => `  --text-${key}: var(--font-size-${key});`),
    ...Object.keys(typography.lineHeight).map(
      (key) => `  --leading-${key}: var(--line-height-${key});`,
    ),
    ...Object.keys(typography.fontWeight).map(
      (key) => `  --font-weight-${key}: var(--font-weight-${key});`,
    ),
    '  /* Radii */',
    ...Object.keys(radii).map((key) => `  --radius-${key}: var(--radius-${key});`),
    '  /* Shadows */',
    ...Object.keys(shadows).map((key) => `  --shadow-${key}: var(--shadow-${key});`),
  ];

  return [
    CSS_HEADER,
    '',
    ':root {',
    ...rootLines,
    '}',
    '',
    "/* System-preference dark mode (opt out per-subtree with [data-theme='light']). */",
    '@media (prefers-color-scheme: dark) {',
    "  :root:not([data-theme='light']) {",
    ...darkColorLines,
    '  }',
    '}',
    '',
    '/* Explicit override hook (no theme-toggle UI in M1 — just the CSS mechanism). */',
    ":root[data-theme='dark'] {",
    ...darkOverrideLines,
    '}',
    '',
    '@theme inline {',
    ...themeLines,
    '}',
    '',
  ].join('\n');
}

function mdTable(header: string[], rows: string[][]): string {
  const headerLine = `| ${header.join(' | ')} |`;
  const separator = `| ${header.map(() => '---').join(' | ')} |`;
  const bodyLines = rows.map((cells) => `| ${cells.join(' | ')} |`);
  return [headerLine, separator, ...bodyLines].join('\n');
}

function buildMarkdown(): string {
  const colorTable = mdTable(
    ['Token', 'Light', 'Dark'],
    colorNames.map((name) => [
      `\`--color-${name}\``,
      `\`${color[name].light}\``,
      `\`${color[name].dark}\``,
    ]),
  );

  const typographyTable = mdTable(
    ['Token', 'Value'],
    [
      ...Object.entries(typography.fontFamily).map(([k, v]) => [
        `\`--font-family-${k}\``,
        `\`${v}\``,
      ]),
      ...Object.entries(typography.fontSize).map(([k, v]) => [`\`--font-size-${k}\``, `\`${v}\``]),
      ...Object.entries(typography.lineHeight).map(([k, v]) => [
        `\`--line-height-${k}\``,
        `\`${v}\``,
      ]),
      ...Object.entries(typography.fontWeight).map(([k, v]) => [
        `\`--font-weight-${k}\``,
        `\`${v}\``,
      ]),
    ],
  );

  const spacingTable = mdTable(
    ['Token', 'Value'],
    Object.entries(spacing).map(([k, v]) => [`\`--spacing-${k}\``, `\`${v}\``]),
  );
  const radiiTable = mdTable(
    ['Token', 'Value'],
    Object.entries(radii).map(([k, v]) => [`\`--radius-${k}\``, `\`${v}\``]),
  );
  const shadowsTable = mdTable(
    ['Token', 'Value'],
    Object.entries(shadows).map(([k, v]) => [`\`--shadow-${k}\``, `\`${v}\``]),
  );
  const breakpointsTable = mdTable(
    ['Token', 'Value'],
    Object.entries(breakpoints).map(([k, v]) => [`\`--breakpoint-${k}\``, `\`${v}\``]),
  );
  const eventTypeTable = mdTable(
    ['Event type key', 'Color token', 'Icon key'],
    Object.entries(eventTypes).map(([key, entry]) => [
      `\`${key}\``,
      `\`--color-${entry.colorToken}\``,
      `\`${entry.iconKey}\``,
    ]),
  );

  return [
    MD_HEADER,
    '',
    '# Design Tokens',
    '',
    'Platform-neutral values derived from `design-system/tokens/*.json`. These are',
    'the single source of truth from which both the React CSS custom properties',
    '(`apps/frontend/src/styles/tokens.generated.css`) and this document are generated.',
    'A port to another UI technology (Flutter, Angular, …) should read the values here,',
    'not reverse-engineer the CSS.',
    '',
    '## Color',
    '',
    'Semantic color roles, each with a light (default) and dark value. Event-type colors',
    'appear both here and in the Event-type table below.',
    '',
    colorTable,
    '',
    '## Typography',
    '',
    typographyTable,
    '',
    '## Spacing',
    '',
    spacingTable,
    '',
    '## Radii',
    '',
    radiiTable,
    '',
    '## Shadows',
    '',
    shadowsTable,
    '',
    '## Breakpoints',
    '',
    'Mobile-first `min-width` breakpoints. These match',
    '`apps/frontend/src/styles/breakpoints.css` exactly (a behavior-neutral supersession).',
    '',
    breakpointsTable,
    '',
    '## Event-type colors and icons',
    '',
    'Maps each event type / sub-type to a color token (resolved against the Color table)',
    'and a hand-authored icon key (resolved against',
    '`apps/frontend/src/components/ui/icons/event-types/`).',
    '',
    eventTypeTable,
    '',
  ].join('\n');
}

function buildEventTypeTs(): string {
  const entries = Object.entries(eventTypes).map(([key, entry]) => {
    const quotedKey = key.includes('.') ? `'${key}'` : key;
    return `  ${quotedKey}: { colorVar: '--color-${entry.colorToken}', iconKey: '${entry.iconKey}' },`;
  });

  return [
    TS_HEADER,
    '',
    '/** One resolved event-type visual mapping: a CSS custom-property name holding',
    ' * the color, plus the hand-authored icon key (see the icons/event-types barrel). */',
    'export interface EventTypeTokenEntry {',
    '  colorVar: string;',
    '  iconKey: string;',
    '}',
    '',
    '/** Event/sub-type key -> visual tokens, generated from',
    ' * `design-system/tokens/event-types.json`. Sub-type keys use dot notation',
    " * (e.g. `'FEEDING.BREAST'`) matching the EventType union + sub-type fields. */",
    'export const eventTypeTokens = {',
    ...entries,
    '} as const satisfies Record<string, EventTypeTokenEntry>;',
    '',
    'export type EventTypeTokenKey = keyof typeof eventTypeTokens;',
    '',
  ].join('\n');
}

writeFileSync(resolve(repoRoot, 'apps/frontend/src/styles/tokens.generated.css'), buildCss());
writeFileSync(resolve(repoRoot, 'docs/design-system/tokens.md'), buildMarkdown());
writeFileSync(
  resolve(repoRoot, 'apps/frontend/src/lib/eventTypeTokens.generated.ts'),
  buildEventTypeTs(),
);

console.log('Design tokens built: tokens.generated.css, tokens.md, eventTypeTokens.generated.ts');
