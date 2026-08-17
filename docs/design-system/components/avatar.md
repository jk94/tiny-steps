# Avatar

## Purpose

A circular representation of a user or child profile. Shows a photo when one is available and
gracefully falls back to initials derived from the display name — used, for example, next to a
child profile or the "logged by" attribution on a timeline entry.

## Props

| Prop        | Type                        | Default | Description                                                        |
| ----------- | --------------------------- | ------- | ------------------------------------------------------------------ |
| `name`      | `string` (required)         | —       | Display name: image `alt`, initials source, and fallback label.    |
| `src`       | `string`                    | —       | Image URL; absent or failing to load triggers the initials fallback. |
| `size`      | `sm` \| `md` \| `lg`        | `md`    | Diameter and initials text size.                                   |
| `className` | `string`                    | —       | Merged over the defaults.                                          |
| …rest       | native `<span>` attributes  | —       | Spread onto the root element.                                      |

## Visual states

| State           | Appearance                                                                 |
| --------------- | -------------------------------------------------------------------------- |
| Default (image) | Circular, cover-cropped photo.                                             |
| Fallback        | Circular muted background with one- or two-letter uppercase initials.      |
| Loading         | The initials fallback is shown until the image has actually decoded, so there is never a broken/half-painted image flash. |
| Load error      | Stays on the initials fallback.                                            |
| Hover/Focus     | None — non-interactive (wrap in a button/link if interaction is required). |

## Implementation note

Backed by Radix UI's Avatar primitive (`Root`/`Image`/`Fallback`), which owns the image
loading state machine: the `<img>` is only committed to the DOM once the browser reports it as
decoded, and the fallback is rendered for every other state (`idle`/`loading`/`error`). A port to
another UI technology should reproduce that three-state behavior, not just an `onerror` swap.

## Accessibility

- Once the image has loaded, renders `<img>` with `alt={name}`.
- Before it loads, or when there is no image / it failed, the fallback container is `role="img"`
  with `aria-label={name}`, so both presentations announce identically; the visible initials are
  `aria-hidden`.
- Not focusable by itself.

## Icon / illustration suggestion

Initials fallback is the default illustration. A neutral silhouette glyph could be offered as an
alternative fallback for entities without a meaningful name.
