# Sheet

## Purpose

An edge-anchored panel that slides in over the page. Two placements are in use: `right` for
navigation that doesn't fit a narrow viewport (the mobile header menu behind the hamburger trigger)
and `bottom` for thumb-reachable action sheets (the quick-add sheet behind the floating action
button, and the "more" sheet listing every area of a child). It is a modal dialog
positioned against a screen edge rather than centered, so it shares [Modal](modal.md)'s foundation
instead of duplicating focus-trap/scroll-lock behaviour.

Prefer `Sheet` over `Dialog` when the content is a *list of destinations* the user browses, and
`Dialog` when it's a *decision* the user must confirm.

## Anatomy / sub-components

| Part      | Element             | Purpose                                                    |
| --------- | ------------------- | ---------------------------------------------------------- |
| `Sheet`   | portaled `dialog`   | Edge-anchored surface + backdrop + close button.           |
| (backdrop)| `<div>`             | Dims the page; **clicking it dismisses** the sheet.        |
| (handle)  | `<span>`            | `bottom` only: a decorative grab bar at the top edge.      |
| (title)   | `h2` (Radix `Title`) | Optional visible heading, left of the ✕; names the dialog. |
| (close)   | `<button>`          | ✕ in the panel's top-right.                                |
| children  | —                   | Scrollable content area; no further layout slots.          |

Deliberately flatter than `Dialog`: a sheet holds a `nav` and a couple of controls, so
`Header`/`Body`/`Footer` slots would be ceremony without benefit.

## Props

| Prop              | Type                      | Default   | Description                                       |
| ----------------- | ------------------------- | --------- | ------------------------------------------------- |
| `isOpen`          | `boolean` (required)      | —         | Controlled open state.                            |
| `onOpenChange`    | `(open: boolean) => void` | —         | Called with `false` on close (✕, ESC, **or an outside click**). |
| `side`            | `'right' \| 'bottom'`     | `'right'` | Edge the panel is anchored to. |
| `title`           | `ReactNode`               | —         | Visible heading; when set it is also the panel's accessible name. |
| `aria-label`      | `string`                  | —         | Accessible name for the panel when it has no `title`. |
| `aria-labelledby` | `string`                  | —         | Id of the element naming the panel, as an alternative to `aria-label`. |
| `className`       | `string`                  | —         | Merged onto the panel surface.                    |

## Visual states

| State   | Appearance                                                                       |
| ------- | -------------------------------------------------------------------------------- |
| Open (`right`) | Full-height panel flush to the right edge (85% width, capped at `max-w-xs`), left border + shadow, dimmed and slightly blurred backdrop. |
| Open (`bottom`) | Full-width panel flush to the bottom edge (capped at `max-w-lg` and centred on wide screens, at most 85% of the viewport height), rounded top corners, grab bar, bottom safe-area padding. |
| Closed  | Not rendered at all (the whole subtree is unmounted).                             |
| Opening/closing | Slides in from its edge (300ms horizontally, 320ms in / 220ms out vertically) while the backdrop fades. Under `prefers-reduced-motion: reduce` it appears and disappears with no motion. |
| Focus   | Focus moves into the panel on open and is trapped there; controls show a focus ring. |

## Accessibility

- Backed by the same Radix Dialog primitive as [Modal](modal.md): portal, **focus trap**, scroll
  lock, inert background, ESC handling and focus restoration on close.
- Without a `title` the panel **must** be given an `aria-label` (or `aria-labelledby`) —
  otherwise it announces as an unnamed dialog. With a `title`, the heading names it.
- ESC, the ✕ button and an **outside click** all invoke `onOpenChange(false)`. The outside-click
  dismissal is the deliberate difference from `Dialog`: tapping the dimmed area beside a slide-out
  menu is the expected way to close it on touch, and unlike a form dialog there's no unsaved input
  to lose. A port to another UI technology should keep this asymmetry.
- The ✕ is kept even though ESC exists, because ESC isn't discoverable on touch and there is no
  reliable swipe-to-dismiss gesture. It reuses the shared `ui.dialog.close` string.
- The slide animates a transform only, so it never moves surrounding layout, and it is **switched
  off entirely** under `prefers-reduced-motion: reduce` — the panel then simply appears and
  disappears. A port must honour the platform's reduced-motion setting the same way.

## Implementation note (web)

The slide must be a real `@keyframes` animation (`src/styles/animations.css`), not a CSS
transition. Radix's `Presence` keeps a closing panel mounted only while it observes an
`animationend` event; a transition emits `transitionend`, which it ignores, so the panel would be
unmounted before anything became visible. The backdrop fades with the same keyframe mechanism
(`fade-in`/`fade-out`).

## Icon / illustration suggestion

A hamburger (`lucide-react` `Menu`) for the navigation trigger, a `Plus` floating action button or a
`LayoutGrid` "more" tab for the bottom sheets, and a ✕ (`X`) for the close affordance.
