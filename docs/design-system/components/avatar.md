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
| Load error      | Automatically switches from image to the initials fallback.                |
| Hover/Focus     | None — non-interactive (wrap in a button/link if interaction is required). |

## Accessibility

- With an image, renders `<img>` with `alt={name}`.
- Without an image (or after a load error), the fallback container is `role="img"` with
  `aria-label={name}`, so both presentations announce identically; the visible initials are
  `aria-hidden`.
- Not focusable by itself.

## Icon / illustration suggestion

Initials fallback is the default illustration. A neutral silhouette glyph could be offered as an
alternative fallback for entities without a meaningful name.
