<!-- GENERATED FILE — do not edit by hand. Run `bun run design-tokens:build` to regenerate. Source: design-system/tokens/*.json -->

# Design Tokens

Platform-neutral values derived from `design-system/tokens/*.json`. These are
the single source of truth from which both the React CSS custom properties
(`apps/frontend/src/styles/tokens.generated.css`) and this document are generated.
A port to another UI technology (Flutter, Angular, …) should read the values here,
not reverse-engineer the CSS.

## Color

Semantic color roles, each with a light (default) and dark value. Event-type colors
appear both here and in the Event-type table below.

| Token | Light | Dark |
| --- | --- | --- |
| `--color-background` | `#ffffff` | `#16131f` |
| `--color-canvas` | `#fbf7f2` | `#100e17` |
| `--color-foreground` | `#2a2438` | `#ece9f5` |
| `--color-card` | `#ffffff` | `#1d1a2b` |
| `--color-card-foreground` | `#2a2438` | `#ece9f5` |
| `--color-popover` | `#ffffff` | `#1d1a2b` |
| `--color-popover-foreground` | `#2a2438` | `#ece9f5` |
| `--color-primary` | `#6246ea` | `#a99bff` |
| `--color-primary-foreground` | `#ffffff` | `#16112b` |
| `--color-secondary` | `#f2eefe` | `#2a2541` |
| `--color-secondary-foreground` | `#2a2438` | `#ece9f5` |
| `--color-muted` | `#f5f1ec` | `#24203a` |
| `--color-muted-foreground` | `#6b6478` | `#a8a2bd` |
| `--color-accent` | `#f2eefe` | `#2a2541` |
| `--color-accent-foreground` | `#2a2438` | `#ece9f5` |
| `--color-success` | `#16a34a` | `#4ade80` |
| `--color-success-foreground` | `#052e16` | `#052e16` |
| `--color-warning` | `#d97706` | `#fbbf24` |
| `--color-warning-foreground` | `#451a03` | `#451a03` |
| `--color-destructive` | `#dc2626` | `#f87171` |
| `--color-destructive-foreground` | `#ffffff` | `#450a0a` |
| `--color-border` | `#ebe4dc` | `#312c47` |
| `--color-input` | `#e3dbd2` | `#3a3452` |
| `--color-ring` | `#6246ea` | `#a99bff` |
| `--color-feeding` | `#f59e0b` | `#fbbf24` |
| `--color-feeding-foreground` | `#000000` | `#1f2933` |
| `--color-feeding-breast` | `#ec4899` | `#f472b6` |
| `--color-feeding-breast-foreground` | `#000000` | `#1f2933` |
| `--color-feeding-bottle` | `#3b82f6` | `#60a5fa` |
| `--color-feeding-bottle-foreground` | `#000000` | `#1f2933` |
| `--color-feeding-solid` | `#f97316` | `#fb923c` |
| `--color-feeding-solid-foreground` | `#000000` | `#1f2933` |
| `--color-sleep` | `#8b5cf6` | `#a78bfa` |
| `--color-sleep-foreground` | `#000000` | `#1f2933` |
| `--color-diaper` | `#0d9488` | `#2dd4bf` |
| `--color-diaper-foreground` | `#000000` | `#1f2933` |
| `--color-diaper-pee` | `#eab308` | `#facc15` |
| `--color-diaper-pee-foreground` | `#000000` | `#1f2933` |
| `--color-diaper-stool` | `#a16207` | `#d0a15a` |
| `--color-diaper-stool-foreground` | `#ffffff` | `#1f2933` |
| `--color-diaper-both` | `#0d9488` | `#2dd4bf` |
| `--color-diaper-both-foreground` | `#000000` | `#1f2933` |
| `--color-growth-weight` | `#4338ca` | `#818cf8` |
| `--color-growth-length` | `#047857` | `#34d399` |
| `--color-growth-head-circumference` | `#a21caf` | `#e879f9` |
| `--color-growth-band` | `#4338ca` | `#818cf8` |
| `--color-milestone-motor` | `#4338ca` | `#a5b4fc` |
| `--color-milestone-motor-foreground` | `#ffffff` | `#1f2933` |
| `--color-milestone-language` | `#0f766e` | `#5eead4` |
| `--color-milestone-language-foreground` | `#ffffff` | `#1f2933` |
| `--color-milestone-social` | `#d97706` | `#fcd34d` |
| `--color-milestone-social-foreground` | `#000000` | `#1f2933` |
| `--color-milestone-physical` | `#be123c` | `#fda4af` |
| `--color-milestone-physical-foreground` | `#ffffff` | `#1f2933` |
| `--color-growth` | `#10b981` | `#34d399` |
| `--color-growth-foreground` | `#022c22` | `#022c22` |
| `--color-milestone` | `#ec4899` | `#f472b6` |
| `--color-milestone-foreground` | `#000000` | `#1f2933` |
| `--color-health` | `#f43f5e` | `#fb7185` |
| `--color-health-foreground` | `#000000` | `#1f2933` |
| `--color-development` | `#0ea5e9` | `#38bdf8` |
| `--color-development-foreground` | `#000000` | `#082f49` |

## Typography

| Token | Value |
| --- | --- |
| `--font-family-sans` | `Nunito Variable, system-ui, Avenir, Helvetica, Arial, sans-serif` |
| `--font-family-mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` |
| `--font-family-report` | `Inter` |
| `--font-size-xs` | `0.75rem` |
| `--font-size-sm` | `0.875rem` |
| `--font-size-base` | `1rem` |
| `--font-size-lg` | `1.125rem` |
| `--font-size-xl` | `1.25rem` |
| `--font-size-2xl` | `1.5rem` |
| `--font-size-3xl` | `1.875rem` |
| `--line-height-tight` | `1.25` |
| `--line-height-normal` | `1.5` |
| `--line-height-relaxed` | `1.75` |
| `--font-weight-normal` | `400` |
| `--font-weight-medium` | `500` |
| `--font-weight-semibold` | `600` |
| `--font-weight-bold` | `700` |

## Spacing

| Token | Value |
| --- | --- |
| `--spacing-0` | `0` |
| `--spacing-1` | `0.25rem` |
| `--spacing-2` | `0.5rem` |
| `--spacing-3` | `0.75rem` |
| `--spacing-4` | `1rem` |
| `--spacing-5` | `1.25rem` |
| `--spacing-6` | `1.5rem` |
| `--spacing-8` | `2rem` |
| `--spacing-10` | `2.5rem` |
| `--spacing-12` | `3rem` |
| `--spacing-16` | `4rem` |
| `--spacing-home-sidebar` | `340px` |

## Radii

| Token | Value |
| --- | --- |
| `--radius-sm` | `0.375rem` |
| `--radius-md` | `0.75rem` |
| `--radius-lg` | `1.25rem` |
| `--radius-xl` | `1.75rem` |
| `--radius-full` | `9999px` |

## Shadows

| Token | Value |
| --- | --- |
| `--shadow-sm` | `0 1px 2px 0 rgb(42 36 56 / 0.06)` |
| `--shadow-md` | `0 6px 16px -4px rgb(42 36 56 / 0.12), 0 2px 4px -2px rgb(42 36 56 / 0.06)` |
| `--shadow-lg` | `0 16px 32px -8px rgb(42 36 56 / 0.2), 0 4px 8px -4px rgb(42 36 56 / 0.08)` |

## Breakpoints

Mobile-first `min-width` breakpoints. These match
`apps/frontend/src/styles/breakpoints.css` exactly (a behavior-neutral supersession).

| Token | Value |
| --- | --- |
| `--breakpoint-sm` | `480px` |
| `--breakpoint-md` | `768px` |
| `--breakpoint-lg` | `1024px` |
| `--breakpoint-xl` | `1280px` |

## Event-type colors and icons

Maps each event type / sub-type to a color token (resolved against the Color table)
and a hand-authored icon key (resolved against
`apps/frontend/src/components/ui/icons/event-types/`).

| Event type key | Color token | Icon key |
| --- | --- | --- |
| `FEEDING` | `--color-feeding` | `bottle` |
| `FEEDING.BREAST` | `--color-feeding-breast` | `breastfeeding` |
| `FEEDING.BOTTLE` | `--color-feeding-bottle` | `bottle` |
| `FEEDING.SOLID` | `--color-feeding-solid` | `solid-food` |
| `SLEEP` | `--color-sleep` | `sleep` |
| `DIAPER` | `--color-diaper` | `diaper` |
| `DIAPER.PEE` | `--color-diaper-pee` | `diaper` |
| `DIAPER.STOOL` | `--color-diaper-stool` | `diaper` |
| `DIAPER.BOTH` | `--color-diaper-both` | `diaper` |

## react-pdf StyleSheet (PDF report)

The same tokens are emitted a third time, for the backend PDF report, as
`apps/backend/src/export/report/renderers/react-pdf/report-tokens.generated.ts`.
It is the same source of truth expressed in the units `@react-pdf/renderer`
understands, so a token change reaches the report without a hand-maintained
copy (see [ADR-0015](../adr/0015-pdf-report-generation.md)):

- **Colors:** the **light** values only. A printed page has no
  `prefers-color-scheme`, so there is no dark variant to choose between.
- **Lengths:** converted from CSS to PostScript points — `1rem` = `12`,
  `1px` = `0.75` — and emitted as bare numbers, because react-pdf rejects
  CSS units.
- **`fontFamily.report`:** backend-only. It names the font *file* embedded in
  the PDF (`Inter`), not a CSS stack: react-pdf has no system fonts, so the
  `sans` stack's fallbacks are meaningless there. Nothing in the frontend uses
  this family.
- The generated module exports a **plain object**, not a `StyleSheet.create()`
  call, so no generated design-system artifact imports the renderer.
