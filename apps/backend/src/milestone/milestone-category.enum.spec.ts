import { MilestoneCategory, toMilestoneCategory } from './milestone-category.enum';

describe('toMilestoneCategory', () => {
  it.each(Object.values(MilestoneCategory))(
    'passes through the valid category %s unchanged',
    (category) => {
      expect(toMilestoneCategory(category)).toBe(category);
    },
  );

  it('throws on an unknown category', () => {
    expect(() => toMilestoneCategory('COGNITIVE')).toThrow('Invalid MilestoneCategory: COGNITIVE');
  });

  it('throws on a lower-case value', () => {
    expect(() => toMilestoneCategory('motor')).toThrow();
  });
});
