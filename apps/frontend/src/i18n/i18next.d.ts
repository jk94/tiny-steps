import 'i18next';
import { resources } from './resources';

// Classic module augmentation via `CustomTypeOptions` (not the newer
// selector-based `t($ => $.a.b.c)` API — that would change every call
// site's shape for no proportional benefit at this app's size). This gives
// compile-time errors on typo'd/missing keys via the ordinary
// `t('a.b.c')` string call.
//
// NOTE: TypeScript only checks against `de.json`'s shape here (the first
// language in `resources`), so a mismatch in `en.json` alone is NOT caught
// by the compiler — see `locales.spec.ts` for the runtime key-parity test
// that covers that gap.
//
// `resources` here must be namespace-keyed (`{ translation: <keys> }`), not
// the bare keys object — the installed i18next version's `t()` overload
// resolution reads `CustomTypeOptions['resources']` as a namespace map (see
// its own JSDoc example in `typescript/options.d.ts`), so a plain
// `(typeof resources)['de']['translation']` here is misinterpreted as one
// namespace per top-level key (e.g. `"common:loading"`) rather than dotted
// paths within the single `translation` namespace.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: (typeof resources)['de']['translation'] };
  }
}
