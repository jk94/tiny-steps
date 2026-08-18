# Select

## Purpose

A labeled single-choice dropdown. Shares the label/error/`aria-*` contract with `Input` so forms
mixing text and choice fields stay consistent.

## ⚠️ Breaking API change

This component **used to wrap a native `<select>`** and took raw `<option>` children. It is now
backed by Radix UI's Select primitive and its API is **not** source-compatible with the old one:

| Old (native `<select>`)                        | New (Radix-backed)                                   |
| ---------------------------------------------- | ---------------------------------------------------- |
| `<option value="BOTTLE">Bottle</option>`       | `<Select.Item value="BOTTLE">Bottle</Select.Item>`   |
| `<option value="" disabled>Choose…</option>`   | `placeholder="Choose…"` prop on the root             |
| `onChange={(e) => …e.target.value}`            | `onValueChange={(value) => …}`                       |
| native `<select>` attributes spread onto the element | explicit `value` / `defaultValue` / `disabled` / `name` / `required` props |

It buys a fully stylable, keyboard- and typeahead-navigable dropdown, which the native control could
not provide cross-browser (that limitation was previously documented here as an accepted trade-off).
Both call sites — the feeding- and diaper-type form fields — were migrated with it.

### Accepted trade-off: no native mobile picker

This is a mobile-first app that also ships inside a Capacitor WebView. A native `<select>` opens the
**OS picker** on Android/iOS (large touch targets, familiar one-handed interaction); this component
renders an in-page listbox instead, on every platform. That loss was weighed and accepted
deliberately, in favor of one consistently styled and behaving control everywhere. If a future
usability review reverses that call, the escape hatch is the same as it ever was: keep this public
API and swap the implementation underneath.

## Anatomy / sub-components

| Part          | Element                     | Purpose                                       |
| ------------- | --------------------------- | --------------------------------------------- |
| `Select`      | label + `button[role=combobox]` + portaled listbox | The field as a whole.    |
| `Select.Item` | `option`                    | One choice (`value` identifies it).           |

## Props (on `Select`)

| Prop            | Type                        | Default | Description                                              |
| --------------- | --------------------------- | ------- | -------------------------------------------------------- |
| `label`         | `string` (required)         | —       | Visible, associated label.                               |
| `children`      | `Select.Item` elements      | —       | The choices.                                             |
| `placeholder`   | `string`                    | —       | Shown on the trigger while nothing is selected.          |
| `value`         | `string`                    | —       | Controlled selected value.                               |
| `defaultValue`  | `string`                    | —       | Uncontrolled initial selected value.                     |
| `onValueChange` | `(value: string) => void`   | —       | Selection-change callback.                               |
| `error`         | `string`                    | —       | Marks the control invalid and renders the message below.  |
| `disabled`      | `boolean`                   | `false` | Disables the whole field.                                |
| `name`          | `string`                    | —       | Name submitted with a surrounding native `<form>`.       |
| `required`      | `boolean`                   | `false` | Native form validation.                                  |
| `id`            | `string`                    | auto    | Falls back to a generated id for label association.      |
| `className`     | `string`                    | —       | Merged onto the trigger.                                 |

`Select.Item` takes `value` (required), `children`, an optional `disabled`, and `className`.

## Visual states

| State           | Appearance                                                                  |
| --------------- | ---------------------------------------------------------------------------- |
| Default         | Bordered trigger with a chevron affordance on the right.                     |
| Placeholder     | Trigger text in the muted foreground color until a value is picked.          |
| Open            | `popover`-surfaced list, width-matched to the trigger, clamped to the viewport. |
| Highlighted item | `accent` background with `accent-foreground` text.                          |
| Selected item   | A leading check indicator.                                                   |
| Focus           | Visible focus ring (`ring` token) on the trigger.                            |
| Disabled        | Reduced opacity and a not-allowed cursor (whole field, or a single item).    |
| Error           | Destructive-colored border; message below in the destructive color.          |

## Accessibility

- The trigger is a `button[role="combobox"]`; the list is a `listbox` of `option`s, all owned by the
  primitive along with the roving focus, typeahead, and open/close keyboard handling.
- The accessible **name** comes from `aria-labelledby` pointing at the `<label>` — a `<label for>`
  alone is not part of a button's name computation. The trigger's own text is then free to act as
  the combobox's **value**, exactly as a native `<select>` announces. The `<label for>` association
  is kept as well, so clicking the label still focuses the field.
- Error state sets `aria-invalid="true"` and `aria-describedby` referencing the `role="alert"`
  message; otherwise `aria-invalid="false"`.
- The chevron and check glyphs are decorative (`aria-hidden`) and do not intercept pointer events.

## Icon / illustration suggestion

A downward chevron (`lucide-react` `ChevronDown`) as the dropdown affordance in the muted foreground
color, and a `Check` glyph as the selected-item indicator.
