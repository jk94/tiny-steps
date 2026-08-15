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
| `--color-background` | `#ffffff` | `#0f172a` |
| `--color-foreground` | `#1f2933` | `#e2e8f0` |
| `--color-primary` | `#4f46e5` | `#818cf8` |
| `--color-primary-foreground` | `#ffffff` | `#0f172a` |
| `--color-muted` | `#f1f5f9` | `#1e293b` |
| `--color-muted-foreground` | `#64748b` | `#94a3b8` |
| `--color-success` | `#16a34a` | `#4ade80` |
| `--color-success-foreground` | `#ffffff` | `#052e16` |
| `--color-warning` | `#d97706` | `#fbbf24` |
| `--color-warning-foreground` | `#ffffff` | `#451a03` |
| `--color-destructive` | `#dc2626` | `#f87171` |
| `--color-destructive-foreground` | `#ffffff` | `#450a0a` |
| `--color-border` | `#e2e8f0` | `#334155` |
| `--color-ring` | `#4f46e5` | `#818cf8` |
| `--color-feeding` | `#f59e0b` | `#fbbf24` |
| `--color-feeding-breast` | `#ec4899` | `#f472b6` |
| `--color-feeding-bottle` | `#3b82f6` | `#60a5fa` |
| `--color-feeding-solid` | `#f97316` | `#fb923c` |
| `--color-sleep` | `#8b5cf6` | `#a78bfa` |
| `--color-diaper` | `#0d9488` | `#2dd4bf` |
| `--color-diaper-pee` | `#eab308` | `#facc15` |
| `--color-diaper-stool` | `#a16207` | `#d0a15a` |
| `--color-diaper-both` | `#0d9488` | `#2dd4bf` |

## Typography

| Token | Value |
| --- | --- |
| `--font-family-sans` | `system-ui, Avenir, Helvetica, Arial, sans-serif` |
| `--font-family-mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` |
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

## Radii

| Token | Value |
| --- | --- |
| `--radius-sm` | `0.25rem` |
| `--radius-md` | `0.5rem` |
| `--radius-lg` | `0.75rem` |
| `--radius-full` | `9999px` |

## Shadows

| Token | Value |
| --- | --- |
| `--shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` |
| `--shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` |
| `--shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` |

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
