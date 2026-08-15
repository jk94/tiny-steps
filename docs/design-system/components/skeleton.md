# Skeleton

## Purpose

A decorative placeholder that mimics the shape of content while it loads, reducing perceived latency
and layout shift. Used in lists/cards before data arrives (e.g. timeline rows, stat cards).

## Props

| Prop        | Type                        | Default | Description                                             |
| ----------- | --------------------------- | ------- | ------------------------------------------------------- |
| `shape`     | `rect` \| `circle` \| `text` | `rect`  | Corner/format preset. `text` defaults to a line height. |
| `className` | `string`                    | —       | Sizing/overrides (e.g. `h-4 w-32`).                     |
| …rest       | native `<div>` attributes   | —       | Spread onto the root element.                           |

## Visual states

| State   | Appearance                                                        |
| ------- | ---------------------------------------------------------------- |
| Default | Muted-background block with a subtle pulsing animation.           |
| Hover/Focus/Disabled | Not applicable — purely decorative and non-interactive. |

Respect `prefers-reduced-motion` at the app level when the pulse animation is undesirable.

## Accessibility

- Always `aria-hidden="true"`; it carries no semantic content and exposes no role.
- The loading *state* itself should be announced by the surrounding region (e.g. `aria-busy` on the
  container, or a visually-hidden "Loading…" live-region message), not by the skeleton.

## Icon / illustration suggestion

None — the skeleton is the illustration. Compose multiple skeletons (circle + text lines) to
approximate the real content's layout.
