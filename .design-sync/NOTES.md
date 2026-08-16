# design-sync notes for this repo

## Repo shape

- This repo has no standalone "component library" package/build. The design
  system (`apps/frontend/src/components/ui/`) is source living inside the
  full SPA app package (`apps/frontend`, `@baby-tracker/frontend`), whose own
  `build` script produces a whole-app bundle, not a clean library `dist/`.
  `cfg.pkg` is set to a synthetic name (`@baby-tracker/design-system`) —
  there's no real published package by that name, it's just what this sync
  calls the DS subset of `apps/frontend`.
- `--entry` points directly at the TS barrel
  `apps/frontend/src/components/ui/index.ts` (no `dist/` to point at).
- `--node-modules apps/frontend/node_modules` (react/react-dom resolve there
  fine with Bun's install layout — no hoisting fallback needed).

## Required pre-build step: generate `.d.ts` declarations

`apps/frontend/tsconfig.app.json` has `noEmit: true` (Vite handles the real
build, tsc is type-check-only), so there is no `.d.ts` tree anywhere for the
converter's ts-morph-based component/props discovery to read — it found 0
exported components until this was fixed.

Fix (already committed, part of this sync's setup — **must be re-run before
every build**, hence `cfg.buildCmd` below):
1. `apps/frontend/tsconfig.design-sync-types.json` — a declaration-only tsc
   config (`emitDeclarationOnly: true`, `outDir: types`, scoped to
   `src/components/ui/**/*.{ts,tsx}` only, excluding `.spec.tsx`/`.stories.tsx`).
   Run via `cd apps/frontend && npx tsc -p tsconfig.design-sync-types.json`
   — regenerates `apps/frontend/types/` (gitignored, always regenerate, never
   commit).
2. `apps/frontend/package.json` gained a `"types": "types/components/ui/index.d.ts"`
   field — the converter's `.d.ts` entry-resolution (`dts.mjs`'s
   `projectFor`/`findTypesRoot`) reads `pkgJson.types` directly; without it,
   entry resolution falls back to a nonexistent `apps/frontend/index.d.ts`
   and the component-export scan silently returns empty. This is a real,
   intentional, committed change to the app's `package.json` — not a
   session-only hack.

`cfg.buildCmd` (for future re-syncs, run from repo root before the
converter): `cd apps/frontend && rm -rf types && npx tsc -p tsconfig.design-sync-types.json`

## [GENERAL] Story-import duplicate-module bugs (both fixed via config, not code)

Two separate components hit the same root cause class: a story's relative
import gets bundled FRESH into the compiled preview instead of shimmed to
`window.BabyTrackerFrontend`, producing a SECOND, independent module instance
that doesn't share state/context with the one baked into `_ds_bundle.js`.
`story-imports.mjs`'s auto-shim rule only fires for imports resolving to a
**PascalCase-named component** already in the barrel's export set — a
lowercase hook (`useToast`) or an internal, type-only-exported module
(`ToastContext`) never matches that rule and silently gets double-bundled.

- **Toast**: `useToast.ts` (and transitively `ToastContext.ts`, which holds
  the actual `createContext()` call — only its *type* is in the public
  barrel) got bundled twice → two distinct Context objects → `useToast()`
  inside the story's `Demo` component (wrapped in the bundle's real
  `ToastProvider`) threw "must be used within a ToastProvider" even though
  it visually WAS nested correctly. Fixed via
  `cfg.storyImports.shim: ["src/components/ui/useToast.ts", "src/components/ui/ToastContext.ts"]`
  — forces both to resolve through the shared-bundle shim instead of
  bundling fresh.
- **Watch for this again**: any FUTURE component whose story imports a
  lowercase/hook/internal-only module (not a barrel-exported PascalCase
  name) that itself touches component-shared state (context, module-level
  singletons) is a candidate for the same bug. Symptom: a story-only error
  mentioning "must be used within a Provider" or similar, despite the JSX
  clearly nesting correctly.

## [GENERAL] i18n dual-instance bug — preview pipeline only, NOT a real app bug

`EmptyState`'s "Default" story (no explicit `title` prop — relies on the
component's internal `t('ui.emptyState.defaultTitle')` fallback) renders the
**raw i18n key** instead of "Nothing here yet" in the compiled preview.

