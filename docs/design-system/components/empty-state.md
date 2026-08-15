# EmptyState

## Purpose

A centered placeholder shown when a collection has no items yet (empty lists, first-run states). It
orients the user and offers a next step, replacing bare "No entries" text with a consistent,
optionally actionable layout.

## Props

| Prop          | Type                       | Default                              | Description                                         |
| ------------- | -------------------------- | ------------------------------------ | --------------------------------------------------- |
| `icon`        | `ReactNode`                | —                                    | Decorative icon/illustration above the heading.     |
| `title`       | `string`                   | translated "Nothing here yet"        | Heading.                                            |
| `description` | `string`                   | —                                    | Supporting explanatory text.                        |
| `action`      | `ReactNode`                | —                                    | Optional call-to-action (typically a `Button`).     |
| `className`   | `string`                   | —                                    | Merged over the defaults.                           |
| …rest         | native `<div>` attributes  | —                                    | Spread onto the root element.                       |

## Visual states

| State   | Appearance                                                                          |
| ------- | ----------------------------------------------------------------------------------- |
| Default | Vertically stacked, centered: icon, heading, description, action; muted text color. |
| Hover/Focus | Only the optional action button is interactive/focusable.                       |

## Accessibility

- The heading is a real `<h2>` so it participates in the document outline.
- The icon is decorative (`aria-hidden`); meaning is carried by the heading/description text.
- The action slot should contain a properly-labeled, keyboard-operable control.

## Icon / illustration suggestion

A friendly, on-topic glyph (e.g. an empty inbox, or the relevant event-type icon) at ~40px, in the
muted foreground color.
