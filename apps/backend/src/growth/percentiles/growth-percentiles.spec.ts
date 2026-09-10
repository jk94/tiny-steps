import {
  HEAD_CIRCUMFERENCE_FOR_AGE,
  LENGTH_HEIGHT_FOR_AGE,
  LENGTH_TO_HEIGHT_BOUNDARY_DAYS,
  REFERENCE_MAX_AGE_DAYS,
  WEIGHT_FOR_AGE,
  type LmsPoint,
} from '../reference-data';
import {
  WHO_PERCENTILE_Z_SCORES,
  computeGrowthPercentile,
  percentileFromZScore,
  resolveBodyMeasureReference,
  valueFromZScore,
  zScoreFromLms,
  type ChildSexValue,
  type GrowthIndicator,
} from './growth-percentiles';

const GRAMS_PER_KILOGRAM = 1000;
const MILLIMETRES_PER_CENTIMETRE = 10;
// Round-tripping a value through the inverse LMS formula and back must land on
// the original z-score to well within display precision.
const Z_SCORE_DIGITS = 3;

const SEXES: ChildSexValue[] = ['MALE', 'FEMALE'];
const ROUND_TRIP_AGES = [0, 90, 365, 730, 731, 1000, REFERENCE_MAX_AGE_DAYS];
const ROUND_TRIP_Z_SCORES = [-3, -2, -1, 0, 1, 2, 3];

function sexKey(sex: ChildSexValue): 'male' | 'female' {
  return sex === 'MALE' ? 'male' : 'female';
}

/** The LMS row the implementation is expected to pick for a given case. */
function expectedLmsPoint(
  indicator: GrowthIndicator,
  sex: ChildSexValue,
  ageInDays: number,
): LmsPoint {
  const key = sexKey(sex);
  switch (indicator) {
    case 'WEIGHT_FOR_AGE':
      return WEIGHT_FOR_AGE[key][ageInDays];
    case 'HEAD_CIRCUMFERENCE_FOR_AGE':
      return HEAD_CIRCUMFERENCE_FOR_AGE[key][ageInDays];
    case 'LENGTH_OR_HEIGHT_FOR_AGE':
      return ageInDays < LENGTH_TO_HEIGHT_BOUNDARY_DAYS
        ? LENGTH_HEIGHT_FOR_AGE[key].length[ageInDays]
        : LENGTH_HEIGHT_FOR_AGE[key].height[ageInDays - LENGTH_TO_HEIGHT_BOUNDARY_DAYS];
  }
}

function baseUnitsPerTableUnit(indicator: GrowthIndicator): number {
  return indicator === 'WEIGHT_FOR_AGE' ? GRAMS_PER_KILOGRAM : MILLIMETRES_PER_CENTIMETRE;
}

