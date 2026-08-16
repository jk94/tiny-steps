# ADR-0013: Tailwind CSS v4 + cva + native-element primitives as the design-system styling approach

## Status

Accepted

## Context

[Phase 6's roadmap](../roadmap/phase-6-design-system-ux.md) introduces the project's first design
system. The existing UI (Phases 0–5) is functionally complete but visually raw: there is no styling
framework, no shared color/typography/spacing scale, and no reusable UI primitives — confirmed by the
`// no UI kit in this project yet` comments in `apps/frontend/src/components/ErrorMessage.tsx` and
`LoadingIndicator.tsx`, and by `docs/known-issues.md`'s "No shared UI primitives / design system
layer" entry. Only `apps/frontend/src/styles/breakpoints.css` exists for styling.

Phase 6 is deliberately split into milestones; this ADR covers **M1 only** — the foundation (design
tokens, a `apps/frontend/src/components/ui/` primitives library, Storybook, and a platform-agnostic
Markdown styleguide). M1 explicitly does **not** migrate any existing screen onto the new system;
that is M2/M3. Phase 6 changes no data models, API contracts, or business logic — it is pure
presentation-layer work.

Two constraints from the existing codebase shape the decision:

- **The app ships inside a Capacitor WebView** (see [ADR-0012](0012-capacitor-native-wrapper.md)), so
  CSS/JS bundle size has a real, if modest, cost on mobile.
- **A "zero new UI dependency" precedent already exists**:
  `apps/frontend/src/components/ConfirmDialog.tsx` deliberately builds a modal on the native
  `<dialog>` element "with zero new dependency" rather than pulling in a dialog-manager library (see
  its doc comment). No headless-component or UI library is installed anywhere in the repo today.

The design system must also produce **two artifacts kept in sync from one token source**: the React
library and a platform-agnostic Markdown styleguide (so the system can later be ported to Flutter,
Angular, etc.). The token codegen that feeds both is covered by Step 1 of the plan; this ADR records
the *styling/component* approach and, as an aside, the token-codegen tooling choice.

A further goal is **Claude Design compatibility**: the primitives should follow the same
`variant`/`size` prop conventions that shadcn/Radix-style libraries use, so Anthropic's Claude Design
`/design-sync` tooling (and its Storybook-based card discovery) could later consume the library
without a rewrite. This ADR does not run `/design-sync`; it only avoids foreclosing it.

## Decision

Adopt **Tailwind CSS v4 (CSS-first `@theme`, via `@tailwindcss/vite`) + `class-variance-authority`
(cva) for variant APIs + hand-rolled, native-element-based accessible primitives (no Radix UI in
M1).** The following options were weighed.

### 1. Styling engine and how tokens drive it

**Chosen: Tailwind CSS v4, consuming externally-generated tokens.** Utility classes compile away
unused CSS, which keeps the bundle small for the Capacitor WebView. Decisively, Tailwind v4's
`@theme` directive consumes plain CSS custom properties, so Tailwind is *driven by* the tokens
generated in Step 1 (`apps/frontend/src/styles/tokens.generated.css`) rather than owning its own
default theme. Concretely, `src/index.css` imports only the token file, `tailwindcss/theme` (as a
reference) and `tailwindcss/utilities`, and a generated `@theme inline` block maps our semantic
tokens (`--color-primary`, `--radius-md`, …) into Tailwind's utility namespaces so `bg-primary`,
`text-foreground`, `rounded-md`, etc. become valid utilities whose values still resolve to our
runtime custom properties (including the dark-mode overrides).

**Preflight is intentionally not imported.** Tailwind's Preflight base-reset would globally restyle
`<button>`/`<input>`/`<a>`/headings across every existing, unmigrated screen the moment it loaded.
Since M1 builds only the library and migrates no screens, importing Preflight would be an unwanted,
repo-wide visual regression. Omitting it keeps existing screens pixel-identical while still making
utilities available for new `components/ui/` code. Preflight (or a scoped reset) is revisited when a
future phase migrates screens onto the primitives.

### 2. Variant API convention

**Chosen: `class-variance-authority` (cva) + `clsx`/`tailwind-merge`.** cva gives the
`variant`/`size` prop convention that shadcn/Radix-style libraries use — this is the concrete,
checkable meaning of "Claude Design compatible" for this codebase — and `tailwind-merge` resolves
class conflicts when consumers pass their own `className`. A shared `cn()` helper
(`src/lib/cn.ts`) wraps `clsx` + `tailwind-merge` and is used by every primitive.

### 3. Accessibility-critical primitives: hand-built vs. a headless library

**Chosen: hand-built on native elements / documented WAI-ARIA APG patterns.** Modal/Dialog builds on
the native `<dialog>` element (extending the proven `ConfirmDialog.tsx` approach); Tabs follows the
WAI-ARIA Authoring Practices tabs pattern (roving `tabindex`, arrow-key navigation); Select wraps the
native `<select>`. This matches the existing `ConfirmDialog.tsx` "zero new UI dependency" precedent
and avoids adding weight to the WebView. Each primitive's *public* API is nonetheless designed so a
specific component could later be swapped to wrap a headless library without a consumer-facing change
— a deferred option, not a foreclosed one.

### Options compared

- **A (chosen): Tailwind v4 + cva + native-element primitives.** Small compiled CSS, tokens own the
  theme, `variant`/`size` convention for Claude-Design compatibility, and accessibility built on
  native elements/ARIA — consistent with the `ConfirmDialog.tsx` precedent and zero new UI-library
  dependency.
- **B (rejected, kept as a deferred upgrade path): the same, but with Radix UI underneath (the
  literal shadcn/ui stack).** This maximizes turnkey Claude-Design compatibility and yields
  combobox-grade accessibility (e.g. a fully stylable Select dropdown) for free. Rejected for M1
  because it adds real dependency weight to a mobile WebView and cuts against the established
  zero-new-UI-dependency precedent. Because the primitives' public APIs follow the same conventions,
  adopting Radix later can be done **per component** (e.g. only for Select's combobox) without
  breaking consumers.
- **C (rejected): CSS Modules / plain CSS custom properties + BEM, no utility framework.** Smallest
  new-dependency footprint, but it forces a bespoke variant/state system per component with no shared
  convention (undercutting Claude-Design compatibility), and it still would not consume the JSON
  token source without its own bespoke build step — so it saves none of the Step-1 codegen work while
  giving up Tailwind's dead-CSS elimination.

## Consequences

**Positive:**

- Existing Phase 0–5 screens stay pixel-identical (no Preflight, utilities are additive), so M1
  introduces zero visual regression while making the design system available to M2/M3.
- The token JSON is the single source of truth: the same values feed the generated CSS custom
  properties, the `@theme` utility mappings, and the Markdown styleguide, so the two design-system
  artifacts cannot silently drift.
- `variant`/`size` cva APIs plus Storybook stories keep the library structurally compatible with
  Claude Design's `/design-sync` and card-discovery conventions, without committing to run them now.
- No new headless-component/UI-library dependency; the accessibility-critical primitives follow the
  same native-element philosophy already established by `ConfirmDialog.tsx`.
- Dark mode is expressible today (system-preference media query + an explicit `[data-theme]`
  override hook in the generated CSS) even though M1 ships no theme-toggle UI.

**Negative / tradeoffs:**

- Hand-built primitives carry the accessibility burden themselves. Most notably, the native
  `<select>`'s open dropdown is not fully cross-browser stylable without a combobox library — an
  accepted limitation documented in the Select component's styleguide entry, with option B as the
  escape hatch if it ever matters.
- Adding Tailwind, cva, `clsx`, `tailwind-merge`, `lucide-react`, and Storybook grows the frontend's
  dependency/tooling surface (though utilities compile away and Storybook is dev-only).
- Because Preflight is deliberately omitted, the primitives must not assume a normalized base; each
  sets the resets it needs via utilities. When screens are later migrated, introducing a (scoped)
  reset will need its own deliberate step.

**Token-codegen tooling (considered and rejected for Step 1): Style Dictionary.** Using Style
Dictionary to transform the token JSON was considered — it is a legitimate, dev-only, zero-runtime
tool. It was rejected as disproportionate for this repo's small, fixed token set and for the bespoke
Markdown-table output we need (which Style Dictionary would still require a custom format for). A
hand-written Bun/TS script (`design-system/scripts/build-tokens.ts`) is simpler and fully sufficient.
Style Dictionary is noted as a future graduation candidate if a real Flutter/Angular port with
multiple output targets actually materializes.

## Related

- [Phase 6 roadmap](../roadmap/phase-6-design-system-ux.md) — the milestone this ADR's M1 scope
  implements (tokens, primitives library, Storybook, Markdown styleguide).
- [`docs/known-issues.md`](../known-issues.md) — the "No shared UI primitives / design system layer"
  entry this work addresses, including its `/design-sync` note.
- [ADR-0012](0012-capacitor-native-wrapper.md) — the Capacitor WebView whose bundle-size sensitivity
  favors utility-CSS and argues against a heavier headless-component library in M1.
- [`design-system/`](../../design-system/README.md) and
  [`docs/design-system/`](../design-system/README.md) — the token source of truth and the
  platform-agnostic styleguide generated/kept in sync per this decision.
