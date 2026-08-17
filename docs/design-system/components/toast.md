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
| `Toaster`   | `(props: ToasterProps) => JSX`                     | The host. Defaults to bottom-right, follows the OS color scheme, and has a manual close button and the design tokens bridged in. |
| `toast`     | `toast(title, options?)`                           | Neutral toast.                                            |
|             | `toast.success(title, options?)`                   | Success variant.                                          |
|             | `toast.info(title, options?)`                      | Informational variant.                                    |
|             | `toast.warning(title, options?)`                   | Warning variant.                                          |
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
| Neutral      | `popover` surface, neutral `border`-token border, no status icon.                  |
| Success      | Same surface with a `success`-colored border and a check icon.                      |
| Info         | Same surface with a `primary`-colored border and an info icon.                      |
| Warning      | Same surface with a `warning`-colored border and a warning icon.                    |
| Error        | Same surface with a `destructive`-colored border and an error icon.                 |
| Hover/Focus  | The dismiss (✕) button shows hover/focus affordances; hovering pauses auto-dismiss. |
| Auto-dismiss | Removed after `duration` ms unless `duration: Infinity`.                            |

Every variant shares the same neutral surface and differs only in border color — status is signalled
the same way as elsewhere in this system, rather than by tinting the whole background.

Colors are not the library's defaults: the host maps **all five** of its variant groups
(`--normal-*`, `--success-*`, `--info-*`, `--warning-*`, `--error-*`) onto this system's `popover`,
`border`, `success`, `primary`, `warning` and `destructive` tokens, so toasts flip with dark mode
along with everything else. Two host settings make that work and must be reproduced by any port:

- The library gates its per-variant colors behind an opt-in "rich colors" mode; without it, every
  variant silently renders with the neutral group and the mappings above never apply.
- The host must follow the OS color scheme explicitly. The library's default is light-only, which
  pins description text to a hard-coded near-black — around 1.3:1 against the dark `popover`
  surface. (The manual `[data-theme]` override hook in `tokens.generated.css` is *not* picked up by
  the library's OS-level detection; only `prefers-color-scheme` is. A theme-toggle UI would need to
  drive the host's theme prop as well — there is no such UI today.)

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
