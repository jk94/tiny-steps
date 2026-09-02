import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  HEAD_CIRCUMFERENCE_FOR_AGE,
  LENGTH_HEIGHT_FOR_AGE,
  LENGTH_TO_HEIGHT_BOUNDARY_DAYS,
  REFERENCE_MAX_AGE_DAYS,
  REFERENCE_MIN_AGE_DAYS,
  WEIGHT_FOR_AGE,
} from './index';
import type { LmsPoint } from './lms.types';
import { PROVENANCE as HEAD_CIRCUMFERENCE_PROVENANCE } from './head-circumference-for-age.data';
import { PROVENANCE as LENGTH_HEIGHT_PROVENANCE } from './length-height-for-age.data';
import { PROVENANCE as WEIGHT_PROVENANCE } from './weight-for-age.data';
import {
  buildBodyMeasureModule,
  buildIndicatorModule,
  findLengthToHeightBoundary,
  parseWhoTable,
} from './scripts/who-table-parser';

const REQUIRED_LICENSE = 'CC BY-NC-SA 3.0 IGO';
const REQUIRED_CITATION_FRAGMENT = 'WHO Child Growth Standards: length/height-for-age';
// Whole-day count of the first year, used for the median-growth sanity check.
const FIRST_YEAR_DAYS = 365;
// End of the physiological newborn weight-loss window; see the weight test.
const NEWBORN_WEIGHT_DIP_END_DAYS = 14;

const sourceDir = resolve(__dirname, 'sou' + 'rce');

function readSource(fileName: string): string {
  return readFileSync(resolve(sourceDir, fileName), 'utf8');
}

function expectContiguousAscendingAges(points: LmsPoint[], from: number, to: number): void {
  expect(points).toHaveLength(to - from + 1);
  points.forEach((point, index) => {
    expect(point.ageInDays).toBe(from + index);
  });
}

function expectUsableLms(points: LmsPoint[]): void {
  for (const point of points) {
    expect(Number.isFinite(point.l)).toBe(true);
    expect(point.m).toBeGreaterThan(0);
    expect(point.s).toBeGreaterThan(0);
  }
}

