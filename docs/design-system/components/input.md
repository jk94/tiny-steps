# Input

## Purpose

A single-line text field with a programmatically-associated label and an inline error affordance.
Standardizes the label/field/error triad used across every form (auth, household, child, event
entry).

## Props

| Prop        | Type                                        | Default | Description                                              |
| ----------- | ------------------------------------------- | ------- | ------------------------------------------------------- |
| `label`     | `string` (required)                         | —       | Visible, associated label.                              |
| `error`     | `string`                                    | —       | Marks the field invalid and renders the message below.  |
| `id`        | `string`                                    | auto    | Falls back to a generated id for label association.     |
| `className` | `string`                                    | —       | Merged onto the `<input>`.                              |
| …rest       | native `<input>` attributes (`type`, `value`, `onChange`, `placeholder`, `disabled`, …) | — | Spread onto the input; `ref` is forwarded. |

## Visual states

| State    | Appearance                                                                 |
| -------- | -------------------------------------------------------------------------- |
| Default  | Field bordered with the `input` token, `background`/`foreground` fill and text. |
| Focus    | Visible focus ring (`ring` token).                                         |
| Disabled | Reduced opacity and a not-allowed cursor.                                  |
| Error    | Destructive-colored border (driven off `aria-invalid`, so the visual and announced states cannot drift apart); message text below in the destructive color. |

## Accessibility

- `<label htmlFor>` ↔ `<input id>` association (auto-generated id via `useId` when none supplied).
  A native `<label>` is used deliberately — a headless "Label" primitive only earns its keep for
  non-native controls, and this component wraps a real `<input>`.
- Error state sets `aria-invalid="true"` and `aria-describedby` referencing the message element,
  which is `role="alert"` so it is announced; without an error, `aria-invalid="false"`.
- Never relies on placeholder as a label substitute.

## Icon / illustration suggestion

Optional leading/trailing adornment (e.g. a unit suffix like "ml", or a search icon) can be added by
a future variant; the base component is icon-free.
