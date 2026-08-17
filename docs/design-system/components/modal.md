# Modal / Dialog

## Purpose

A reusable, composable modal dialog for focused tasks and confirmations (delete confirmations, forms
in an overlay). It is the single modal implementation in the app — `ConfirmDialog` is built on top of
it rather than maintaining a parallel one.

## Anatomy / sub-components

| Part                 | Element           | Purpose                                                   |
| -------------------- | ----------------- | --------------------------------------------------------- |
| `Dialog`             | portaled `dialog` | Modal surface + backdrop + built-in close button.         |
| `Dialog.Title`       | `<h2>`            | Names the dialog (wired to its `aria-labelledby`).        |
| `Dialog.Description` | `<p>`             | Describes the dialog (wired to its `aria-describedby`).   |
| `Dialog.Header`      | `<div>`           | Layout slot for title/description (leaves room for ✕).    |
| `Dialog.Body`        | `<div>`           | Main content.                                             |
| `Dialog.Footer`      | `<div>`           | Right-aligned actions.                                    |

### Props (on `Dialog`)

| Prop              | Type                             | Default | Description                                     |
| ----------------- | -------------------------------- | ------- | ----------------------------------------------- |
| `isOpen`          | `boolean` (required)             | —       | Controlled open state.                          |
| `onOpenChange`    | `(open: boolean) => void`        | —       | Called with `false` on close (✕ or ESC). **No backdrop-click dismissal** — the backdrop is not interactive. |
| `onEscapeKeyDown` | `(event: KeyboardEvent) => void` | no-op   | Called when ESC is pressed; call `event.preventDefault()` to suppress the dismissal (e.g. while an action is in flight). |
| `aria-label`      | `string`                         | —       | Accessible name when no `Dialog.Title` is rendered. |
| `aria-labelledby` | `string`                         | —       | Id of the element naming the dialog; overrides the automatic `Dialog.Title` wiring. |
| `className`       | `string`                         | —       | Merged onto the dialog surface.                 |

`Dialog.Title` / `Dialog.Description` / `Dialog.Header` / `Dialog.Body` / `Dialog.Footer` all accept
native attributes and a merged `className`, and expose a `data-slot` styling hook.

## Visual states

| State  | Appearance                                                                 |
| ------ | -------------------------------------------------------------------------- |
| Open   | Centered card with a dimmed backdrop; a ✕ close button in the top-right.   |
| Closed | Not rendered at all (the whole subtree is unmounted).                      |
| Focus  | Focus moves into the dialog on open and is trapped there; the ✕ and interactive controls show a focus ring. |

## Accessibility

- Backed by Radix UI's Dialog primitive, which provides the portal, **focus trap**, scroll lock,
  inert background, ESC handling and focus restoration on close.
- `Dialog.Title` and `Dialog.Description` are automatically referenced by the dialog's
  `aria-labelledby`/`aria-describedby`. Use them rather than a bare heading; `aria-label` is the
  fallback for a dialog with no visible title.
- ESC and the ✕ button both invoke `onOpenChange(false)`. Clicking the backdrop does **not** dismiss
  — a deliberate invariant carried over from the previous native-`<dialog>` implementation, so a
  half-filled form can't be lost to a stray tap. A port to another UI technology must reproduce
  this; most modal libraries dismiss on outside-click by default and have to be opted out.
- The close button has a translated `aria-label`; its icon is decorative.

## Icon / illustration suggestion

A simple ✕ (`lucide-react` `X`) for the close affordance. Confirmation dialogs may add a leading
status icon (e.g. a warning triangle for destructive actions) in the header.
