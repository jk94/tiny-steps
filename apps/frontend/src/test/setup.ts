import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '../i18n'; // side-effect: initializes the i18next singleton — nothing else in the test import graph does this, since no test imports main.tsx
import i18n from '../i18n';

// `globals: false` (see vitest.config.ts) means Testing Library's automatic
// afterEach-cleanup detection doesn't kick in, since it relies on
// `afterEach` being a true global — register it explicitly so components
// rendered/mounted by one test file's tests don't leak into the next test
// (unmounted components would otherwise keep their query/context
// subscriptions alive, e.g. against the module-level `queryClient`
// singleton).
afterEach(() => {
  cleanup();
});

// Pin the active test language to English so existing specs can keep
// asserting literal rendered text with zero textual changes. Without this,
// `useTranslation()` would pick up whatever `i18next-browser-languagedetector`
// resolves in jsdom (its default is `en-US`, so this is mostly a safety net
// against future detector/config changes drifting the default silently).
beforeEach(async () => {
  await i18n.changeLanguage('en');
});
