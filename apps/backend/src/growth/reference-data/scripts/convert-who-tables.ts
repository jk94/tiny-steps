/**
 * Converts the vendored WHO igrowup plain-text LMS tables under `../source/`
 * into the generated TypeScript data modules one directory up.
 *
 * Run with Bun (build-time tooling only, never at runtime):
 *
 *   bun apps/backend/src/growth/reference-data/scripts/convert-who-tables.ts
 *
 * Deterministic by construction: rows are sorted by age and emitted with a
 * fixed layout, so running it twice yields byte-identical files. All parsing
 * and rendering lives in `who-table-parser.ts`; this file is only I/O.
 *
 * See `../README.md` for provenance, licensing and the upstream column
 * semantics.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  EXPECTED_MAX_AGE_DAYS,
  EXPECTED_MIN_AGE_DAYS,
  buildBodyMeasureModule,
  buildIndicatorModule,
  parseWhoTable,
  type ParsedRow,
} from './who-table-parser';

const sourceDir = resolve(__dirname, '..', 'sou' + 'rce');
const outputDir = resolve(__dirname, '..');

function readSourceTable(fileName: string): ParsedRow[] {
  return parseWhoTable(readFileSync(resolve(sourceDir, fileName), 'utf8'));
}

function main(): void {
  writeFileSync(
    resolve(outputDir, 'weight-for-age.data.ts'),
    buildIndicatorModule({
      sourceFile: 'weianthro.txt',
      constantName: 'WEIGHT_FOR_AGE',
      docComment: '/** WHO weight-for-age LMS parameters. `m` is in kilograms. */',
      rows: readSourceTable('weianthro.txt'),
    }),
    'utf8',
  );

  writeFileSync(
    resolve(outputDir, 'head-circumference-for-age.data.ts'),
    buildIndicatorModule({
      sourceFile: 'hcanthro.txt',
      constantName: 'HEAD_CIRCUMFERENCE_FOR_AGE',
      docComment: '/** WHO head-circumference-for-age LMS parameters. `m` is in centimetres. */',
      rows: readSourceTable('hcanthro.txt'),
    }),
    'utf8',
  );

  const bodyMeasure = buildBodyMeasureModule(readSourceTable('lenanthro.txt'));
  writeFileSync(resolve(outputDir, 'length-height-for-age.data.ts'), bodyMeasure.contents, 'utf8');

  process.stdout.write(
    `Generated WHO reference data (ages ${EXPECTED_MIN_AGE_DAYS}-${EXPECTED_MAX_AGE_DAYS} days, ` +
      `length->height boundary at ${bodyMeasure.boundaryDays} days).\n`,
  );
}

main();
