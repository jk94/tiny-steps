import de from './de.json';
import en from './en.json';
import { format, getReportStrings } from './report-i18n';

describe('report i18n catalog', () => {
  it('defines exactly the same keys in every language', () => {
    // A key present in only one language would render as the raw key in a PDF
    // — visible, but only to whoever generated that one report.
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
  });

  it('has no empty strings', () => {
    for (const catalog of [de, en]) {
      const empty = Object.entries(catalog)
        .filter(([, value]) => value.trim() === '')
        .map(([key]) => key);
      expect(empty).toEqual([]);
    }
  });

  it('uses the same placeholders in both languages', () => {
    const placeholders = (value: string): string[] =>
      [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();

    const mismatched = (Object.keys(de) as (keyof typeof de)[]).filter(
      (key) => placeholders(en[key]).join() !== placeholders(de[key]).join(),
    );
    expect(mismatched).toEqual([]);
  });
});

describe('format', () => {
  it('substitutes every placeholder', () => {
    expect(format('{{a}} and {{b}}', { a: 'one', b: 2 })).toBe('one and 2');
  });

  it('leaves a placeholder with no value untouched rather than blanking it', () => {
    expect(format('{{a}} and {{b}}', { a: 'one' })).toBe('one and {{b}}');
  });
});

describe('getReportStrings', () => {
  it('resolves the requested language', () => {
    expect(getReportStrings('de').t('section.growth')).toBe('Wachstum');
    expect(getReportStrings('en').t('section.growth')).toBe('Growth');
  });

  it('falls back to German for a language it has no catalog for', () => {
    const strings = getReportStrings('fr');

    expect(strings.locale).toBe('de');
    expect(strings.t('section.milestones')).toBe('Meilensteine');
  });

  it('interpolates values into the resolved string', () => {
    expect(getReportStrings('en').t('document.title', { childName: 'Mila' })).toBe(
      'Report for Mila',
    );
  });

  it('selects the singular or plural variant from a count', () => {
    const strings = getReportStrings('de');

    expect(strings.t('age.months', { count: 1 })).toBe('1 Monat');
    expect(strings.t('age.months', { count: 5 })).toBe('5 Monate');
    expect(getReportStrings('en').t('age.years', { count: 1 })).toBe('1 year');
    expect(getReportStrings('en').t('age.years', { count: 2 })).toBe('2 years');
  });
});