describe('computeGrowthPercentile', () => {
  describe('W-9: agreement with the published WHO LMS parameters', () => {
    const indicators: GrowthIndicator[] = [
      'WEIGHT_FOR_AGE',
      'LENGTH_OR_HEIGHT_FOR_AGE',
      'HEAD_CIRCUMFERENCE_FOR_AGE',
    ];

    it.each(
      indicators.flatMap((indicator) =>
        SEXES.flatMap((sex) => ROUND_TRIP_AGES.map((ageInDays) => [indicator, sex, ageInDays])),
      ) as [GrowthIndicator, ChildSexValue, number][],
    )('recovers every reference z-score for %s / %s at day %i', (indicator, sex, ageInDays) => {
      const point = expectedLmsPoint(indicator, sex, ageInDays);

      for (const zScore of ROUND_TRIP_Z_SCORES) {
        const valueInTableUnit = valueFromZScore(zScore, point);
        const outcome = computeGrowthPercentile({
          indicator,
          sex,
          ageInDays,
          valueInBaseUnit: valueInTableUnit * baseUnitsPerTableUnit(indicator),
        });

        expect(outcome.status).toBe('COMPUTED');
        if (outcome.status !== 'COMPUTED') {
          return;
        }
        expect(outcome.zScore).toBeCloseTo(zScore, Z_SCORE_DIGITS);
      }
    });

    it('classifies the published newborn boy median weight at the 50th percentile', () => {
      // WHO weight-for-age, boys, day 0: M = 3.3464 kg.
      const outcome = computeGrowthPercentile({
        indicator: 'WEIGHT_FOR_AGE',
        sex: 'MALE',
        ageInDays: 0,
        valueInBaseUnit: 3346,
      });

      expect(outcome).toMatchObject({ status: 'COMPUTED', referenceUsed: null });
      if (outcome.status !== 'COMPUTED') {
        return;
      }
      expect(outcome.percentile).toBeCloseTo(50, 1);
    });

    it('classifies the published newborn boy median length at the 50th percentile', () => {
      // WHO length-for-age, boys, day 0: M = 49.8842 cm.
      const outcome = computeGrowthPercentile({
        indicator: 'LENGTH_OR_HEIGHT_FOR_AGE',
        sex: 'MALE',
        ageInDays: 0,
        valueInBaseUnit: 499,
      });

      expect(outcome).toMatchObject({ status: 'COMPUTED', referenceUsed: 'LENGTH' });
      if (outcome.status !== 'COMPUTED') {
        return;
      }
      expect(outcome.percentile).toBeCloseTo(50, 0);
    });

    it('distinguishes the sexes at the same age and value', () => {
      const forSex = (sex: ChildSexValue) =>
        computeGrowthPercentile({
          indicator: 'WEIGHT_FOR_AGE',
          sex,
          ageInDays: 365,
          valueInBaseUnit: 9600,
        });

      const male = forSex('MALE');
      const female = forSex('FEMALE');
      expect(male.status).toBe('COMPUTED');
      expect(female.status).toBe('COMPUTED');
      if (male.status !== 'COMPUTED' || female.status !== 'COMPUTED') {
        return;
      }
      // Girls' median weight at 12 months is lower, so the same value scores
      // higher for a girl.
      expect(female.zScore).toBeGreaterThan(male.zScore);
    });
  });

  describe('percentile mapping', () => {
    it.each([
      [WHO_PERCENTILE_Z_SCORES[50], 50],
      [WHO_PERCENTILE_Z_SCORES[3], 3],
      [WHO_PERCENTILE_Z_SCORES[97], 97],
      [WHO_PERCENTILE_Z_SCORES[15], 15],
      [WHO_PERCENTILE_Z_SCORES[85], 85],
    ])('maps the z-score %f to percentile %i', (zScore, expected) => {
      expect(percentileFromZScore(zScore)).toBeCloseTo(expected, 3);
    });

    it('reports the percentile alongside the z-score of a real measurement', () => {
      const point = WEIGHT_FOR_AGE.male[90];
      const outcome = computeGrowthPercentile({
        indicator: 'WEIGHT_FOR_AGE',
        sex: 'MALE',
        ageInDays: 90,
        valueInBaseUnit: valueFromZScore(WHO_PERCENTILE_Z_SCORES[3], point) * GRAMS_PER_KILOGRAM,
      });

      expect(outcome.status).toBe('COMPUTED');
      if (outcome.status !== 'COMPUTED') {
        return;
      }
      expect(outcome.percentile).toBeCloseTo(3, 2);
    });
  });

  describe('the L = 0 branch of the LMS formula', () => {
    const logNormalPoint: LmsPoint = { ageInDays: 0, l: 0, m: 8, s: 0.12 };

    it('falls back to the log form when L is zero', () => {
      const value = 9.5;
      expect(zScoreFromLms(value, logNormalPoint)).toBeCloseTo(
        Math.log(value / logNormalPoint.m) / logNormalPoint.s,
        10,
      );
    });

    it('round-trips through the log form of the inverse', () => {
      for (const zScore of ROUND_TRIP_Z_SCORES) {
        expect(zScoreFromLms(valueFromZScore(zScore, logNormalPoint), logNormalPoint)).toBeCloseTo(
          zScore,
          10,
        );
      }
    });
  });

  describe('W-10: no sex on the child profile', () => {
    it('reports the reason instead of guessing a default', () => {
      expect(
        computeGrowthPercentile({
          indicator: 'WEIGHT_FOR_AGE',
          sex: null,
          ageInDays: 100,
          valueInBaseUnit: 6000,
        }),
      ).toEqual({ status: 'UNAVAILABLE', reason: 'CHILD_SEX_NOT_SET' });
    });
  });

  describe('W-11: age outside the reference range', () => {
    it.each([REFERENCE_MAX_AGE_DAYS + 1, 2200])('reports day %i as out of range', (ageInDays) => {
      expect(
        computeGrowthPercentile({
          indicator: 'LENGTH_OR_HEIGHT_FOR_AGE',
          sex: 'FEMALE',
          ageInDays,
          valueInBaseUnit: 1100,
        }),
      ).toEqual({ status: 'UNAVAILABLE', reason: 'AGE_ABOVE_REFERENCE_RANGE' });
    });

    it.each([-1, -5, -31])('reports day %i as below the range', (ageInDays) => {
      // Reachable through the export and other pure-function callers even
      // though the service rejects a pre-birth measurement (W-5); clamping to
      // day 0 would produce a confident, wrong percentile.
      expect(
        computeGrowthPercentile({
          indicator: 'WEIGHT_FOR_AGE',
          sex: 'MALE',
          ageInDays,
          valueInBaseUnit: 3400,
        }),
      ).toEqual({ status: 'UNAVAILABLE', reason: 'AGE_BELOW_REFERENCE_RANGE' });
    });

    it('still computes on the first day inside the range', () => {
      expect(
        computeGrowthPercentile({
          indicator: 'WEIGHT_FOR_AGE',
          sex: 'MALE',
          ageInDays: 0,
          valueInBaseUnit: 3400,
        }).status,
      ).toBe('COMPUTED');
    });

    it('still computes on the last day inside the range', () => {
      expect(
        computeGrowthPercentile({
          indicator: 'LENGTH_OR_HEIGHT_FOR_AGE',
          sex: 'FEMALE',
          ageInDays: REFERENCE_MAX_AGE_DAYS,
          valueInBaseUnit: 1100,
        }).status,
      ).toBe('COMPUTED');
    });
  });
});

