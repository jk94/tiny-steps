# Badge

## Purpose

A small, purely-presentational label for status or category. Badges never receive interaction — they
annotate content (an offline "Saving…"/"Not saved" state, an event-type tag on a timeline row, a
role marker). They are the reusable replacement for ad-hoc, sometimes-undefined status pills such as
the `offline-badge` classes referenced but never defined in `OfflineStatusBadge.tsx`.

## Props

| Prop        | Type                                                                                                                                                     | Default     | Description                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------- |
| `variant`   | `default` \| `success` \| `warning` \| `destructive` \| `feeding` \| `feeding-breast` \| `feeding-bottle` \| `feeding-solid` \| `sleep` \| `diaper` \| `diaper-pee` \| `diaper-stool` \| `diaper-both` \| `milestone-motor` \| `milestone-language` \| `milestone-social` \| `milestone-physical` | `default`   | Semantic, event-type or milestone-category color. |
| `size`      | `sm` \| `md`                                                                                                                                             | `md`        | Padding/typography scale.                     |
| `className` | `string`                                                                                                                                                 | —           | Merged over the defaults (Tailwind-aware).    |
| …rest       | native `<span>` attributes                                                                                                                                | —           | Spread onto the root element.                 |

## Visual states

| State   | Appearance                                                                              |
| ------- | --------------------------------------------------------------------------------------- |
| Default | Pill shape (fully rounded), colored background + matching foreground per variant.       |
| Hover   | None — non-interactive.                                                                  |
| Focus   | None — not focusable.                                                                    |
| Disabled | Not applicable.                                                                         |

Semantic variants use the `secondary`/`success`/`warning`/`destructive` token pairs; event-type
variants use the per-event-type color tokens (`feeding`, `sleep`, `diaper`, and sub-types); the four
milestone-category variants use the `milestone-motor`/`-language`/`-social`/`-physical` token pairs
added in roadmap Phase 7.2. Each variant pairs its background with the matching `*-foreground` token
rather than a hard-coded white, so both light and dark mode clear WCAG AA — enforced by
`Badge.contrast.spec.ts`. Every variant carries a transparent border so a consumer can outline a
badge purely via `className` without the layout shifting.

The milestone-category colors deliberately reuse hues that also appear elsewhere in the palette
(indigo, teal, amber, rose). Milestone badges are only ever rendered on the milestone screens, never
beside an event-type badge, so no two of these are visible at the same time; what matters is that the
four categories are distinguishable from **each other**.

## Accessibility

- Renders a non-interactive `<span>`; it must never expose a `button`/`link` role or receive focus.
  It deliberately offers **no** `asChild`/polymorphic escape hatch (unlike shadcn/ui's own Badge),
  precisely so this invariant cannot be broken from a call site.
- Not focusable and not keyboard-operable by design.
- Color is not the sole carrier of meaning: the badge always contains a text label.
- Consumers must ensure adequate contrast when overriding colors; every built-in variant pairs its
  background token with a dedicated `*-foreground` token, and the pairing is regression-tested
  against the 4.5:1 threshold in both light and dark mode.

## Icon / illustration suggestion

Optionally pair with a small leading icon (e.g. the event-type icons) inside the badge; the component
lays children out in a horizontal flex row with a small gap for exactly this.
