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

- **Toast** (obsolete since 2026-08-18 — kept for the general lesson below):
  `useToast.ts` (and transitively `ToastContext.ts`, which holds the actual
  `createContext()` call — only its *type* is in the public barrel) got
  bundled twice → two distinct Context objects → `useToast()` inside the
  story's `Demo` component (wrapped in the bundle's real `ToastProvider`)
  threw "must be used within a ToastProvider" even though it visually WAS
  nested correctly. Was fixed via `cfg.storyImports.shim:
  ["src/components/ui/useToast.ts", "src/components/ui/ToastContext.ts"]`.
  The hand-built `ToastProvider`/`useToast`/`ToastContext` trio (and this
  shim entry) no longer exist — Sonner's `<Toaster />` replaced them (see
  the `[GENERAL] sb-error on a … zero-size portal container` note below for
  what replaced this as Toast's current gotcha).
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

## [GENERAL] `sb-error` on a component whose root child is a zero-size portal container (2026-08-18)

The Radix/Sonner migration (ADR-0013 addendum) replaced the hand-built
`ToastProvider`/`useToast` pair with Sonner's `<Toaster />` — this dropped
`useToast.ts`/`ToastContext.ts` from the repo entirely (both deleted), so
the `cfg.storyImports.shim` entries for them were removed from
`.design-sync/config.json` as dead config.

The new `Toaster.stories.tsx`'s only story (`Playground`) captured as
`sb-error: "no storybook root content"` against the freshly-rebuilt
reference storybook. Root-caused via a direct Playwright probe (not a
config/build problem): Sonner renders `<section aria-label="Notifications
…">` as the **first** child of `#storybook-root`, and that section always
measures 0×0 in the layout box — its actual toast list is `position: fixed`
and escapes the section's own box entirely (portal-style, without an actual
DOM portal). `compare.mjs`'s `SB_CONTENT` selector
(`:is(#storybook-root, #root) > :not(style,script,link,meta,template)`)
locks onto this first match and waits for it to become Playwright-"visible"
(non-zero bounding box), which it never does — even confirmed with an
auto-firing toast added experimentally to the story (reverted — it didn't
help, see below) and 15×300ms polling proving a real `[data-sonner-toast]`
node exists in the DOM for ~4s while the *section* itself stays 0×0 the
whole time.

This is the same root-cause CLASS as the already-documented `[PORTAL?]`
overlay-bleed issue (§4a.5), just surfacing one stage earlier — during the
**reference storybook capture**, not the product-card grid. `cardMode`
doesn't apply here since it only affects the product card, not the sb-side
capture check, and there's no `cfg` knob for the `SB_CONTENT` selector
(compare.mjs is explicitly the never-forked oracle).

**Tried and reverted**: added a `useEffect(() => toast(...), [])` to the
story's `Demo` component so a toast fires on mount unconditionally. This DID
render a real toast (confirmed via polling) but the *section* remained 0×0
throughout regardless — the fix doesn't address the actual check, and it
would have shipped an unsolicited toast firing every time a real developer
opens this story in the team's own Storybook. Reverted; do not retry this
angle without first understanding it doesn't touch what `waitForSelector`
actually measures.

**Resolution taken**: `cfg.overrides.Toaster.skip:
["components-toaster--playground"]` — the story is skipped from
compare/grading. `Toaster` ships via the floor/fallback card (see
`Toaster.html`'s `dsFallback()`) pointing the design agent at
`Toaster.d.ts`/`Toaster.prompt.md` instead of a live render. Real usage
(the `toast()`/`toast.success()`/etc. functions from `sonner`, not a prop on
`<Toaster>`) is documented in `.design-sync/conventions.md` instead, since
there's no visual to show it.

**Watch for this again**: any FUTURE component whose root render is an
aria-live/notification/toast-style landmark with `position: fixed`
descendants (not a true React portal — those already work fine, e.g.
Dialog/Select render via `document.body` portals and aren't affected) will
hit the same `sb-error` and need the same `skip` treatment.

## Accepted substitutes / known non-blocking warnings

- **`border-primary` utility class**: named in `conventions.md`'s class
  table, consistent with the sibling `bg-primary`/`text-primary`/
  `text-primary-foreground` (all confirmed present in the compiled
  `_ds_bundle.css`) and backed by the same real `--color-primary` token —
  but no scanned component currently applies a bare `border-primary`, so
  Tailwind v4's JIT never emits the standalone utility rule in this build
  (only modifier variants like `border-primary:hover` appear, from other
  components). Left in the conventions doc since the vocabulary is
  legitimate and would compile the moment anything uses it; flagging here
  per the "documented in source but absent from the build" case rather than
  cutting a valid class name.

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
- **`Toaster`'s only story stays skipped indefinitely** — see the
  `[GENERAL]` note above (zero-size portal-style container, not a config or
  build problem). `Toaster` ships with zero visual example; the design agent
  learns its usage entirely from `conventions.md` + `Toaster.prompt.md`. If
  a future sync tries to fix this, know that firing a toast on mount does
  NOT help (already tried, reverted) — the fix would need either a
  `cfg`-level change to `compare.mjs`'s `SB_CONTENT` visibility check (it's
  the never-forked oracle, so this needs an actual skill/converter change,
  not a repo-side config knob) or accepting the skip permanently.
- **`Toast/Dialog aria-label i18n`** open question from the old hand-built
  Toast is now moot — Toast/`useToast`/`ToastContext` no longer exist
  (replaced by `Toaster`/Sonner). Sonner's own dismiss button carries a
  translated `aria-label` (`t('ui.toast.dismiss')`, wired in `Toaster.tsx`)
  — same unverified-but-not-blocking status as before, just on the new
  component.
- **Button is capped at 6 stories by `compare.mjs`'s default** — it has 8
  (`AsChildLink`, `Sizes` are the tail two). Always pass `--max-stories 8`
  (or higher, if a future story is added) on the driver/compare invocation,
  or `[STORY_CAP]` silently leaves those two ungraded this run — the next
  sync's carry-forward wouldn't catch that they were never actually judged
  from images.
- **`Select`, `Dialog`, `EmptyState` overrides carry forward from before**
  (`cardMode: "column"`, story `skip`s) — still valid, re-verified this
  sync, no action needed.
- **`Dialog`'s "Controlled" story only ever shows the closed trigger
  button** — `isOpen` defaults `false` and there's no `play` function, so
  the actual dialog content (title/body/footer, the interesting part,
  especially post-`ConfirmDialog`-fold) is never captured. Both sides render
  identically (closed button), so it grades `match`, but it's a real
  documentation gap — the design agent never sees an open Dialog. Worth a
  `play`-function or default-open story if someone revisits this DS's
  Storybook for its own sake (not just for design-sync).
- **No Storybook a11y-addon findings were reviewed as part of this sync** —
  `@storybook/addon-a11y` is configured but this sync's grading was purely
  visual (storybook-vs-preview pixel comparison), not an accessibility
  audit.
