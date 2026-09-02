import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GROWTH_MEASURES, growthMeasureVisuals } from './growthMeasureVisuals';

const generatedCss = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../styles/tokens.generated.css'),
  'utf8',
);

describe('growthMeasureVisuals', () => {
  it.each(GROWTH_MEASURES)('resolves a color, icon, label and unit for %s', (measure) => {
    const visual = growthMeasureVisuals[measure];
    expect(visual.colorVar).toMatch(/^--color-growth-/);
    expect(visual.Icon).toBeTypeOf('object');
    expect(visual.labelKey).toMatch(/^growth\.measures\./);
    expect(visual.unitKey).toMatch(/^growth\.units\./);
  });

  it.each(GROWTH_MEASURES)('references a token that exists in the generated CSS (%s)', (measure) => {
    // Guards against a typo silently producing a transparent chart line: the
    // token names come from design-system/tokens/color.json via
    // `bun run design-tokens:build`, and nothing else checks this file by name.
    expect(generatedCss).toContain(`${growthMeasureVisuals[measure].colorVar}:`);
  });

  it('exposes the reference-band color as a token too', () => {
    expect(generatedCss).toContain('--color-growth-band:');
  });

  it('gives each measure a distinct color', () => {
    const colors = GROWTH_MEASURES.map((measure) => growthMeasureVisuals[measure].colorVar);
    expect(new Set(colors).size).toBe(colors.length);
  });
});
