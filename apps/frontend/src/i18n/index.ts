import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { resources } from './resources';
// `i18next.d.ts` augments the `i18next` module's `CustomTypeOptions` (typed
// `t()` keys) purely at the type level — TypeScript picks it up because it's
// part of the `src` program (see `tsconfig.app.json`'s `include`), no
// runtime import needed.

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'de',
    supportedLngs: ['de', 'en'],
    load: 'languageOnly', // resolves de-AT/en-GB etc. to de/en cleanly
    interpolation: { escapeValue: false }, // React already escapes
    react: { useSuspense: false }, // resources are bundled statically + detector is synchronous, so init completes before first paint in practice; this guarantees it structurally rather than relying on timing
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'babyTracker.language', // custom key name purely for readability alongside this app's other storage usage, not a functional requirement
    },
  });

export default i18next;
