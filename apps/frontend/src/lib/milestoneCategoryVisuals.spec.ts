import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MILESTONE_CATEGORIES, milestoneCategoryVisuals } from './milestoneCategoryVisuals';

const generatedCss = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../styles/tokens.generated.css'),
  'utf8',
);

describe('milestoneCategoryVisuals', () => {
  it.each(MILESTONE_CATEGORIES)(
    'resolves a color, icon, label and badge variant for %s',
    (category) => {
      const visual = milestoneCategoryVisuals[category];
      expect(visual.colorVar).toMatch(/^--color-milestone-/);
      expect(visual.Icon).toBeTypeOf('object');
      expect(visual.labelKey).toMatch(/^milestone\.categories\./);
      expect(visual.badgeVariant).toMatch(/^milestone-/);
    },
  );

  it.each(MILESTONE_CATEGORIES)(
    'references a token that exists in the generated CSS (%s)',
    (category) => {
      // Guards against a typo silently producing a transparent badge: the token
      // names come from design-system/tokens/color.json via
      // `bun run design-tokens:build`, and nothing else checks this file by name.
      const visual = milestoneCategoryVisuals[category];
      expect(generatedCss).toContain(`${visual.colorVar}:`);
      expect(generatedCss).toContain(`${visual.colorVar}-foreground:`);
    },
  );

  it('gives each category a distinct color and badge variant', () => {
    const colors = MILESTONE_CATEGORIES.map((c) => milestoneCategoryVisuals[c].colorVar);
    const variants = MILESTONE_CATEGORIES.map((c) => milestoneCategoryVisuals[c].badgeVariant);
    expect(new Set(colors).size).toBe(colors.length);
    expect(new Set(variants).size).toBe(variants.length);
  });

  it('covers every category exactly once, in a stable order', () => {
    expect(MILESTONE_CATEGORIES).toEqual(['MOTOR', 'LANGUAGE', 'SOCIAL', 'PHYSICAL']);
    expect(Object.keys(milestoneCategoryVisuals).sort()).toEqual([...MILESTONE_CATEGORIES].sort());
  });
});
