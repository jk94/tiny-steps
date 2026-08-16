# Reconciliation process — keeping the design system in sync

The design system lives in three places that must never drift apart: the **token source of truth**
(`design-system/tokens/*.json`), the **React component library**
(`apps/frontend/src/components/ui/`), and this **Markdown styleguide** (`docs/design-system/`). The
generated artifacts (`apps/frontend/src/styles/tokens.generated.css`,
`apps/frontend/src/lib/eventTypeTokens.generated.ts`, and `docs/design-system/tokens.md`) are derived
from the token JSON and are committed, not build-time-only — so a stale token edit would otherwise go
unnoticed.

This document defines what a change must include so they stay consistent. Treat it as a **PR
checklist** (per the Phase 6 roadmap's own suggestion).

## When you change tokens (`design-system/tokens/*.json`)

- [ ] Run `bun run design-tokens:build`.
- [ ] Commit the regenerated artifacts alongside the JSON change:
  - `apps/frontend/src/styles/tokens.generated.css`
  - `apps/frontend/src/lib/eventTypeTokens.generated.ts`
  - `docs/design-system/tokens.md`
- [ ] Do **not** hand-edit any generated file (each carries a "do not edit by hand" header).
- [ ] If you added/removed a breakpoint, confirm it still matches
  `apps/frontend/src/styles/breakpoints.css` (they must stay identical).

## When you add or change a component in `apps/frontend/src/components/ui/`

- [ ] Update or add the matching `docs/design-system/components/<name>.md` **in the same PR**, using
  the fixed template (Purpose / Props / Visual states / Accessibility / Icon suggestion).
- [ ] Add or update the component's Storybook story (`*.stories.tsx`) and its spec (`*.spec.tsx`),
  covering rendering, interaction states, and accessibility (roles/ARIA/focus).
- [ ] Update the barrel export (`apps/frontend/src/components/ui/index.ts`).
- [ ] Keep props/variant naming consistent with the existing primitives (the cva `variant`/`size`
  convention — see [ADR-0013](../adr/0013-design-system-styling-approach.md)) so the library stays
  Claude-Design-compatible.

## When you add a new token category or a new event type

- [ ] Extend the relevant token JSON, regenerate (as above), and add the corresponding section/row to
  `docs/design-system/tokens.md` (this happens automatically via the generator).
- [ ] For a new event type/sub-type, also add the icon (under
  `apps/frontend/src/components/ui/icons/event-types/`) and its lookup entry, and the `ui.eventTypes.*`
  i18n labels in `apps/frontend/src/i18n/locales/{de,en}.json`.

## Verification before merging

- [ ] `bun run lint`
- [ ] `bun run format:check`
- [ ] `bun run --cwd apps/frontend test`
- [ ] `bun run --cwd apps/frontend build-storybook`
- [ ] `bun run --cwd apps/frontend build` (`tsc -b && vite build`) — catches type errors in
      `*.stories.tsx`/`*.spec.tsx` files that `test`/`build-storybook` alone can miss.
