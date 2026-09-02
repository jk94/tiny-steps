# WHO Child Growth Standards — vendored LMS reference tables

This directory contains the WHO Child Growth Standards (0–5 years) as **LMS
parameters** (`L`, `M`, `S`) per indicator, sex and age in days. They are the
reference data behind the percentile / z-score computation in
`../percentiles/growth-percentiles.ts` (roadmap Phase 7.1, requirements W-9,
W-11, W-17).

The tables are **vendored into this repository on purpose**: the app is
self-hosted and must work without outbound network access, so nothing here is
fetched at runtime. Everything is read from the generated `*.data.ts` modules,
which are plain TypeScript and therefore compiled into `dist/` by `nest build`
without any asset-copy configuration.

## Provenance

| | |
| --- | --- |
| Source repository | <https://github.com/WorldHealthOrganization/anthro> (the WHO-maintained R package `anthro`) |
| Source path | `data-raw/growthstandards/{weianthro,lenanthro,hcanthro}.txt` |
| Source commit | `8b30b3581e93bc4efaab0ef3deaf40c1d993ea88` (2025-08-22) |
| Retrieved on | 2026-09-02 |
| Original data set | WHO `igrowup` macro package (SPSS/STATA/SAS), the same plain-text LMS tables bundled by the R `anthro` package and by `pygrowup` |
| Licence | **CC BY-NC-SA 3.0 IGO** (Creative Commons Attribution-NonCommercial-ShareAlike 3.0 IGO) |

### Required citation

> WHO Child Growth Standards: length/height-for-age, weight-for-age,
> weight-for-length, weight-for-height and body mass index-for-age: methods and
> development. Geneva: World Health Organization; 2006. Licence: CC BY-NC-SA
> 3.0 IGO.

This citation string is also embedded in the `PROVENANCE` constant of every
generated `*.data.ts` module, so it travels with the data rather than only
living in this README.

### Non-commercial clause

CC BY-NC-SA 3.0 IGO permits **non-commercial** use only, and requires
derivative works to be shared under the same licence. That restriction is
compatible with this project: per the PRD, the Baby Tracking App is
**self-hosted only — there is no SaaS/cloud offering and no commercial
distribution**. Anyone forking this repository for a commercial product must
remove these tables and obtain their own licence for the WHO data.

## Files

```
source/weianthro.txt   vendored verbatim — weight-for-age            (columns: sex, age, l, m, s)
source/lenanthro.txt   vendored verbatim — length/height-for-age     (columns: sex, age, l, m, s, loh)
source/hcanthro.txt    vendored verbatim — head-circumference-for-age(columns: sex, age, l, m, s)

scripts/convert-who-tables.ts   parser + code generator (run with `bun`)

weight-for-age.data.ts            GENERATED
length-height-for-age.data.ts     GENERATED
head-circumference-for-age.data.ts GENERATED
index.ts                          hand-written re-exports + range constants
```

The `source/*.txt` files are byte-for-byte copies of the upstream files,
including their CRLF line endings — do not reformat them, so a future
re-download can be diffed against them directly.

Column semantics of the upstream format:

- `sex` — `1` = male, `2` = female
- `age` — completed age in **days** since birth (`0` … `1826`, i.e. 0–5 years)
- `l`, `m`, `s` — the Box-Cox power, median and coefficient of variation of the
  LMS distribution for that (indicator, sex, age) cell
- `loh` (only in `lenanthro.txt`) — `L` for recumbent **length**, `H` for
  standing **height**; the switch point is asserted by the converter rather
  than hard-coded (it is day 731, i.e. the day after the child turns 24 months)

## Regenerating

```sh
bun apps/backend/src/growth/reference-data/scripts/convert-who-tables.ts
```

The generator is deterministic: running it twice produces byte-identical
output. Commit the regenerated `*.data.ts` files together with any change to
`source/*.txt`.

## Deliberate simplification: no length/height cross-adjustment

WHO's own algorithm adds/subtracts 0.7 cm when a child is measured in a
position that does not match the position the reference assumes (lying down
after 24 months, or standing before 24 months). This app deliberately **does
not** apply that adjustment: the raw measured value is compared to the
reference as entered. Applying a silent ±0.7 cm correction on top of a value
the parent explicitly typed in would make the displayed percentile impossible
to reconcile with the entered number.

A consequence worth spelling out: `lenanthro.txt` is **one** table whose age
axis is partitioned by the `loh` flag — there is no published "height at 400
days" or "length at 1200 days" row. So a manual position override (W-18) that
contradicts the age changes the *reported measurement method* (W-19) but not
the LMS row used, which is always the one covering the child's actual age.
Without the ±0.7 cm adjustment there is nothing else the override could
legitimately change; the alternative — reusing the last in-range row of the
other half — would score a three-year-old against a two-year-old reference.
See `bodyMeasurePoints` in `../percentiles/growth-percentiles.ts`.
