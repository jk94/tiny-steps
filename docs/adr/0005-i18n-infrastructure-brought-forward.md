# ADR-0005: i18n infrastructure (German/English), brought forward from Phase 7

## Status

Accepted

## Context

PRD section 4.2 places "Mehrsprachigkeit" (multi-language support) under Version 2.0, i.e.
explicitly post-MVP. [Roadmap Phase 7](../roadmap/phase-7-v2-erweiterungen.md) breaks that into three
sub-items: i18n infrastructure, translating the existing UI text, and a language switcher in user
settings.

During Phase 1 frontend planning — after the foundation sub-step (HTTP client, auth state, protected
routes, TanStack Query, Vitest test infra) — the user explicitly chose to bring the *infrastructure*
piece (and the migration of the currently tiny existing UI surface) forward to run immediately before
the next sub-step (local login/registration UI). This was a deliberate scope decision, made after
being shown that it was scope being pulled forward rather than scope creep discovered mid-task: doing
it now, while the UI surface is still minimal (a handful of strings across `LoadingIndicator`,
`Layout`, `Dashboard`), is far cheaper than retrofitting i18n across a much larger UI later. The
login/registration UI, OIDC provider buttons, household management, and child profile management UIs
are explicitly out of scope for this sub-step — this is infrastructure only, consumed by those UIs as
they're built.

This sub-step is frontend-only. i18n here means UI copy; it does not include backend locale
negotiation, `Accept-Language` handling, or any change to API responses.

## Decision

### 1. Library: `react-i18next` + `i18next` + `i18next-browser-languagedetector`

Verified against the npm registry and Context7 at decision time: `i18next@26.3.6`,
`react-i18next@17.0.11` (peers on `i18next >=26.2.0`, `react >=16.8.0` — compatible with this app's
React 19.2), `i18next-browser-languagedetector@8.2.1`.

**Alternatives considered and rejected:**

- **`react-intl` / FormatJS.** A capable, widely used alternative, but its API centers on ICU
  MessageFormat and a heavier `<FormattedMessage>` component-per-string style. For this app's needs
  (plain UI copy, no complex pluralization/ICU formatting yet) it's more machinery than the problem
  calls for, and would mean a second idiom (components vs. a `t()` call) alongside the rest of the
  codebase's hook-based style.
- **LinguiJS.** Compile-step-based extraction (macros, a build/CLI step to extract and compile
  catalogs) is a good fit for larger teams/apps with translator tooling, but adds build complexity
  disproportionate to this app's current ~10-key surface.
- **Hand-rolled solution** (a plain `Record<Locale, Record<string, string>>` plus a context
  provider). Would need to reinvent language detection/persistence, missing-key fallback behavior,
  and live re-render-on-language-change — all of which `react-i18next`/`i18next` already provide,
  tested and maintained. Rejected as unnecessary reinvention for no benefit at this app's scale.

### 2. Languages: German (`de`) default/fallback, English (`en`) secondary

Matches the PRD/roadmap being written in German as the primary product language, while keeping
English available from the start (both are fully populated for every key introduced in this
sub-step, not just German-first-then-backfilled-later).

### 3. File structure: one flat file per language, default namespace only

`src/i18n/locales/de.json` / `en.json`, both using i18next's default `translation` namespace —
**not** split by feature namespace. Namespace-per-feature is a reasonable structure once a
translation file gets unwieldy (roughly 150–200 keys is the trigger point noted here for a future
refactor), but at this sub-step's ~10 keys, splitting now would add indirection with no present
benefit. **Documented future-refactor trigger**: revisit namespace splitting once either locale file
approaches ~150–200 keys.

### 4. Key naming: dot-nested, `<area>.<element>`, grouped by owning component/screen

E.g. `common.loading`, `nav.dashboardLink`, `layout.logoutButton`, `dashboard.title`,
`dashboard.description`, `language.switchToGerman`, `language.switchToEnglish`. Keeps each key's
owner obvious from its prefix without needing a namespace split yet.

### 5. Combined resources module (`src/i18n/resources.ts`)

Imports both JSON files and exports a single `resources` object, shaped for direct use both by
`i18next.init()`'s `resources` option and by the `i18next.d.ts` type augmentation (see below) — so
the two can never independently drift out of sync (e.g. one importing a stale copy of the JSON).

### 6. Type safety: classic `CustomTypeOptions` module augmentation, not the selector API

`src/i18n/i18next.d.ts` augments `i18next`'s `CustomTypeOptions` with the resource shape, giving
compile-time errors on typo'd/missing keys via the ordinary `t('a.b.c')` string-literal call site.

**Rejected: the newer selector-based `t($ => $.a.b.c)` API.** More recent `i18next`/`react-i18next`
versions support a selector-function form of `t()` for full type-narrowing without string-literal
key matching. It was rejected here because it would change the shape of *every* `t()` call site in
the codebase (present and future) for a benefit that isn't proportionate at this app's key-count —
plain string-literal keys checked via `CustomTypeOptions` already catch the realistic error class
(typos, renamed/removed keys) with a far more familiar call-site shape.

**A real gap in this approach, verified while implementing it**: `CustomTypeOptions['resources']`
is checked against `de.json`'s shape only (the first language object references, since it's a single
shared type declaration, not one per language) — so a key present in `de.json` but missing (or
misspelled) in `en.json`, or vice versa, is **not** caught by the TypeScript compiler. This is why an
automated key-parity test (`src/i18n/locales.spec.ts`) exists as the actual safety net for the JSON
content itself: it recursively diffs both files' key paths and fails on any one-sided key.

