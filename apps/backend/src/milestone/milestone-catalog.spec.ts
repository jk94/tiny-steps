import { MILESTONE_CATALOG, getMilestoneCatalogEntry } from './milestone-catalog';
import { MilestoneTemplate } from './milestone-template.enum';

describe('MILESTONE_CATALOG', () => {
  it('covers every template key exactly once', () => {
    const keys = MILESTONE_CATALOG.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.slice().sort()).toEqual(Object.values(MilestoneTemplate).slice().sort());
  });

  it('states a plausible, ordered age span for every entry', () => {
    for (const { key, typicalAgeMonths } of MILESTONE_CATALOG) {
      const [min, max] = typicalAgeMonths;
      expect(min).toBeLessThan(max);
      expect(min).toBeGreaterThanOrEqual(0);
      // The catalog is scoped to the first three years (M-2).
      expect(max).toBeLessThanOrEqual(36);
      expect(key).toBeTruthy();
    }
  });
});

describe('getMilestoneCatalogEntry', () => {
  it('resolves a key to its category and age span', () => {
    expect(getMilestoneCatalogEntry(MilestoneTemplate.FIRST_STEPS)).toEqual({
      key: MilestoneTemplate.FIRST_STEPS,
      category: 'MOTOR',
      typicalAgeMonths: [11, 16],
    });
  });

  it('throws when the enum and the catalog have drifted apart', () => {
    expect(() => getMilestoneCatalogEntry('NOT_IN_CATALOG' as MilestoneTemplate)).toThrow(
      'Missing milestone catalog entry for template: NOT_IN_CATALOG',
    );
  });
});
