# Select

## Purpose

A labeled single-choice dropdown, wrapping the native `<select>`. Shares the label/error/`aria-*`
contract with `Input` so forms mixing text and choice fields stay consistent.

## Props

| Prop        | Type                         | Default | Description                                              |
| ----------- | ---------------------------- | ------- | ------------------------------------------------------- |
| `label`     | `string` (required)          | —       | Visible, associated label.                              |
| `error`     | `string`                     | —       | Marks the control invalid and renders the message below. |
| `children`  | `<option>` elements          | —       | The choices.                                            |
| `id`        | `string`                     | auto    | Falls back to a generated id for label association.     |
| `className` | `string`                     | —       | Merged onto the `<select>`.                             |
| …rest       | native `<select>` attributes | —       | Spread onto the element; `ref` is forwarded.            |

## Visual states

| State    | Appearance                                                                    |
| -------- | ----------------------------------------------------------------------------- |
| Default  | Bordered control with a custom chevron affordance on the right.               |
| Focus    | Visible focus ring (`ring` token).                                            |
| Disabled | Native disabled styling.                                                      |
| Error    | Destructive-colored border; message below in the destructive color.           |

## Accessibility

- `<label htmlFor>` ↔ `<select id>` association (auto-generated id via `useId`).
- Error state sets `aria-invalid="true"` and `aria-describedby` referencing the `role="alert"`
  message; otherwise `aria-invalid="false"`.
- The chevron glyph is decorative (`aria-hidden`) and does not intercept pointer events.

## Deliberate limitation

Because this wraps the **native** `<select>`, the *open* dropdown list is rendered by the browser/OS
and is **not fully cross-browser stylable** (option padding, hover colors, etc.). This is an accepted
trade-off per [ADR-0013](../../adr/0013-design-system-styling-approach.md): it keeps the component
dependency-free and fully accessible on every platform. If a fully-styled, searchable dropdown is
ever required, the escape hatch is to back *this component's same public API* with a combobox
library (ADR-0013 option B) without changing call sites.

## Icon / illustration suggestion

A downward chevron (`lucide-react` `ChevronDown`) as the dropdown affordance, in the muted foreground
color.
