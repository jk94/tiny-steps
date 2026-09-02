import { MilestoneTemplate, isMilestoneTemplate, toMilestoneTemplate } from './milestone-template.enum';

describe('toMilestoneTemplate', () => {
  it.each(Object.values(MilestoneTemplate))('passes through the valid key %s unchanged', (key) => {
    expect(toMilestoneTemplate(key)).toBe(key);
  });

  it('throws on an unknown key', () => {
    expect(() => toMilestoneTemplate('SLEEPS_THROUGH_THE_NIGHT')).toThrow(
      'Invalid MilestoneTemplate: SLEEPS_THROUGH_THE_NIGHT',
    );
  });

  it('throws on a lower-case key', () => {
    expect(() => toMilestoneTemplate('first_smile')).toThrow();
  });

  it('throws on an empty string', () => {
    // A free entry is `null` on the column, never an empty string, so an empty
    // value reaching here is corrupted data rather than "no template".
    expect(() => toMilestoneTemplate('')).toThrow();
  });
});

describe('isMilestoneTemplate', () => {
  it('accepts a catalog key and rejects anything else', () => {
    expect(isMilestoneTemplate(MilestoneTemplate.FIRST_STEPS)).toBe(true);
    expect(isMilestoneTemplate('FIRST_STEP')).toBe(false);
  });
});
