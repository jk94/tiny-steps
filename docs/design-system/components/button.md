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
| `asChild`   | `boolean`                                              | `false`   | Render the single child element (e.g. a router link) with the button's styling and props merged in, instead of a `<button>`. |
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
- With `asChild`, the rendered element is whatever the child is (typically an `<a>`), which keeps
  that element's own semantics. Since a non-`<button>` ignores the `disabled` attribute, the
  disabled/loading state is mirrored onto `aria-disabled` in that mode (the styling keys off both);
  actually preventing the child's default action stays the caller's responsibility.

## Implementation note

Only the `asChild` behavior comes from Radix (its `Slot`/`Slottable` pair, so the loading spinner
can sit next to the slotted child). Everything else is plain markup, matching shadcn/ui's own
Button. A port to another UI technology can ignore `asChild` if that platform has no equivalent
composition need.

## Icon / illustration suggestion

Optional leading/trailing icons (e.g. `lucide-react`) sized ~16px; the base layout already spaces
children with a gap. The loading spinner uses `Loader2`.
