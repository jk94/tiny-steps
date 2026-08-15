# Toast / Notification

## Purpose

Transient, non-blocking feedback for the result of an action (saved, sync failed, conflict). Toasts
stack in a corner, auto-dismiss after a delay, and can be dismissed manually. Pairs naturally with
the optimistic-UI/offline flows (success/failure of a background sync).

## API

Provide `ToastProvider` once near the app root; call `useToast()` anywhere beneath it.

| Export         | Shape                                                        | Description                                   |
| -------------- | ----------------------------------------------------------- | --------------------------------------------- |
| `ToastProvider` | `{ children, duration? }`                                   | Host + queue + portal. `duration` is the default auto-dismiss (ms). |
| `useToast()`   | `{ toast(options) => id, dismiss(id) }`                     | Enqueue/dismiss toasts.                        |
| `toast(options)` | `{ title, description?, variant?, duration? }`            | `variant`: `info` (default) \| `success` \| `destructive`. `duration: 0` disables auto-dismiss. |

## Visual states

| State    | Appearance                                                                          |
| -------- | ----------------------------------------------------------------------------------- |
| Info     | Neutral border, info icon, muted description.                                        |
| Success  | Success-colored border/icon.                                                         |
| Destructive | Destructive-colored border/icon.                                                  |
| Hover/Focus | The dismiss (✕) button shows hover/focus affordances.                             |
| Auto-dismiss | Removed after `duration` ms (default 5000) unless `duration: 0`.                  |

## Accessibility

- Info/success toasts use `role="status"` (polite live region); destructive toasts use `role="alert"`
  (assertive), so failures are announced promptly.
- Each toast has a manual dismiss button with a translated `aria-label`; its icon is decorative.
- Toasts are rendered in a `document.body` portal above app content; the container is
  `pointer-events-none` so it never blocks the page, while individual toasts re-enable pointer events.
- Auto-dismiss timing should be generous enough to read; provide `duration: 0` for messages that must
  persist until acknowledged.

## Icon / illustration suggestion

A per-variant leading icon: `Info` (info), `CheckCircle2` (success), `AlertTriangle` (destructive)
from `lucide-react`, tinted with the matching semantic color.
