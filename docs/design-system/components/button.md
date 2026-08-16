# Button

## Purpose

The primary interactive control for actions (submit, confirm, navigate-as-action). Provides a small
set of intent-based variants and sizes and a first-class loading state so callers don't hand-roll
spinner/disable logic.

## Props

| Prop        | Type                                                   | Default   | Description                                              |
| ----------- | ------------------------------------------------------ | --------- | ------------------------------------------------------- |
| `variant`   | `primary` \| `secondary` \| `ghost` \| `destructive`   | `primary` | Visual intent.                                          |
| `size`      | `sm` \| `md` \| `lg`                                   | `md`      | Height/padding/typography.                              |
| `isLoading` | `boolean`                                              | `false`   | Shows a spinner, sets `aria-busy`, and blocks clicks.   |
| `disabled`  | `boolean`                                              | `false`   | Standard disabled state.                                |
| `className` | `string`                                               | —         | Merged over the defaults (Tailwind-aware).              |
| …rest       | native `<button>` attributes (incl. `type`, `onClick`) | —         | Spread onto the element; `ref` is forwarded.            |

## Visual states

| State    | Appearance                                                                       |
| -------- | -------------------------------------------------------------------------------- |
| Default  | Filled/tinted per variant.                                                       |
| Hover    | Slightly darker/tinted background.                                               |
| Focus    | Visible focus ring (`ring` token) with an offset — keyboard-visible.             |
| Disabled | Reduced opacity, pointer events off.                                             |
| Loading  | Leading spinner, `aria-busy="true"`, disabled (clicks suppressed).               |

## Accessibility

- Renders a native `<button>`, so it is focusable and keyboard-operable (Enter/Space) by default.
- Loading state sets `aria-busy="true"` and disables the button; the spinner is `aria-hidden`.
- Focus is always visible via a focus-ring utility (does not rely on the UA outline alone).
- Set `type="button"` for non-submit actions (the native default is `submit`).

## Icon / illustration suggestion

Optional leading/trailing icons (e.g. `lucide-react`) sized ~16px; the base layout already spaces
children with a gap. The loading spinner uses `Loader2`.
