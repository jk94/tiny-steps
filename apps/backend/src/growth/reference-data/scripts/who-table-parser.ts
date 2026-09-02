/**
 * Pure parsing + code-generation logic behind `convert-who-tables.ts`.
 *
 * Split out from the entry point so it contains no file-system access at all:
 * every function here is `string in -> string/array out`, which makes the
 * generator's determinism and its assertions about the vendored files directly
 * unit-testable (see `../who-reference-data.spec.ts`).
 *
 * Build-time tooling — deliberately excluded from the Nest build (see
 * `tsconfig.build.json`); nothing in the running application imports it.
 */

/** Upstream encoding of the `sex` column. */
const MALE_SEX_CODE = '1';
const FEMALE_SEX_CODE = '2';

/** Upstream encoding of `lenanthro.txt`'s `loh` column. */
const RECUMBENT_LENGTH_FLAG = 'L';
const STANDING_HEIGHT_FLAG = 'H';

/** Age axis every WHO 0–5y table is expected to cover, inclusive. */
export const EXPECTED_MIN_AGE_DAYS = 0;
export const EXPECTED_MAX_AGE_DAYS = 1826;

export const SOURCE_URL =
  'https://github.com/WorldHealthOrganization/anthro/tree/master/data-raw/growthstandards';
export const RETRIEVED_ON = '2026-09-02';
export const LICENSE = 'CC BY-NC-SA 3.0 IGO';
export const CITATION =
  'WHO Child Growth Standards: length/height-for-age, weight-for-age, ' +
  'weight-for-length, weight-for-height and body mass index-for-age: methods ' +
  'and development. Geneva: World Health Organization; 2006. ' +
  'Licence: CC BY-NC-SA 3.0 IGO.';

const GENERATED_HEADER = [
  '/*',
  ' * GENERATED FILE — do not edit; run',
  ' * `bun apps/backend/src/growth/reference-data/scripts/convert-who-tables.ts`.',
  ' *',
  ' * WHO Child Growth Standards LMS parameters, vendored under CC BY-NC-SA 3.0 IGO.',
  ' * See ../README.md for provenance, the required citation and the',
  ' * non-commercial-use restriction.',
  ' */',
].join('\n');

export type ParsedSex = 'male' | 'female';
export type BodyMeasureKind = 'length' | 'height';

export interface ParsedRow {
  sex: ParsedSex;
  ageInDays: number;
  l: number;
  m: number;
  s: number;
  /** Only present for `lenanthro.txt`, which carries the `loh` column. */
  lengthOrHeight?: BodyMeasureKind;
}

/**
 * Parses one of the tab-separated WHO tables. The upstream files use CRLF line
 * endings and a header row; both are handled here rather than by normalising
 * the vendored files, which are kept byte-identical to upstream.
 */
export function parseWhoTable(contents: string): ParsedRow[] {
  const lines = contents.split('\n').map((line) => line.replace(/\r$/, ''));
  const [header, ...body] = lines;
  const columns = header.split('\t').map((name) => name.trim().toLowerCase());

  const indexOf = (name: string): number => {
    const index = columns.indexOf(name);
    if (index < 0) {
      throw new Error(`WHO table is missing the '${name}' column (header: ${header})`);
    }
    return index;
  };

  const sexIndex = indexOf('sex');
  const ageIndex = indexOf('age');
  const lIndex = indexOf('l');
  const mIndex = indexOf('m');
  const sIndex = indexOf('s');
  const lohIndex = columns.indexOf('loh');

  return body
    .filter((line) => line.trim().length > 0)
    .map((line, lineNumber) => {
      const cells = line.split('\t');
      const sexCode = cells[sexIndex]?.trim();
      if (sexCode !== MALE_SEX_CODE && sexCode !== FEMALE_SEX_CODE) {
        throw new Error(`Unexpected sex code '${sexCode}' on data line ${lineNumber + 1}`);
      }

      const row: ParsedRow = {
        sex: sexCode === MALE_SEX_CODE ? 'male' : 'female',
        ageInDays: toFiniteNumber(cells[ageIndex], 'age', lineNumber),
        l: toFiniteNumber(cells[lIndex], 'l', lineNumber),
        m: toFiniteNumber(cells[mIndex], 'm', lineNumber),
        s: toFiniteNumber(cells[sIndex], 's', lineNumber),
      };

      if (lohIndex >= 0) {
        const flag = cells[lohIndex]?.trim().toUpperCase();
        if (flag !== RECUMBENT_LENGTH_FLAG && flag !== STANDING_HEIGHT_FLAG) {
          throw new Error(`Unexpected loh flag '${flag}' on data line ${lineNumber + 1}`);
        }
        row.lengthOrHeight = flag === RECUMBENT_LENGTH_FLAG ? 'length' : 'height';
      }

      return row;
    });
}

function toFiniteNumber(cell: string | undefined, column: string, lineNumber: number): number {
  const parsed = Number(cell);
  if (cell === undefined || cell.trim() === '' || !Number.isFinite(parsed)) {
    throw new Error(`Non-numeric '${column}' value '${cell}' on data line ${lineNumber + 1}`);
  }
  return parsed;
}

/**
 * Asserts the age axis is a contiguous, strictly ascending, gap-free run over
 * the expected range. The percentile lookup relies on this (it indexes by
 * rounded age instead of searching), so a silently truncated vendored file
 * must fail the conversion rather than produce wrong percentiles.
 */
