import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto'; // side-effect: jsdom has no native IndexedDB; the offline layer (woven into component/page specs via the optimistic adapters) needs one
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '../i18n'; // side-effect: initializes the i18next singleton — nothing else in the test import graph does this, since no test imports main.tsx
import i18n from '../i18n';

// jsdom implements no `matchMedia` at all, but anything that reacts to
// `prefers-color-scheme` calls it on mount (e.g. the Sonner-backed `Toaster`,
// which follows the OS color scheme). Report "no media query matches", i.e.
// the light/default branch — the same branch the generated color tokens fall
// back to. Registered globally rather than per-spec because it is missing
// browser plumbing, not per-test behavior (same rationale as fake-indexeddb).
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList => ({
    media: query,
    matches: false,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
    // Deprecated pre-EventTarget API, still called by some libraries.
    addListener: () => {},
    removeListener: () => {},
  });
}

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
