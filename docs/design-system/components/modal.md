# Modal / Dialog

## Purpose

A reusable, composable modal dialog for focused tasks and confirmations (delete confirmations, forms
in an overlay). Generalizes the pattern already proven in `ConfirmDialog.tsx` into a controlled,
slot-based component built on the native `<dialog>` element.

## Anatomy / sub-components

| Part            | Element   | Purpose                                          |
| --------------- | --------- | ------------------------------------------------ |
| `Dialog`        | `<dialog>`| Modal surface + backdrop + built-in close button. |
| `Dialog.Header` | `<div>`   | Title/summary (leave room for the close button). |
| `Dialog.Body`   | `<div>`   | Main content.                                    |
| `Dialog.Footer` | `<div>`   | Right-aligned actions.                           |

### Props (on `Dialog`)

| Prop              | Type                        | Default | Description                                     |
| ----------------- | --------------------------- | ------- | ----------------------------------------------- |
| `isOpen`          | `boolean` (required)        | —       | Controlled open state.                          |
| `onOpenChange`    | `(open: boolean) => void`   | —       | Called with `false` on close (✕, ESC, backdrop-driven `close`). |
| `aria-label`      | `string`                    | —       | Accessible name when no header id is referenced. |
| `aria-labelledby` | `string`                    | —       | Id of the header element naming the dialog.     |
| `className`       | `string`                    | —       | Merged onto the `<dialog>`.                     |

## Visual states

| State  | Appearance                                                                 |
| ------ | -------------------------------------------------------------------------- |
| Open   | Centered card with a dimmed backdrop; a ✕ close button in the top-right.   |
| Closed | Not rendered as a modal (native `<dialog>` hidden).                        |
| Focus  | Focus moves into the dialog on open; the ✕ and interactive controls show a focus ring. |

## Accessibility

- Built on native `<dialog>` + `showModal()`, which provides a **focus trap**, ESC-to-dismiss, and
  an inert background for free.
- Focus is moved into the dialog on open; ESC and the ✕ button both invoke `onOpenChange(false)`.
- Provide an accessible name via `aria-labelledby` (pointing at a header heading) or `aria-label`.
- The close button has a translated `aria-label`; its icon is decorative.

## Icon / illustration suggestion

A simple ✕ (`lucide-react` `X`) for the close affordance. Confirmation dialogs may add a leading
status icon (e.g. a warning triangle for destructive actions) in the header.