export function assertContiguousAgeAxis(rows: ParsedRow[], label: string): void {
  for (let index = 0; index < rows.length; index += 1) {
    const expectedAge = EXPECTED_MIN_AGE_DAYS + index;
    if (rows[index].ageInDays !== expectedAge) {
      throw new Error(
        `${label}: expected age ${expectedAge} at position ${index}, got ${rows[index].ageInDays}`,
      );
    }
  }
  const lastAge = rows[rows.length - 1]?.ageInDays;
  if (lastAge !== EXPECTED_MAX_AGE_DAYS) {
    throw new Error(
      `${label}: expected the axis to end at ${EXPECTED_MAX_AGE_DAYS}, got ${String(lastAge)}`,
    );
  }
}

export function rowsBySex(rows: ParsedRow[], sex: ParsedSex): ParsedRow[] {
  return rows.filter((row) => row.sex === sex).sort((a, b) => a.ageInDays - b.ageInDays);
}

/**
 * Derives the length -> height switch point from the vendored file instead of
 * assuming it (W-17): the first age flagged `H`. Also verifies the flag really
 * partitions the axis, so a mixed/interleaved file cannot slip through.
 */
export function findLengthToHeightBoundary(rows: ParsedRow[]): number {
  const sorted = [...rows].sort((a, b) => a.ageInDays - b.ageInDays);
  const firstHeight = sorted.find((row) => row.lengthOrHeight === 'height');
  if (!firstHeight) {
    throw new Error('lenanthro.txt contains no standing-height rows');
  }
  const boundary = firstHeight.ageInDays;

  for (const row of sorted) {
    const expected = row.ageInDays < boundary ? 'length' : 'height';
    if (row.lengthOrHeight !== expected) {
      throw new Error(
        `lenanthro.txt: age ${row.ageInDays} is flagged '${String(row.lengthOrHeight)}', ` +
          `expected '${expected}' given the derived boundary of ${boundary} days`,
      );
    }
  }

  return boundary;
}

function formatProvenance(sourceFile: string): string {
  return [
    'export const PROVENANCE: ReferenceDataProvenance = {',
    // Pre-wrapped the way Prettier (printWidth 100) would wrap it, so the
    // generated files pass `format:check` without a formatting pass that the
    // determinism guarantee would then depend on.
    '  sourceUrl:',
    `    '${SOURCE_URL}',`,
    `  sourceFile: '${sourceFile}',`,
    `  retrievedOn: '${RETRIEVED_ON}',`,
    `  license: '${LICENSE}',`,
    '  citation:',
    `    '${CITATION}',`,
    '};',
  ].join('\n');
}

function formatPoints(rows: ParsedRow[], indent: string): string {
  return rows
    .map(
      (row) => `${indent}{ ageInDays: ${row.ageInDays}, l: ${row.l}, m: ${row.m}, s: ${row.s} },`,
    )
    .join('\n');
}

/** Renders a single-axis indicator module (weight-for-age, head-circ-for-age). */
export function buildIndicatorModule(options: {
  sourceFile: string;
  constantName: string;
  docComment: string;
  rows: ParsedRow[];
}): string {
  const male = rowsBySex(options.rows, 'male');
  const female = rowsBySex(options.rows, 'female');
  assertContiguousAgeAxis(male, `${options.sourceFile} (male)`);
  assertContiguousAgeAxis(female, `${options.sourceFile} (female)`);

  return [
    GENERATED_HEADER,
    '',
    "import type { IndicatorTable, ReferenceDataProvenance } from './lms.types';",
    '',
    formatProvenance(options.sourceFile),
    '',
    options.docComment,
    `export const ${options.constantName}: IndicatorTable = {`,
    '  male: [',
    formatPoints(male, '    '),
    '  ],',
    '  female: [',
    formatPoints(female, '    '),
    '  ],',
    '};',
    '',
  ].join('\n');
}

/** Renders the length/height module, splitting each sex by the `loh` flag. */
export function buildBodyMeasureModule(rows: ParsedRow[]): {
  contents: string;
  boundaryDays: number;
} {
  const boundaryDays = findLengthToHeightBoundary(rows);
  const male = rowsBySex(rows, 'male');
  const female = rowsBySex(rows, 'female');
  assertContiguousAgeAxis(male, 'lenanthro.txt (male)');
  assertContiguousAgeAxis(female, 'lenanthro.txt (female)');

  const split = (sexRows: ParsedRow[], kind: BodyMeasureKind): ParsedRow[] =>
    sexRows.filter((row) => row.lengthOrHeight === kind);

  const contents = [
    GENERATED_HEADER,
    '',
    "import type { BodyMeasureTable, ReferenceDataProvenance } from './lms.types';",
    '',
    formatProvenance('lenanthro.txt'),
    '',
    '/**',
    ' * The age in days at which the WHO body-measure reference switches from',
    ' * recumbent length to standing height. Derived from the vendored file, not',
    ' * assumed — see `findLengthToHeightBoundary` in the converter.',
    ' */',
    `export const LENGTH_TO_HEIGHT_BOUNDARY_DAYS = ${boundaryDays};`,
    '',
    '/** WHO length-for-age (recumbent) and height-for-age (standing), by sex. */',
    'export const LENGTH_HEIGHT_FOR_AGE: BodyMeasureTable = {',
    '  male: {',
    '    length: [',
    formatPoints(split(male, 'length'), '      '),
    '    ],',
    '    height: [',
    formatPoints(split(male, 'height'), '      '),
    '    ],',
    '  },',
    '  female: {',
    '    length: [',
    formatPoints(split(female, 'length'), '      '),
    '    ],',
    '    height: [',
    formatPoints(split(female, 'height'), '      '),
    '    ],',
    '  },',
    '};',
    '',
  ].join('\n');

  return { contents, boundaryDays };
}
