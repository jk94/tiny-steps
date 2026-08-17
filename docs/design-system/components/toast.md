# Toast / Notification

## Purpose

Transient, non-blocking feedback for the result of an action (saved, sync failed, conflict). Toasts
stack in a corner, auto-dismiss after a delay, and can be dismissed manually. Pairs naturally with
the optimistic-UI/offline flows (success/failure of a background sync).

## API

Mount `<Toaster />` **once** near the app root (it lives in `main.tsx`); then call `toast()` from
anywhere. There is no context provider and no hook — the queue is module-level state inside the
toast library, which is the main practical difference from the provider/`useToast()` pair this
replaced.

| Export      | Shape                                              | Description                                              |
| ----------- | -------------------------------------------------- | -------------------------------------------------------- |
| `Toaster`   | `(props: ToasterProps) => JSX`                     | The host. Defaults to bottom-right, with a manual close button and the design tokens bridged in. |
| `toast`     | `toast(title, options?)`                           | Neutral/informational toast.                             |
|             | `toast.success(title, options?)`                   | Success variant.                                          |
|             | `toast.error(title, options?)`                     | Error/destructive variant.                                |
|             | `toast.dismiss(id?)`                               | Dismiss one toast, or all of them.                        |

`options` carries `description`, `duration` (ms; `Infinity` disables auto-dismiss), and an optional
`action`. The default duration is the library's (4 s).

### Migration from the previous API

| Old                                                        | New                                            |
| ---------------------------------------------------------- | ---------------------------------------------- |
| `<ToastProvider>` wrapping the app                         | `<Toaster />` mounted once (no wrapping)       |
| `const { toast } = useToast()`                             | `import { toast } from '…/components/ui'`      |
| `toast({ title, description })`                            | `toast(title, { description })`                |
| `toast({ …, variant: 'success' })`                         | `toast.success(title, { description })`        |
| `toast({ …, variant: 'destructive' })`                     | `toast.error(title, { description })`          |
| `duration: 0` to disable auto-dismiss                      | `duration: Infinity`                           |
| `dismiss(id)`                                              | `toast.dismiss(id)`                            |

## Visual states

| State        | Appearance                                                                        |
| ------------ | ---------------------------------------------------------------------------------- |
| Info         | `popover` surface, neutral `border`-token border, no status icon.                  |
| Success      | Same surface with a success-colored border and a check icon.                        |
| Error        | Same surface with a destructive-colored border and an error icon.                   |
| Hover/Focus  | The dismiss (✕) button shows hover/focus affordances; hovering pauses auto-dismiss. |
| Auto-dismiss | Removed after `duration` ms unless `duration: Infinity`.                            |

Colors are not the library's defaults: the host maps its `--normal-*` / `--success-*` / `--error-*` /
`--warning-*` CSS custom properties onto this system's `popover`, `border`, `success`, `destructive`
and `warning` tokens, so toasts flip with dark mode along with everything else.

## Accessibility

- All toasts share **one** `aria-live="polite"` region with a translated label, rather than each
  toast carrying its own role. Note this is a deliberate downgrade from the previous hand-built
  implementation, which used `role="alert"` (assertive) for destructive toasts — the library exposes
  no per-toast assertiveness. **Anything that genuinely must interrupt the user should not be a
  toast**; use the app-root conflict/error banner or a `Dialog` instead.
- Each toast has a manual dismiss button with a translated `aria-label`; its icon is decorative.
- Auto-dismiss timing should be generous enough to read; pass `duration: Infinity` for messages that
  must persist until acknowledged.
- Hovering or focusing the stack pauses the auto-dismiss timers.

## Icon / illustration suggestion

A per-variant leading icon (check for success, warning triangle for error), tinted with the matching
semantic color; informational toasts stay icon-free.