Root cause: `.storybook/preview.tsx`'s `I18nextProvider` decorator gets
bundled by a SEPARATE pass (`preview-decorators.js`, its own dedicated
esbuild step, log line `preview-decorators.js: bundled from
.storybook/preview.tsx`) that is NOT routed through `story-imports.mjs`'s
shimming at all (it only applies to STORY-file imports, not the decorator
bundle). `react-i18next`/`i18next` are plain `node_modules` packages (not
this repo's own package), so they get bundled independently into BOTH
`_ds_bundle.js` (since `EmptyState.tsx` imports `useTranslation` directly)
AND `preview-decorators.js` — two separate module instances, so
`useTranslation()` inside the compiled `EmptyState` doesn't share React
context with the decorator's `I18nextProvider`, falls back to an
uninitialized `i18next` singleton, and `t()` returns the raw key.

**This does NOT reproduce in the real app** — there's only one bundle, one
`i18next` instance, everywhere. It's specific to this preview-compilation
pipeline (bundle + separately-bundled decorators).

Attempted fix: route `react-i18next`/the app's initialized `i18n` singleton
through `cfg.extraEntries` + `cfg.provider` (the documented path for
provider-needing previews) — abandoned partway: the app's `i18n` module
(`apps/frontend/src/i18n/index.ts`) has only a **default** export, and
`extraEntries`' export-merging is an `export *` re-export, which per ESM
spec never forwards `default` — so the initialized instance can't be
`$ref`'d this way without restructuring the app's own i18n module to add a
named export purely for this sync's benefit. Not worth it for one cosmetic
preview string.

**Resolution taken**: `cfg.overrides.EmptyState.skip:
["components-emptystate--default"]` — the "Default" story's card is
skipped (not uploaded); "With Icon And Description" and "With Action" (both
pass explicit `title`, bypassing the buggy code path) render and grade
correctly and ARE uploaded.

**Re-sync risk**: if a FUTURE component's story relies on `t()` with no
override reaching the compiled bundle, expect the same raw-key symptom. Fix
class options for a real fix (not attempted here, scope-limited): (a) add a
named (non-default) export to `apps/frontend/src/i18n/index.ts` and wire it
through `extraEntries`/`cfg.provider`'s `$ref`, or (b) find/set a converter
option to route third-party (`node_modules`) decorator imports through the
same shim as the main bundle rather than bundling them independently in
`preview-decorators.js`.

## [GENERAL] Also check (not visually gradable, so not caught by compare)

`Toast`'s dismiss button and `Dialog`'s close button use
`t('ui.toast.dismiss')`/`t('ui.dialog.close')` for their **`aria-label`**
only (icon-only buttons, no visible text) — these likely hit the exact same
i18n dual-instance bug described above, but it's invisible to pixel-based
screenshot grading (screen-reader-only content). Not confirmed broken, not
confirmed fine — worth a manual accessibility-tree check next time someone's
in this pipeline, since a broken aria-label in the PREVIEW doesn't affect
the real app either way.

## Critical, unrelated bug found and fixed during this sync (real app, not preview-only)

`design-system/scripts/build-tokens.ts`'s generated `@theme inline` block
used the SAME custom-property name on both sides for every color, spacing,
radius, shadow, and font-weight token (e.g. `--color-muted: var(--color-muted)`).
Tailwind v4 still emits a `:root,:host` companion snapshot for `@theme
inline` entries (contrary to what the ADR-0013 implementer assumed when
choosing `inline` specifically to avoid this) — with equal selector
specificity and later source order, that companion's self-referencing
declaration WINS the cascade over the real value declared earlier in the
same file, making the custom property invalid at computed-value time
(resolves to nothing: `background-color` → transparent, `border-radius` → 0,
etc.) **everywhere in the real, shipped app**, not just in design-sync
previews. Confirmed via a real `vite preview` + Playwright computed-style
check before AND after the fix. Went undetected until now because Phase 6
M1 deliberately migrates no existing screen onto these tokens yet — nothing
in the actual running app visibly used `bg-primary`/`bg-muted`/etc. before
this sync's Storybook build became the first real consumer.

Fix: renamed the raw/source custom properties for colors to `--rt-color-*`
(distinct from Tailwind's `--color-*` theme names, matching the
distinct-name pattern in Tailwind's own docs for exactly this case:
"Referencing other variables with @theme inline"), and switched
spacing/radii/shadows/font-weight (which have no runtime-varying override
to reference at all) from self-referencing `var()` indirection to plain
literal values in the `@theme` block. See the commit fixing
`design-system/scripts/build-tokens.ts` for the full diff and updated
comments. Regenerated `tokens.generated.css`/`tokens.md`/
`eventTypeTokens.generated.ts` are included in that commit.

## Accepted substitutes / known non-blocking warnings

- **`[FONT_MISSING]` "Avenir"**: `system-ui, Avenir, Helvetica, Arial, sans-serif`
  is the Vite React template's default OS-native font stack, not a
  deliberately-bundled brand font — Avenir ships with macOS/iOS, nothing to
  package. Accepted as-is; the DS pane renders with a system-font fallback
  for non-Apple platforms, which is the correct/intended behavior for this
  stack (there was never an intent to ship this font).

## Re-sync risks (read this before the next sync)

- **Must re-run `cfg.buildCmd` (the tsc declaration step) before the
  converter build** — `apps/frontend/types/` is gitignored/regenerated, not
  committed. Skipping this reproduces the "0 components discovered" failure
  from this sync's first attempt.
- **EmptyState's "Default" story stays skipped indefinitely** until someone
  actually fixes the i18n dual-instance issue (see above) — don't be
  surprised it's missing from the DS pane; it's deliberate, not a
  regression.
- **The `useToast`/`ToastContext` shim list in `cfg.storyImports.shim` is
  brittle to refactors** — if `ToastContext.ts`/`useToast.ts` get renamed or
  moved, or a NEW hook/internal-module gets a similar cross-context need
  (see the `[GENERAL]` note above), the shim list needs a matching update or
  the same "must be used within a Provider" class of error returns.
  Symptom-driven, not something the converter can detect proactively.
  Fixed in `design-system/scripts/build-tokens.ts`, so this is not a
  re-sync risk — the bug was in a source file, not this sync's config.
- **Toast/Dialog aria-label i18n** (see above) is an open, unverified
  question — not blocking, but flag it if anyone does an accessibility pass
  on the design-sync previews specifically (again: NOT the real app, which
  is unaffected).
- **No Storybook a11y-addon findings were reviewed as part of this sync** —
  `@storybook/addon-a11y` is configured but this sync's grading was purely
  visual (storybook-vs-preview pixel comparison), not an accessibility
  audit.
