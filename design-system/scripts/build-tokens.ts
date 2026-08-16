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
    '  /* Color (light / default). Declared under an `--rt-color-*` (runtime',
    "     token) name distinct from the `--color-*` names Tailwind's `@theme`",
    '     generates below — referencing the SAME name from both sides would make',
    "     Tailwind's own `:root,:host` companion declaration for `--color-*` a",
    '     self-reference (`--color-x: var(--color-x)`), which is invalid at',
    '     computed-value time and resolves to nothing. See the Tailwind docs',
    '     "Referencing other variables with @theme inline" example, which uses',
    '     this same distinct-name pattern. */',
    ...colorNames.map((name) => `  --rt-color-${name}: ${color[name].light};`),
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

  const darkColorLines = colorNames.map((name) => `    --rt-color-${name}: ${color[name].dark};`);
  const darkOverrideLines = colorNames.map((name) => `  --rt-color-${name}: ${color[name].dark};`);

  // `@theme inline` maps our runtime custom properties into Tailwind v4's
  // utility namespaces (see ADR-0013). `inline` means Tailwind substitutes the
  // `var(...)` reference into generated utilities instead of re-emitting the
  // variable to `:root`, so our own `:root`/dark-mode definitions above stay
  // the single source of the value. Colors reference the renamed `--rt-color-*`
  // runtime variables above (see the comment on `rootLines`) — same name on
  // both sides would make Tailwind's own `:root,:host` companion declaration
  // self-referencing and invalid. Spacing/radii/shadows/font-weight have no
  // runtime-varying override (unlike color, nothing swaps these at runtime),
  // so they carry literal values directly — the same self-reference risk would
  // otherwise apply since those don't need a distinct raw/theme name split,
  // just no var() indirection at all. Breakpoints are the other literal
  // exception: media-query conditions can't read a CSS variable anyway.
  const themeLines: string[] = [
    '  /* Colors */',
    ...colorNames.map((name) => `  --color-${name}: var(--rt-color-${name});`),
    '  /* Breakpoints (literal — media queries cannot read a CSS variable) */',
    ...Object.entries(breakpoints).map(([key, value]) => `  --breakpoint-${key}: ${value};`),
    '  /* Spacing (literal — no runtime override exists to reference) */',
    ...Object.entries(spacing).map(([key, value]) => `  --spacing-${key}: ${value};`),
    '  /* Typography */',
    ...Object.keys(typography.fontFamily).map(
      (key) => `  --font-${key}: var(--font-family-${key});`,
    ),
    ...Object.keys(typography.fontSize).map((key) => `  --text-${key}: var(--font-size-${key});`),
    ...Object.keys(typography.lineHeight).map(
      (key) => `  --leading-${key}: var(--line-height-${key});`,
    ),
    ...Object.entries(typography.fontWeight).map(
      ([key, value]) => `  --font-weight-${key}: ${value};`,
    ),
    '  /* Radii (literal — no runtime override exists to reference) */',
    ...Object.entries(radii).map(([key, value]) => `  --radius-${key}: ${value};`),
    '  /* Shadows (literal — no runtime override exists to reference) */',
    ...Object.entries(shadows).map(([key, value]) => `  --shadow-${key}: ${value};`),
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
