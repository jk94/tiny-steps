import { describe, expect, it } from 'vitest';
import i18n from './index';

describe('i18n config', () => {
  it('falls back to German', () => {
    expect(i18n.options.fallbackLng).toEqual(['de']);
  });

  it('supports German and English', () => {
    expect(i18n.options.supportedLngs).toEqual(expect.arrayContaining(['de', 'en']));
  });

  it('resolves German copy for a known key regardless of the active language', () => {
    expect(i18n.getFixedT('de')('common.loading')).toBe('Lädt…');
  });

  it('returns the raw key for a missing/typo’d key', () => {
    // Deliberately an unknown key, to assert the (unconfigured, default)
    // missing-key fallback behavior — cast past the typed-keys guard rails
    // that would otherwise reject this call at compile time.
    expect(i18n.t('does.not.exist' as never)).toBe('does.not.exist');
  });

  it('falls back to the German bundle for a key missing only from the active (English) bundle', async () => {
    // Add a key that only exists in the `de` bundle, then look it up while
    // `en` is active — proves the `fallbackLng: 'de'` chain resolves it to
    // the German string rather than returning the raw key. Cast past the
    // typed-keys guard rails since this key isn't part of the real,
    // committed resource shape.
    i18n.addResourceBundle(
      'de',
      'translation',
      { testOnly: { deOnlyKey: 'Nur Deutsch' } },
      true,
      true,
    );

    await i18n.changeLanguage('en');

    expect(i18n.t('testOnly.deOnlyKey' as never)).toBe('Nur Deutsch');
  });
});