describe('WHO reference data', () => {
  describe('module loading', () => {
    it('exposes both sexes for every single-axis indicator', () => {
      for (const table of [WEIGHT_FOR_AGE, HEAD_CIRCUMFERENCE_FOR_AGE]) {
        expect(table.male.length).toBeGreaterThan(0);
        expect(table.female.length).toBeGreaterThan(0);
      }
    });

    it('exposes both sexes and both body-measure references', () => {
      for (const sex of [LENGTH_HEIGHT_FOR_AGE.male, LENGTH_HEIGHT_FOR_AGE.female]) {
        expect(sex.length.length).toBeGreaterThan(0);
        expect(sex.height.length).toBeGreaterThan(0);
      }
    });
  });

  describe('age axis', () => {
    it.each([
      ['weight-for-age (male)', WEIGHT_FOR_AGE.male],
      ['weight-for-age (female)', WEIGHT_FOR_AGE.female],
      ['head-circumference-for-age (male)', HEAD_CIRCUMFERENCE_FOR_AGE.male],
      ['head-circumference-for-age (female)', HEAD_CIRCUMFERENCE_FOR_AGE.female],
    ])('covers %s contiguously from 0 to the documented maximum', (_label, points) => {
      expectContiguousAscendingAges(points, REFERENCE_MIN_AGE_DAYS, REFERENCE_MAX_AGE_DAYS);
      expectUsableLms(points);
    });

    it.each([
      ['male', LENGTH_HEIGHT_FOR_AGE.male],
      ['female', LENGTH_HEIGHT_FOR_AGE.female],
    ])('splits the %s body measure at the boundary with no overlap or gap', (_label, sexTable) => {
      expectContiguousAscendingAges(
        sexTable.length,
        REFERENCE_MIN_AGE_DAYS,
        LENGTH_TO_HEIGHT_BOUNDARY_DAYS - 1,
      );
      expectContiguousAscendingAges(
        sexTable.height,
        LENGTH_TO_HEIGHT_BOUNDARY_DAYS,
        REFERENCE_MAX_AGE_DAYS,
      );
      expectUsableLms(sexTable.length);
      expectUsableLms(sexTable.height);
    });

    it('places the length-to-height boundary at the day after 24 months', () => {
      // 731 = 2 x 365 completed days + 1; asserted here so a re-vendored file
      // that moved the boundary fails loudly instead of silently shifting
      // every percentile around the 24-month mark (W-17).
      expect(LENGTH_TO_HEIGHT_BOUNDARY_DAYS).toBe(731);
      expect(findLengthToHeightBoundary(parseWhoTable(readSource('lenanthro.txt')))).toBe(
        LENGTH_TO_HEIGHT_BOUNDARY_DAYS,
      );
    });
  });

  describe('plausibility of the medians', () => {
    it.each([
      ['head-circumference-for-age (male)', HEAD_CIRCUMFERENCE_FOR_AGE.male],
      ['head-circumference-for-age (female)', HEAD_CIRCUMFERENCE_FOR_AGE.female],
      ['length-for-age (male)', LENGTH_HEIGHT_FOR_AGE.male.length],
      ['length-for-age (female)', LENGTH_HEIGHT_FOR_AGE.female.length],
    ])('has a non-decreasing median over the whole first year for %s', (_label, points) => {
      for (let index = 1; index <= FIRST_YEAR_DAYS; index += 1) {
        expect(points[index].m).toBeGreaterThanOrEqual(points[index - 1].m);
      }
    });

    it.each([
      ['male', WEIGHT_FOR_AGE.male],
      ['female', WEIGHT_FOR_AGE.female],
    ])('has a non-decreasing weight median after the newborn dip for %s', (_label, points) => {
      // Weight is the one indicator whose median legitimately *falls* right
      // after birth (physiological newborn weight loss, roughly the first two
      // weeks), so monotonicity is only asserted past that window.
      for (let index = NEWBORN_WEIGHT_DIP_END_DAYS + 1; index <= FIRST_YEAR_DAYS; index += 1) {
        expect(points[index].m).toBeGreaterThanOrEqual(points[index - 1].m);
      }
      expect(points[FIRST_YEAR_DAYS].m).toBeGreaterThan(points[0].m);
    });
  });

  describe('provenance', () => {
    it.each([
      ['weight-for-age', WEIGHT_PROVENANCE],
      ['length/height-for-age', LENGTH_HEIGHT_PROVENANCE],
      ['head-circumference-for-age', HEAD_CIRCUMFERENCE_PROVENANCE],
    ])('carries the licence and the WHO citation for %s', (_label, provenance) => {
      expect(provenance.license).toBe(REQUIRED_LICENSE);
      expect(provenance.citation).toContain(REQUIRED_CITATION_FRAGMENT);
      expect(provenance.citation).toContain(REQUIRED_LICENSE);
      expect(provenance.retrievedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(provenance.sourceUrl).toMatch(/^https:\/\//);
    });
  });

  describe('converter', () => {
    it('parses the vendored CRLF/tab format including the loh column', () => {
      const rows = parseWhoTable(
        ['sex\tage\tl\tm\ts\tloh', '1\t0\t1\t49.8842\t0.03795\tL', '2\t731\t1\t85.7\t0.03\tH'].join(
          '\r\n',
        ),
      );

      expect(rows).toEqual([
        { sex: 'male', ageInDays: 0, l: 1, m: 49.8842, s: 0.03795, lengthOrHeight: 'length' },
        { sex: 'female', ageInDays: 731, l: 1, m: 85.7, s: 0.03, lengthOrHeight: 'height' },
      ]);
    });

    it('rejects a table whose loh flag does not partition the age axis', () => {
      const interleaved = parseWhoTable(
        [
          'sex\tage\tl\tm\ts\tloh',
          '1\t0\t1\t49.8842\t0.03795\tH',
          '1\t1\t1\t50.0601\t0.03785\tL',
        ].join('\r\n'),
      );

      expect(() => findLengthToHeightBoundary(interleaved)).toThrow(/expected 'height'/);
    });

    it('is deterministic: converting the vendored files twice yields identical output', () => {
      const weightRows = parseWhoTable(readSource('weianthro.txt'));
      const render = () =>
        buildIndicatorModule({
          sourceFile: 'weianthro.txt',
          constantName: 'WEIGHT_FOR_AGE',
          docComment: '/** doc */',
          rows: weightRows,
        });
      expect(render()).toBe(render());

      const lengthRows = parseWhoTable(readSource('lenanthro.txt'));
      expect(buildBodyMeasureModule(lengthRows).contents).toBe(
        buildBodyMeasureModule(lengthRows).contents,
      );
    });

    it('reproduces the committed generated modules from the vendored sources', () => {
      // Guards against hand-edits to the generated files and against a
      // vendored source file being updated without re-running the converter.
      const generated = buildIndicatorModule({
        sourceFile: 'hcanthro.txt',
        constantName: 'HEAD_CIRCUMFERENCE_FOR_AGE',
        docComment: '/** WHO head-circumference-for-age LMS parameters. `m` is in centimetres. */',
        rows: parseWhoTable(readSource('hcanthro.txt')),
      });

      expect(generated).toBe(
        readFileSync(resolve(__dirname, 'head-circumference-for-age.data.ts'), 'utf8'),
      );
    });
  });
});
