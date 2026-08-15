# Tabs

## Purpose

Switch between mutually-exclusive views within the same context (e.g. Feeding / Sleep / Diaper
sections of a child's page) without navigating away. Hand-built on the WAI-ARIA APG tabs pattern.

## Anatomy / sub-components

| Part         | Role         | Purpose                                          |
| ------------ | ------------ | ------------------------------------------------ |
| `Tabs`       | container    | Holds selection state (controlled or uncontrolled). |
| `Tabs.List`  | `tablist`    | Row of tabs.                                     |
| `Tabs.Tab`   | `tab`        | One selectable tab (`value` identifies it).      |
| `Tabs.Panel` | `tabpanel`   | Content shown when its `value` is selected.      |

### Props

| Prop (on `Tabs`) | Type                       | Default | Description                              |
| ---------------- | -------------------------- | ------- | ---------------------------------------- |
| `defaultValue`   | `string` (required)        | —       | Initially selected value (uncontrolled). |
| `value`          | `string`                   | —       | Controlled selected value.               |
| `onValueChange`  | `(value: string) => void`  | —       | Selection-change callback.               |

`Tabs.Tab` and `Tabs.Panel` each take a `value: string` that ties them together.

## Visual states

| State    | Appearance                                                              |
| -------- | ---------------------------------------------------------------------- |
| Default  | Inactive tabs: muted text, transparent bottom border.                  |
| Hover    | Inactive tab text darkens to the foreground color.                     |
| Selected | Primary-colored text with a primary bottom-border indicator.           |
| Focus    | Visible focus ring on the focused tab.                                  |

## Accessibility

- `role="tablist"` › `role="tab"` › `role="tabpanel"` structure.
- The selected tab has `aria-selected="true"`; each tab has `aria-controls` referencing its panel,
  and each panel has `aria-labelledby` referencing its tab.
- Roving `tabindex`: only the selected tab is in the tab order (`tabindex=0`); the rest are `-1`.
- Keyboard: `ArrowRight`/`ArrowLeft` move focus between tabs (wrapping) and **activate** the newly
  focused tab (automatic activation, per the APG).

## Icon / illustration suggestion

Optional leading event-type icon inside each `Tabs.Tab` (e.g. the feeding/sleep/diaper icons) to
reinforce the category alongside the label.
