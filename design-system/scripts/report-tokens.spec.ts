import { describe, expect, it } from 'vitest';
import color from '../tokens/color.json';
import typography from '../tokens/typography.json';
import spacing from '../tokens/spacing.json';
import radii from '../tokens/radii.json';
import {
  buildReportTokensModule,
  cssLengthToPoints,
  toReportTokens,
  type ReportTokenSource,
} from './report-tokens.ts';

/** The real token files, so a token added in an unsupported unit fails here. */
const SOURCE = { color, typography, spacing, radii } as ReportTokenSource;

describe('cssLengthToPoints', () => {
  it('converts rem at 12 points per rem', () => {
    expect(cssLengthToPoints('1rem')).toBe(12);
    expect(cssLengthToPoints('0.875rem')).toBe(10.5);
    expect(cssLengthToPoints('0.25rem')).toBe(3);
  });

  it('converts px at 0.75 points per pixel', () => {
    expect(cssLengthToPoints('340px')).toBe(255);
  });

  it('passes unitless values through', () => {
    expect(cssLengthToPoints('0')).toBe(0);
  });

  it('rejects a unit it cannot convert rather than guessing', () => {
    expect(() => cssLengthToPoints('2em')).toThrow(/Cannot convert CSS length/);
    expect(() => cssLengthToPoints('auto')).toThrow(/Cannot convert CSS length/);
  });
});

describe('toReportTokens', () => {
  const tokens = toReportTokens(SOURCE);

  it('exposes every group the renderer styles from', () => {
    expect(Object.keys(tokens).sort()).toEqual([
      'color',
      'fontFamily',
      'fontSize',
      'fontWeight',
      'lineHeight',
      'radii',
      'spacing',
    ]);
  });

  it('keeps the light color value and drops the dark one', () => {
    for (const [name, pair] of Object.entries(SOURCE.color)) {
      expect(tokens.color[name]).toBe(pair.light);
    }
    expect(Object.values(tokens.color).every((value) => /^#[0-9a-f]{3,8}$/i.test(value))).toBe(
      true,
    );
  });

  it('carries the growth chart colors the report draws its curves with', () => {
    for (const name of [
      'growth-weight',
      'growth-length',
      'growth-head-circumference',
      'growth-band',
    ]) {
      expect(tokens.color[name]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('emits every length as a bare number of points, never a CSS string', () => {
    for (const group of [tokens.spacing, tokens.radii, tokens.fontSize]) {
      for (const value of Object.values(group)) {
        expect(typeof value).toBe('number');
        expect(Number.isFinite(value)).toBe(true);
      }
    }
    expect(tokens.fontSize.sm).toBe(10.5);
    expect(tokens.spacing['4']).toBe(12);
  });

  it('names the embedded report font family', () => {
    expect(tokens.fontFamily.report).toBe('Inter');
  });

  it('keeps font weights numeric so react-pdf can match a registered face', () => {
    expect(tokens.fontWeight).toEqual({ normal: 400, medium: 500, semibold: 600, bold: 700 });
  });
});

describe('buildReportTokensModule', () => {
  const module = buildReportTokensModule(SOURCE, '/* header */');

  it('marks the output as generated and exports the token object plus its type', () => {
    expect(module.startsWith('/* header */')).toBe(true);
    expect(module).toContain('export const reportTokens = {');
    expect(module).toContain('export type ReportTokens = typeof reportTokens;');
  });

  it('imports nothing, so the design system stays renderer-agnostic', () => {
    // A `StyleSheet.create(...)` output would have to import
    // @react-pdf/renderer, coupling a design-system artifact to the backend's
    // renderer choice. The module is a plain object instead.
    expect(module).not.toMatch(/^import\b/m);
    expect(module).not.toContain('StyleSheet.create(');
  });

  it('quotes only the keys JavaScript requires, matching Prettier', () => {
    expect(module).toContain('color: {');
    expect(module).toContain("'growth-band':");
    expect(module).toContain("'2xl':");
    expect(module).toContain('    4: 12,');
  });
});
