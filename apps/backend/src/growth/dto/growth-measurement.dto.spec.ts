import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  MAX_HEAD_CIRCUMFERENCE_MILLIMETERS,
  MAX_LENGTH_MILLIMETERS,
  MAX_NOTE_LENGTH,
  MAX_WEIGHT_GRAMS,
  MIN_WEIGHT_GRAMS,
} from '../growth-measurement.constants';
import { LengthMeasurementPosition } from '../length-measurement-position.enum';
import { CreateGrowthMeasurementDto } from './create-growth-measurement.dto';
import { UpdateGrowthMeasurementDto } from './update-growth-measurement.dto';

const MEASURED_AT = '2025-04-01';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Mirrors the global ValidationPipe's `transform: true` behaviour. */
function failingProperties<T extends object>(
  cls: new () => T,
  payload: Record<string, unknown>,
): string[] {
  const dto = plainToInstance(cls, payload);
  return validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).map(
    (error) => error.property,
  );
}

describe('CreateGrowthMeasurementDto', () => {
  it('accepts a measurement carrying only one of the three values (W-2)', () => {
    expect(
      failingProperties(CreateGrowthMeasurementDto, {
        measuredAt: MEASURED_AT,
        lengthMillimeters: 615,
      }),
    ).toEqual([]);
  });

  it('rejects a body with no measurement value at all (W-1)', () => {
    expect(failingProperties(CreateGrowthMeasurementDto, { measuredAt: MEASURED_AT })).toEqual([
      'measuredAt',
    ]);
  });

  it('rejects a fractional weight, since values are integer base units (W-3)', () => {
    expect(
      failingProperties(CreateGrowthMeasurementDto, {
        measuredAt: MEASURED_AT,
        weightGrams: 3200.5,
      }),
    ).toEqual(['weightGrams']);
  });

  it.each([
    ['below the lower plausibility limit', MIN_WEIGHT_GRAMS - 1],
    ['above the upper plausibility limit', MAX_WEIGHT_GRAMS + 1],
  ])('rejects a weight %s (W-4)', (_label, weightGrams) => {
    expect(
      failingProperties(CreateGrowthMeasurementDto, { measuredAt: MEASURED_AT, weightGrams }),
    ).toEqual(['weightGrams']);
  });

  it('rejects implausible length and head circumference values (W-4)', () => {
    expect(
      failingProperties(CreateGrowthMeasurementDto, {
        measuredAt: MEASURED_AT,
        lengthMillimeters: MAX_LENGTH_MILLIMETERS + 1,
        headCircumferenceMillimeters: MAX_HEAD_CIRCUMFERENCE_MILLIMETERS + 1,
      }),
    ).toEqual(['lengthMillimeters', 'headCircumferenceMillimeters']);
  });

  it('accepts today as a calendar day', () => {
    expect(
      failingProperties(CreateGrowthMeasurementDto, {
        measuredAt: new Date().toISOString().slice(0, 10),
        weightGrams: 6400,
      }),
    ).toEqual([]);
  });

  it('rejects a calendar day in the future (W-5)', () => {
    expect(
      failingProperties(CreateGrowthMeasurementDto, {
        measuredAt: new Date(Date.now() + 5 * ONE_DAY_MS).toISOString().slice(0, 10),
        weightGrams: 6400,
      }),
    ).toEqual(['measuredAt']);
  });

  it('rejects a full instant, which would make the stored day timezone-dependent', () => {
    expect(
      failingProperties(CreateGrowthMeasurementDto, {
        measuredAt: '2025-04-01T09:00:00.000Z',
        weightGrams: 6400,
      }),
    ).toEqual(['measuredAt']);
  });

  it('rejects a non-ISO measurement date', () => {
    expect(
      failingProperties(CreateGrowthMeasurementDto, {
        measuredAt: '01.04.2025',
        weightGrams: 6400,
      }),
    ).toEqual(['measuredAt']);
  });

  it('accepts a manual position override (W-18)', () => {
    expect(
      failingProperties(CreateGrowthMeasurementDto, {
        measuredAt: MEASURED_AT,
        lengthMillimeters: 615,
        lengthMeasurementPosition: LengthMeasurementPosition.STANDING,
      }),
    ).toEqual([]);
  });

  it('rejects AUTO as a position, since that is expressed by omitting the field', () => {
    expect(
      failingProperties(CreateGrowthMeasurementDto, {
        measuredAt: MEASURED_AT,
        lengthMillimeters: 615,
        lengthMeasurementPosition: 'AUTO',
      }),
    ).toEqual(['lengthMeasurementPosition']);
  });

  it('rejects an over-long note', () => {
    expect(
      failingProperties(CreateGrowthMeasurementDto, {
        measuredAt: MEASURED_AT,
        weightGrams: 6400,
        note: 'x'.repeat(MAX_NOTE_LENGTH + 1),
      }),
    ).toEqual(['note']);
  });
});

describe('UpdateGrowthMeasurementDto', () => {
  it('accepts an empty body, since every field is optional', () => {
    expect(failingProperties(UpdateGrowthMeasurementDto, {})).toEqual([]);
  });

  it('accepts a note-only edit without any measurement value', () => {
    // The "at least one value" rule (W-1) is re-checked against the merged row
    // in GrowthService.update, not here.
    expect(failingProperties(UpdateGrowthMeasurementDto, { note: 'U4 check-up' })).toEqual([]);
  });

  it.each([
    ['weightGrams'],
    ['lengthMillimeters'],
    ['headCircumferenceMillimeters'],
    ['lengthMeasurementPosition'],
    ['note'],
  ])('accepts an explicit null on %s as "clear this field"', (field) => {
    expect(failingProperties(UpdateGrowthMeasurementDto, { [field]: null })).toEqual([]);
  });

  it('still enforces the plausibility limits on a supplied value (W-4)', () => {
    expect(
      failingProperties(UpdateGrowthMeasurementDto, { weightGrams: MAX_WEIGHT_GRAMS + 1 }),
    ).toEqual(['weightGrams']);
  });

  it('rejects a full instant on update too', () => {
    expect(
      failingProperties(UpdateGrowthMeasurementDto, {
        measuredAt: '2025-04-01T09:00:00.000Z',
      }),
    ).toEqual(['measuredAt']);
  });

  it('rejects an unknown field, matching the global whitelist pipe', () => {
    // `clientTimestamp` is deliberately absent: growth tracking is online-only
    // (W-16), so ADR-0011's Last-Write-Wins never applies here.
    expect(
      failingProperties(UpdateGrowthMeasurementDto, {
        clientTimestamp: '2025-04-01T09:00:00.000Z',
      }),
    ).toEqual(['clientTimestamp']);
  });
});
