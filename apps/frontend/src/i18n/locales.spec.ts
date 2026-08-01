import { describe, expect, it } from 'vitest';
import de from './locales/de.json';
import en from './locales/en.json';

/**
 * TypeScript's `CustomTypeOptions` augmentation (`i18next.d.ts`) only checks
 * `t()` calls against `de.json`'s shape (the first language listed in
 * `resources.ts`), so a key present in `de.json` but missing (or misspelled)
 * in `en.json` — or vice versa — is NOT caught by the compiler. This test is
 * the actual safety net for that: it fails if the two locale files' key
 * paths diverge in either direction.
 */
function collectKeyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) {
    return [prefix];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
    collectKeyPaths(nested, prefix ? `${prefix}.${key}` : key),
  );
}

describe('locale key parity', () => {
  it('de.json and en.json declare exactly the same set of keys', () => {
    const deKeys = collectKeyPaths(de).sort();
    const enKeys = collectKeyPaths(en).sort();

    const onlyInDe = deKeys.filter((key) => !enKeys.includes(key));
    const onlyInEn = enKeys.filter((key) => !deKeys.includes(key));

    expect(onlyInDe).toEqual([]);
    expect(onlyInEn).toEqual([]);
  });
});
