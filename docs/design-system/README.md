# Design System — platform-agnostic styleguide

This directory is the **implementation-independent specification** of the Baby Tracking App's design
system. It describes tokens, components, states, and interaction/accessibility requirements as prose
and tables — deliberately **not** as React code — so the same system can be re-implemented on another
UI technology (Flutter, Angular, …) without reverse-engineering the React library.

It is one of three related pieces that must stay in sync:

| Piece | Location | Role |
| ----- | -------- | ---- |
| **Token source of truth** | [`design-system/tokens/*.json`](../../design-system/README.md) | Platform-neutral values (color, typography, spacing, radii, shadows, breakpoints, event-types). Everything else is generated from or specified against these. |
| **React component library** | `apps/frontend/src/components/ui/` | The concrete implementation for this frontend (Tailwind v4 + cva + native-element primitives — see [ADR-0013](../adr/0013-design-system-styling-approach.md)), cataloged in Storybook. |
| **This styleguide** | `docs/design-system/` | The binding, framework-independent spec the React library (and future ports) are checked against. |

## Contents

- [`tokens.md`](tokens.md) — **generated** from `design-system/tokens/*.json` by
  `bun run design-tokens:build`. Do not hand-edit; edit the JSON and regenerate.
- [`components/`](components/) — one entry per primitive (purpose, props, visual states,
  accessibility requirements, icon/illustration suggestions), following one fixed template.
- [`reconciliation-process.md`](reconciliation-process.md) — the rule/PR-checklist that keeps the
  token JSON, the generated artifacts, the React library, and these docs from drifting apart.

## Scope note (Phase 6 M1)

This is the M1 foundation: tokens, the primitives library, Storybook, and these specs. Migrating the
existing Phase 0–5 screens onto the primitives is later work (M2/M3) and is intentionally **not** part
of M1.
