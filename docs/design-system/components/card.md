# Card

## Purpose

A surface container that visually groups related content — statistic widgets ("last feeding X hours
ago"), list rows, or form sections. A compound component with optional Header/Body/Footer slots.

## Anatomy / sub-components

| Part          | Element   | Purpose                                             |
| ------------- | --------- | --------------------------------------------------- |
| `Card`        | `<div>`   | Rounded, bordered, shadowed surface container.      |
| `Card.Header` | `<div>`   | Title/summary area, separated by a bottom border.   |
| `Card.Body`   | `<div>`   | Primary content area.                               |
| `Card.Footer` | `<div>`   | Actions/metadata, separated by a top border.        |

All parts accept native `<div>` attributes and a `className` merged over the defaults.

## Visual states

| State   | Appearance                                                          |
| ------- | ------------------------------------------------------------------ |
| Default | Rounded corners, 1px border, subtle shadow, token background.      |
| Hover/Focus | None by default; a clickable card should wrap/associate a real control. |

## Accessibility

- Purely structural: no implicit ARIA role is imposed. If the whole card is actionable, wrap its
  content in a real `<button>`/`<a>` (or add an appropriate role and keyboard handling) rather than
  attaching a bare `onClick` to the container.
- Header text should form a sensible heading if the card represents a titled section (pass a heading
  element into `Card.Header`).

## Icon / illustration suggestion

An optional leading event-type icon in the header pairs well with a colored `Badge` for
category-coded cards (e.g. a feeding stat card).