One implementation subtlety worth recording: `CustomTypeOptions['resources']` must be namespace-keyed
(`{ translation: <keys> }`), not the bare keys object directly — the installed i18next version's
`t()` overload resolution reads it as a namespace map (documented in its own shipped
`typescript/options.d.ts` JSDoc example). Passing the bare keys object directly is silently
misinterpreted as one namespace per top-level key (e.g. producing a `"common:loading"`-shaped type
instead of `"common.loading"`), rather than failing to compile — worth flagging explicitly since it's
easy to get subtly wrong and have it look like it type-checks fine for the *first* few keys tried.

### 7. Detection and persistence: `i18next-browser-languagedetector`, `localStorage`-backed

`fallbackLng: 'de'`, `supportedLngs: ['de', 'en']`, `load: 'languageOnly'` (so `de-AT`/`en-GB` etc.
resolve cleanly to `de`/`en`), detector order `['localStorage', 'navigator']` with
`caches: ['localStorage']` — the detector's own standard, built-in persistence mechanism, not a
hand-rolled one. The `localStorage` key is named `babyTracker.language` purely for readability
alongside this app's other storage usage, not a functional requirement.

`react: { useSuspense: false }` is set structurally, not as a timing workaround: resources are
bundled statically (no async fetch) and the detector resolves synchronously, so init reliably
completes before first paint — `useSuspense: false` just makes that a guarantee rather than an
implicit assumption.

### 8. No new React context provider

`react-i18next`'s `useTranslation()` falls back to the global `i18next` singleton automatically once
it's initialized — no `<I18nextProvider>` is needed given this app already only has one i18next
instance. `src/i18n/index.ts` (the config/init module) is imported once, as a side effect, at the top
of `src/main.tsx`, before `createRoot(...).render(...)`. The existing
`QueryClientProvider > BrowserRouter > AuthProvider > App` provider nesting is unchanged.

### 9. Minimal language switcher, placed in `Layout.tsx` as a placeholder

Two small buttons in the shared app-shell header, calling `i18n.changeLanguage('de')` /
`i18n.changeLanguage('en')`, with `aria-label`s sourced from `language.switchToGerman` /
`language.switchToEnglish`. Retrieved via `useTranslation()`'s returned `i18n` object rather than
importing the singleton directly in the component, for consistency with how the rest of the component
tree consumes i18n.

This is explicitly a **placeholder** — it belongs in a real settings area once one exists (tracked
under Phase 7's "Sprachumschaltung in den Nutzereinstellungen" item, which stays open; no settings
screen exists yet). It lives in `Layout.tsx` for now purely because that's the only screen every route
currently shares.

### 10. Testing convention: pin test language to English, keep asserting literal text

`src/test/setup.ts` side-effect-imports the i18n config module (nothing else in the test import graph
does, since no test imports `main.tsx`) and resets the active language to `'en'` in a global
`beforeEach`. Existing specs that assert literal English copy (`App.spec.tsx`,
`ProtectedRoute.spec.tsx`, `LoadingIndicator.spec.tsx`, `Layout.spec.tsx`) needed **zero textual
changes** as a result, since the English JSON copy was written to match the previously-hardcoded
strings verbatim.

Component tests keep asserting rendered text (not `data-testid`/role-only) deliberately: a
testid-only assertion would miss the real bug class this migration introduces — a typo'd or
misrouted translation key resolving to the wrong (or raw-key) string while the element's role/testid
stays correct.

## Consequences

**This changes the definition of done for all future frontend work.** Starting with the very next
sub-step (local login/registration UI), new user-facing copy must go through `useTranslation()`/the
resource files (`src/i18n/locales/{de,en}.json`) — not hardcoded JSX text. Any reviewer should treat a
hardcoded user-facing string introduced after this ADR as a regression against this decision, not a
style nitpick.

**Positive:**

- Both languages are fully populated for every key from day one; no partially-translated UI state to
  manage.
- Typo'd/renamed keys are caught at compile time for the common case (`de.json`'s shape via
  `CustomTypeOptions`), with the JSON-content gap (`en.json` alone) covered by a fast, dependency-free
  runtime test (`locales.spec.ts`).
- No new React provider/context, so the existing provider nesting in `main.tsx` and every
  component's props/context surface are untouched.

**Negative / accepted trade-offs:**

- As noted in point 6 above, TypeScript's compile-time key checking only covers `de.json`'s shape —
  `en.json`-only mistakes rely entirely on the `locales.spec.ts` test being run (i.e. on CI/local test
  execution, not on `tsc` alone).
- The language switcher's current placement in `Layout.tsx` is a known placeholder with no long-term
  home yet; it will need to move once a real settings screen exists (tracked, unchanged, under Phase
  6).
- Flat, un-namespaced translation files will need revisiting once either locale file's key count
  approaches roughly 150–200 keys (see point 3 above) — not a problem yet, but a known, documented
  future refactor.

## Related

- [Phase 7 roadmap](../roadmap/phase-7-v2-erweiterungen.md) — "Mehrsprachigkeit", the original,
  post-MVP home of this work; its infrastructure and existing-UI-text sub-items are marked done here,
  ahead of the rest of Phase 7.
- [Phase 1 roadmap](../roadmap/phase-1-auth-multiuser.md) — where this sub-step actually landed,
  ahead of the local login/registration UI sub-step.
- `apps/frontend/src/i18n/` — implementation (`index.ts`, `resources.ts`, `i18next.d.ts`,
  `locales/de.json`, `locales/en.json`).
- `apps/frontend/src/i18n/locales.spec.ts` — the key-parity test covering the gap noted in point 6.
- `apps/frontend/src/components/Layout.tsx` — the placeholder language switcher.