describe('resolveBodyMeasureReference (W-17 / W-18)', () => {
  it('uses recumbent length below the 24-month boundary', () => {
    expect(resolveBodyMeasureReference(729, null)).toBe('LENGTH');
    expect(resolveBodyMeasureReference(LENGTH_TO_HEIGHT_BOUNDARY_DAYS - 1, null)).toBe('LENGTH');
  });

  it('uses standing height from the boundary onwards', () => {
    expect(resolveBodyMeasureReference(731, null)).toBe('HEIGHT');
    expect(resolveBodyMeasureReference(LENGTH_TO_HEIGHT_BOUNDARY_DAYS, null)).toBe('HEIGHT');
  });

  it('matches the flag carried by the vendored table exactly at the boundary', () => {
    // The vendored file's own partition is the authority for where the switch
    // sits; this pins the resolver to it rather than to a hard-coded 730/731.
    expect(LENGTH_HEIGHT_FOR_AGE.male.length.at(-1)?.ageInDays).toBe(
      LENGTH_TO_HEIGHT_BOUNDARY_DAYS - 1,
    );
    expect(LENGTH_HEIGHT_FOR_AGE.male.height[0].ageInDays).toBe(LENGTH_TO_HEIGHT_BOUNDARY_DAYS);
  });

  it('lets a manual override win even when it contradicts the age', () => {
    expect(resolveBodyMeasureReference(400, 'STANDING')).toBe('HEIGHT');
    expect(resolveBodyMeasureReference(1200, 'LYING')).toBe('LENGTH');
  });

  describe('the WHO recumbent/standing cross-adjustment', () => {
    it('subtracts 0.7 cm for a 26-month-old measured lying down', () => {
      // Age 800 days: the reference row assumes standing height, but the child
      // was measured lying down, which reads about 0.7 cm taller.
      const params = {
        indicator: 'LENGTH_OR_HEIGHT_FOR_AGE' as const,
        sex: 'MALE' as const,
        ageInDays: 800,
        valueInBaseUnit: 860,
      };

      const auto = computeGrowthPercentile(params);
      const overridden = computeGrowthPercentile({
        ...params,
        bodyMeasurePositionOverride: 'LYING',
      });

      // The reported method follows the user's choice (W-19)...
      expect(auto).toMatchObject({ status: 'COMPUTED', referenceUsed: 'HEIGHT' });
      expect(overridden).toMatchObject({ status: 'COMPUTED', referenceUsed: 'LENGTH' });
      if (auto.status !== 'COMPUTED' || overridden.status !== 'COMPUTED') {
        return;
      }
      // ...and the score genuinely differs, rather than the override being
      // cosmetic.
      expect(overridden.zScore).toBeLessThan(auto.zScore);
      expect(overridden.zScore).toBeCloseTo(
        zScoreFromLms(
          85.3,
          LENGTH_HEIGHT_FOR_AGE.male.height[800 - LENGTH_TO_HEIGHT_BOUNDARY_DAYS],
        ),
        10,
      );
    });

    it('adds 0.7 cm for a 20-month-old measured standing', () => {
      const params = {
        indicator: 'LENGTH_OR_HEIGHT_FOR_AGE' as const,
        sex: 'FEMALE' as const,
        ageInDays: 600,
        valueInBaseUnit: 800,
      };

      const auto = computeGrowthPercentile(params);
      const overridden = computeGrowthPercentile({
        ...params,
        bodyMeasurePositionOverride: 'STANDING',
      });

      expect(auto).toMatchObject({ status: 'COMPUTED', referenceUsed: 'LENGTH' });
      expect(overridden).toMatchObject({ status: 'COMPUTED', referenceUsed: 'HEIGHT' });
      if (auto.status !== 'COMPUTED' || overridden.status !== 'COMPUTED') {
        return;
      }
      expect(overridden.zScore).toBeGreaterThan(auto.zScore);
      expect(overridden.zScore).toBeCloseTo(
        zScoreFromLms(80.7, LENGTH_HEIGHT_FOR_AGE.female.length[600]),
        10,
      );
    });

    it('applies no adjustment when the override agrees with the age', () => {
      const params = {
        indicator: 'LENGTH_OR_HEIGHT_FOR_AGE' as const,
        sex: 'FEMALE' as const,
        ageInDays: 400,
        valueInBaseUnit: 720,
      };

      const auto = computeGrowthPercentile(params);
      const overridden = computeGrowthPercentile({
        ...params,
        bodyMeasurePositionOverride: 'LYING',
      });

      expect(overridden).toMatchObject({ status: 'COMPUTED', referenceUsed: 'LENGTH' });
      if (auto.status !== 'COMPUTED' || overridden.status !== 'COMPUTED') {
        return;
      }
      expect(overridden.zScore).toBeCloseTo(auto.zScore, 10);
      expect(overridden.zScore).toBeCloseTo(
        zScoreFromLms(72, LENGTH_HEIGHT_FOR_AGE.female.length[400]),
        10,
      );
    });

    it('applies no adjustment at all without an override', () => {
      const withoutOverride = computeGrowthPercentile({
        indicator: 'LENGTH_OR_HEIGHT_FOR_AGE',
        sex: 'MALE',
        ageInDays: 1000,
        valueInBaseUnit: 900,
      });

      if (withoutOverride.status !== 'COMPUTED') {
        throw new Error('expected a computed outcome');
      }
      expect(withoutOverride.zScore).toBeCloseTo(
        zScoreFromLms(90, LENGTH_HEIGHT_FOR_AGE.male.height[1000 - LENGTH_TO_HEIGHT_BOUNDARY_DAYS]),
        10,
      );
    });
  });
});
