# Design tokens (source of truth)

This directory holds the **platform-neutral design tokens** for the Baby Tracking App and the script
that generates every derived artifact from them. It is deliberately a top-level directory (not under
`apps/frontend`) and is **not** part of the Bun workspace — it needs no package install, only plain
JSON plus one Bun/TS script.

The tokens here are the single source of truth. Never hand-edit a generated file; edit the JSON and
re-run the build.

## Layout

```
design-system/
  tokens/
    color.json         Semantic color roles, each with a light/dark pair (background, foreground,
                       primary, muted, success, warning, destructive, border, ring) plus event-type
                       colors (feeding, sleep, diaper and their sub-types).
    typography.json    Font families, size scale (xs–3xl), line-height scale, weight scale.
    spacing.json       Numeric spacing scale in rem (0–16).
    radii.json         Border-radius scale (sm/md/lg/full).
    shadows.json       Box-shadow scale (sm/md/lg).
    breakpoints.json   Mobile-first min-width breakpoints (sm/md/lg/xl). Must match
                       apps/frontend/src/styles/breakpoints.css exactly.
    event-types.json   Each event/sub-type key -> { colorToken, iconKey }. Keys match the EventType
                       union and sub-type fields in apps/frontend/src/api/event-api.ts.
  scripts/
    build-tokens.ts    Reads tokens/*.json and writes the generated artifacts (see below).
  README.md            This file.
```

## Generated artifacts

`bun run design-tokens:build` (from the repo root) writes exactly three files, each with a
"do not edit by hand" header:

1. `apps/frontend/src/styles/tokens.generated.css` — CSS custom properties for light mode, a
   `prefers-color-scheme: dark` block, an explicit `[data-theme="dark"]` override hook, and a
   Tailwind v4 `@theme inline` block that maps the tokens into Tailwind's utility namespaces.
2. `docs/design-system/tokens.md` — the same values as Markdown tables, one per category, for the
   platform-agnostic styleguide.
3. `apps/frontend/src/lib/eventTypeTokens.generated.ts` — a typed object mapping each event/sub-type
   key to `{ colorVar, iconKey }`, consumed by `apps/frontend/src/lib/eventTypeVisuals.ts` (CSS
   custom properties can't be imported into TS directly, so the mapping is emitted as TS too).

## Naming rules

- Token names are **kebab-case** (`primary-foreground`, `feeding-breast`, `radius-md`).
- Prefer **semantic** roles (`primary`, `destructive`, `muted-foreground`) over raw values; the raw
  hex/rem values live only in the JSON, never inline in component code.
- Every color role provides both a `light` and a `dark` value.

## Workflow

**Run `bun run design-tokens:build` after any edit to `tokens/*.json`, and commit the regenerated
artifacts in the same change.** See [`docs/design-system/reconciliation-process.md`](../docs/design-system/reconciliation-process.md)
for the full PR checklist that keeps the React library and the Markdown styleguide in sync. The
overall styling approach is recorded in
[ADR-0013](../docs/adr/0013-design-system-styling-approach.md).
