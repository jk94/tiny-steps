# Badge

## Purpose

A small, purely-presentational label for status or category. Badges never receive interaction — they
annotate content (an offline "Saving…"/"Not saved" state, an event-type tag on a timeline row, a
role marker). They are the reusable replacement for ad-hoc, sometimes-undefined status pills such as
the `offline-badge` classes referenced but never defined in `OfflineStatusBadge.tsx`.

## Props

| Prop        | Type                                                                                                                                                     | Default     | Description                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------- |
| `variant`   | `default` \| `success` \| `warning` \| `destructive` \| `feeding` \| `feeding-breast` \| `feeding-bottle` \| `feeding-solid` \| `sleep` \| `diaper` \| `diaper-pee` \| `diaper-stool` \| `diaper-both` | `default`   | Semantic or event-type color.                 |
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

Semantic variants use the `success`/`warning`/`destructive`/`muted` token pairs; event-type variants
use the per-event-type color tokens (`feeding`, `sleep`, `diaper`, and sub-types) with white text.

## Accessibility

- Renders a non-interactive `<span>`; it must never expose a `button`/`link` role or receive focus.
- Not focusable and not keyboard-operable by design.
- Color is not the sole carrier of meaning: the badge always contains a text label.
- Consumers must ensure adequate contrast when overriding colors; the built-in event-type variants
  pair a saturated background with white text.

## Icon / illustration suggestion

Optionally pair with a small leading icon (e.g. the event-type icons) inside the badge; the component
lays children out in a horizontal flex row with a small gap for exactly this.
