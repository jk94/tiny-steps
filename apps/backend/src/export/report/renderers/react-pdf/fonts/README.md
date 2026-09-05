# Inter — vendored report font

`@react-pdf/renderer` has no system-font access: every glyph it draws must come
from a font file the process can read. The design system's CSS font stack
(`--font-family-sans`) is therefore unusable here — it names families that only
exist on the reader's device — so the PDF report embeds **Inter**, the first
family in that stack, as four static instances.

The files are **vendored into this repository on purpose**, exactly like the WHO
reference tables in `../../../../growth/reference-data/`: the app is self-hosted
and must build and run without outbound network access, so nothing is fetched at
render time. They are copied into `dist/` by the `compilerOptions.assets` entry
in `apps/backend/nest-cli.json` (a `.ttf` is not a TypeScript module, so unlike
the WHO data it does need explicit asset-copy configuration) and resolved at
runtime through `__dirname` in `../register-fonts.ts`.

Only the four weights the report actually uses are vendored (400/500/600/700),
and only the upright ones — the report has no italic text. Adding a weight means
adding a file here *and* a `Font.register` entry; a weight that is requested but
not registered silently falls back to the nearest registered one.

## Provenance

| | |
| --- | --- |
| Source repository | <https://github.com/rsms/inter> |
| Release | `v4.1` (`Inter-4.1.zip`) |
| Source path in the release | `extras/ttf/Inter-{Regular,Medium,SemiBold,Bold}.ttf` |
| Retrieved on | 2026-09-03 |
| Licence | **SIL Open Font License 1.1** — full text in `LICENSE.txt` |

The *static* instances from `extras/ttf/` are vendored rather than the variable
`InterVariable.ttf` at the archive root: `@react-pdf/renderer` selects a face by
exact `fontWeight` from the registered list and has no variable-axis support, so
a variable file would render every weight at its default instance.

## Licence obligations

The SIL OFL 1.1 permits bundling and redistribution, including inside a
commercial or closed product, provided that:

- the copyright notice and licence (`LICENSE.txt`) travel with the font files —
  which is why `LICENSE.txt` is vendored beside them and copied into `dist/`;
- the font is not sold on its own;
- any *modified* version is not distributed under the reserved name "Inter".

This repository ships the files unmodified, so the last point does not apply.
Unlike the WHO reference data's CC BY-NC-SA 3.0 IGO licence, the OFL adds no
non-commercial restriction.
