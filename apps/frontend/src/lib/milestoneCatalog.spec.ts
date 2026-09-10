import { describe, expect, it } from 'vitest';
import de from '../i18n/locales/de.json';
import {
  MILESTONE_TEMPLATES,
  getTemplateEntry,
  groupTemplatesByAgeBucket,
} from './milestoneCatalog';

describe('MILESTONE_TEMPLATES', () => {
  it('holds 20 templates with unique keys', () => {
    const keys = MILESTONE_TEMPLATES.map((entry) => entry.key);
    expect(keys).toHaveLength(20);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('states an ordered age span within the first three years for every entry', () => {
    for (const { typicalAgeMonths } of MILESTONE_TEMPLATES) {
      const [min, max] = typicalAgeMonths;
      expect(min).toBeLessThan(max);
      expect(min).toBeGreaterThanOrEqual(0);
      expect(max).toBeLessThanOrEqual(36);
    }
  });

  it('has a German label for every key (M-2)', () => {
    // The catalog is useless without its translations, and a missing key would
    // otherwise surface only as a raw `milestone.templates.FOO` on screen.
    const labels = (de as { milestone: { templates: Record<string, string> } }).milestone.templates;
    for (const { key } of MILESTONE_TEMPLATES) {
      expect(labels[key]).toBeTruthy();
    }
    // And no orphaned translations for templates that no longer exist.
    expect(Object.keys(labels).sort()).toEqual(MILESTONE_TEMPLATES.map((e) => e.key).sort());
  });
});

describe('getTemplateEntry', () => {
  it('resolves a known key', () => {
    expect(getTemplateEntry('FIRST_STEPS')).toEqual({
      key: 'FIRST_STEPS',
      category: 'MOTOR',
      typicalAgeMonths: [11, 16],
    });
  });

  it('returns undefined for a key this build does not know', () => {
    // A stored milestone may carry a key from a newer release; its own frozen
    // title still renders, so this must not throw.
    expect(getTemplateEntry('FROM_THE_FUTURE')).toBeUndefined();
  });
});

describe('groupTemplatesByAgeBucket', () => {
  it('places every template in exactly one bucket', () => {
    const grouped = groupTemplatesByAgeBucket();
    const keys = grouped.flatMap((group) => group.templates.map((entry) => entry.key));

    expect(keys).toHaveLength(MILESTONE_TEMPLATES.length);
    expect(new Set(keys).size).toBe(MILESTONE_TEMPLATES.length);
  });

  it('sorts the templates inside a bucket by their lower bound', () => {
    for (const { templates } of groupTemplatesByAgeBucket()) {
      const lowerBounds = templates.map((entry) => entry.typicalAgeMonths[0]);
      expect(lowerBounds).toEqual([...lowerBounds].sort((a, b) => a - b));
    }
  });

  it('groups by the lower bound, so a wide span appears where a parent first looks', () => {
    const grouped = groupTemplatesByAgeBucket();
    // FIRST_TOOTH spans 4–10 months and belongs to the 0–6 bucket, not 6–12.
    const firstBucket = grouped[0];
    expect(firstBucket.templates.map((entry) => entry.key)).toContain('FIRST_TOOTH');
  });
});
