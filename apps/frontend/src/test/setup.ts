import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

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
