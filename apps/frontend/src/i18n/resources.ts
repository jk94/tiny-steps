import de from './locales/de.json';
import en from './locales/en.json';

/**
 * Single source of truth for both `i18next.init()`'s `resources` option and
 * the `CustomTypeOptions` type augmentation in `i18next.d.ts` — importing
 * both from the same object means the runtime resources and the compile-time
 * key types can never drift independently of each other.
 */
export const resources = {
  de: { translation: de },
  en: { translation: en },
} as const;
