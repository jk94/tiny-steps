# Textarea

## Purpose

A multi-line text field with a programmatically-associated label and an inline error affordance —
`Input`'s exact label/field/error triad, backed by a `<textarea>` instead of an `<input>`. Used for
free-text note fields (e.g. feeding/diaper event notes) where a single line isn't enough.

## Props

| Prop        | Type                                                                                       | Default | Description                                             |
| ----------- | ------------------------------------------------------------------------------------------ | ------- | --------------------------------------------------------- |
| `label`     | `string` (required)                                                                         | —       | Visible, associated label.                                |
| `error`     | `string`                                                                                    | —       | Marks the field invalid and renders the message below.    |
| `id`        | `string`                                                                                    | auto    | Falls back to a generated id for label association.       |
| `className` | `string`                                                                                    | —       | Merged onto the `<textarea>`.                              |
| …rest       | native `<textarea>` attributes (`rows`, `value`, `onChange`, `maxLength`, `disabled`, …)    | —       | Spread onto the textarea; `ref` is forwarded.              |

## Visual states

| State    | Appearance                                                                       |
| -------- | --------------------------------------------------------------------------------- |
| Default  | Field bordered with the `input` token, `background`/`foreground` fill and text.   |
| Focus    | Visible focus ring (`ring` token).                                                |
| Disabled | Reduced opacity and a not-allowed cursor.                                         |
| Error    | Destructive-colored border (driven off `aria-invalid`); message text below in the destructive color. |

## Accessibility

- `<label htmlFor>` ↔ `<textarea id>` association (auto-generated id via `useId` when none supplied),
  for the same reason `Input` uses a native label rather than a headless "Label" primitive.
- Error state sets `aria-invalid="true"` and `aria-describedby` referencing the message element,
  which is `role="alert"` so it is announced; without an error, `aria-invalid="false"`.
- Never relies on placeholder as a label substitute.

## Icon / illustration suggestion

None — a plain text field, no adornment.
