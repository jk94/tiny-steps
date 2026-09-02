import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChildSex } from '../child/child-sex.enum';
import { GrowthService, REFERENCE_BAND_STEP_DAYS } from './growth.service';
import { LengthMeasurementPosition } from './length-measurement-position.enum';
import { REFERENCE_MAX_AGE_DAYS } from './reference-data';

const HOUSEHOLD_ID = 'household-1';
const CHILD_ID = 'child-1';
const USER_ID = 'user-1';
const MEASUREMENT_ID = 'measurement-1';

const BIRTH_DATE = new Date('2025-01-01T00:00:00.000Z');
// 90 completed days after birth.
const MEASURED_AT = new Date('2025-04-01T09:00:00.000Z');

function makeChild(overrides: Record<string, unknown> = {}) {
  return {
    id: CHILD_ID,
    householdId: HOUSEHOLD_ID,
    name: 'Alex',
    birthDate: BIRTH_DATE,
    photoPath: null,
    photoMimeType: null,
    sex: ChildSex.MALE as string | null,
    createdAt: new Date('2025-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function makeGrowthMeasurement(overrides: Record<string, unknown> = {}) {
  return {
    id: MEASUREMENT_ID,
    childId: CHILD_ID,
    userId: USER_ID,
    measuredAt: MEASURED_AT,
    weightGrams: 6400,
    lengthMillimeters: 615,
    headCircumferenceMillimeters: 405,
    lengthMeasurementPosition: null as string | null,
    note: null as string | null,
    createdAt: new Date('2025-04-01T09:00:00.000Z'),
    updatedAt: new Date('2025-04-01T09:00:00.000Z'),
    ...overrides,
  };
}

describe('GrowthService', () => {
  let prisma: {
    child: { findUnique: jest.Mock };
    growthMeasurement: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let service: GrowthService;

  beforeEach(() => {
    prisma = {
      child: { findUnique: jest.fn() },
      growthMeasurement: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new GrowthService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('stores the recording user and passes the integer base-unit values through untouched', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.growthMeasurement.create.mockResolvedValue(makeGrowthMeasurement());

      const result = await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        measuredAt: MEASURED_AT.toISOString(),
        weightGrams: 6400,
        lengthMillimeters: 615,
        headCircumferenceMillimeters: 405,
      });

      expect(prisma.growthMeasurement.create).toHaveBeenCalledWith({
        data: {
          childId: CHILD_ID,
          userId: USER_ID,
          measuredAt: MEASURED_AT,
          weightGrams: 6400,
          lengthMillimeters: 615,
          headCircumferenceMillimeters: 405,
          lengthMeasurementPosition: null,
          note: null,
        },
      });
      expect(result.userId).toBe(USER_ID);
      expect(result.weightGrams).toBe(6400);
      expect(result.ageInDaysAtMeasurement).toBe(90);
    });

    it('returns a computed percentile for every supplied value', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.growthMeasurement.create.mockResolvedValue(makeGrowthMeasurement());

      const result = await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        measuredAt: MEASURED_AT.toISOString(),
        weightGrams: 6400,
      });

      expect(result.percentiles.weight).toMatchObject({ status: 'COMPUTED' });
      expect(result.percentiles.length).toMatchObject({ status: 'COMPUTED' });
      expect(result.percentiles.headCircumference).toMatchObject({ status: 'COMPUTED' });
      // A percentile is a plain number, not the raw z-score.
      const weight = result.percentiles.weight;
      if (weight?.status !== 'COMPUTED') {
        throw new Error('expected a computed weight percentile');
      }
      expect(weight.percentile).toBeGreaterThan(0);
      expect(weight.percentile).toBeLessThan(100);
    });

    it('leaves the percentile slot of an absent value at null', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.growthMeasurement.create.mockResolvedValue(
        makeGrowthMeasurement({ lengthMillimeters: null, headCircumferenceMillimeters: null }),
      );

      const result = await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        measuredAt: MEASURED_AT.toISOString(),
        weightGrams: 6400,
      });

      expect(result.percentiles.length).toBeNull();
      expect(result.percentiles.headCircumference).toBeNull();
      expect(result.lengthOrHeightReferenceUsed).toBeNull();
      expect(result.effectiveLengthMeasurementPosition).toBeNull();
    });

    it('rejects a measurement taken before the child was born (W-5)', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());

      await expect(
        service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
          measuredAt: '2024-12-31T23:00:00.000Z',
          weightGrams: 3400,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.growthMeasurement.create).not.toHaveBeenCalled();
    });

    it('allows several measurements on the same day (W-6)', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.growthMeasurement.create
        .mockResolvedValueOnce(makeGrowthMeasurement())
        .mockResolvedValueOnce(makeGrowthMeasurement({ id: 'measurement-2', weightGrams: 6450 }));

      const first = await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        measuredAt: '2025-04-01T09:00:00.000Z',
        weightGrams: 6400,
      });
      const second = await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        measuredAt: '2025-04-01T18:00:00.000Z',
        weightGrams: 6450,
      });

      expect(first.id).not.toBe(second.id);
      expect(prisma.growthMeasurement.create).toHaveBeenCalledTimes(2);
    });

    it('404s for a child from another household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(
        service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
          measuredAt: MEASURED_AT.toISOString(),
          weightGrams: 6400,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('percentile availability', () => {
    it('reports CHILD_SEX_NOT_SET for every value when the child has no sex (W-10)', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild({ sex: null }));
      prisma.growthMeasurement.create.mockResolvedValue(makeGrowthMeasurement());

      const result = await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        measuredAt: MEASURED_AT.toISOString(),
        weightGrams: 6400,
      });

      for (const percentile of Object.values(result.percentiles)) {
        expect(percentile).toEqual({ status: 'UNAVAILABLE', reason: 'CHILD_SEX_NOT_SET' });
      }
      // The values themselves are still returned — only the classification is
      // withheld.
      expect(result.weightGrams).toBe(6400);
    });

    it('reports AGE_ABOVE_REFERENCE_RANGE past the WHO 0-5y range (W-11)', async () => {
      const measuredAt = new Date(
        BIRTH_DATE.getTime() + (REFERENCE_MAX_AGE_DAYS + 10) * 24 * 60 * 60 * 1000,
      );
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.growthMeasurement.create.mockResolvedValue(makeGrowthMeasurement({ measuredAt }));

      const result = await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        measuredAt: measuredAt.toISOString(),
        weightGrams: 20000,
      });

      expect(result.percentiles.weight).toEqual({
        status: 'UNAVAILABLE',
        reason: 'AGE_ABOVE_REFERENCE_RANGE',
      });
    });
  });

  describe('body-measure method (W-17 / W-18 / W-19)', () => {
    it('derives the method from the age when no override is stored', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.growthMeasurement.findUnique.mockResolvedValue(makeGrowthMeasurement());

      const result = await service.findOne(HOUSEHOLD_ID, CHILD_ID, MEASUREMENT_ID);

      expect(result.lengthMeasurementPosition).toBeNull();
      expect(result.effectiveLengthMeasurementPosition).toBe(LengthMeasurementPosition.LYING);
      expect(result.lengthOrHeightReferenceUsed).toBe('LENGTH');
    });

    it('lets a stored override win over the age-derived method', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.growthMeasurement.findUnique.mockResolvedValue(
        makeGrowthMeasurement({ lengthMeasurementPosition: LengthMeasurementPosition.STANDING }),
      );

      const result = await service.findOne(HOUSEHOLD_ID, CHILD_ID, MEASUREMENT_ID);

      expect(result.lengthMeasurementPosition).toBe(LengthMeasurementPosition.STANDING);
      expect(result.effectiveLengthMeasurementPosition).toBe(LengthMeasurementPosition.STANDING);
      expect(result.lengthOrHeightReferenceUsed).toBe('HEIGHT');
    });
  });

  describe('list', () => {
    it('returns the child measurements chronologically, oldest first', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.growthMeasurement.findMany.mockResolvedValue([makeGrowthMeasurement()]);

      await service.list(HOUSEHOLD_ID, CHILD_ID);

      expect(prisma.growthMeasurement.findMany).toHaveBeenCalledWith({
        where: { childId: CHILD_ID },
        orderBy: { measuredAt: 'asc' },
      });
    });

    it('translates from/to into a half-open measuredAt filter', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.growthMeasurement.findMany.mockResolvedValue([]);

      await service.list(HOUSEHOLD_ID, CHILD_ID, {
        from: '2025-01-01T00:00:00.000Z',
        to: '2025-06-01T00:00:00.000Z',
      });

      expect(prisma.growthMeasurement.findMany).toHaveBeenCalledWith({
        where: {
          childId: CHILD_ID,
          measuredAt: {
            gte: new Date('2025-01-01T00:00:00.000Z'),
            lt: new Date('2025-06-01T00:00:00.000Z'),
          },
        },
        orderBy: { measuredAt: 'asc' },
      });
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.growthMeasurement.findUnique.mockResolvedValue(makeGrowthMeasurement());
    });

    it('writes only the fields present in the request body', async () => {
      prisma.growthMeasurement.update.mockResolvedValue(
        makeGrowthMeasurement({ weightGrams: 6600 }),
      );

      const result = await service.update(HOUSEHOLD_ID, CHILD_ID, MEASUREMENT_ID, {
        weightGrams: 6600,
      });

      expect(prisma.growthMeasurement.update).toHaveBeenCalledWith({
        where: { id: MEASUREMENT_ID },
        data: { weightGrams: 6600 },
      });
      expect(result.weightGrams).toBe(6600);
    });

    it('clears a single value when it is explicitly set to null', async () => {
      prisma.growthMeasurement.update.mockResolvedValue(
        makeGrowthMeasurement({ headCircumferenceMillimeters: null }),
      );

      const result = await service.update(HOUSEHOLD_ID, CHILD_ID, MEASUREMENT_ID, {
        headCircumferenceMillimeters: null,
      });

      expect(prisma.growthMeasurement.update).toHaveBeenCalledWith({
        where: { id: MEASUREMENT_ID },
        data: { headCircumferenceMillimeters: null },
      });
      expect(result.headCircumferenceMillimeters).toBeNull();
    });

    it('reverts to the automatic method when the override is cleared', async () => {
      prisma.growthMeasurement.findUnique.mockResolvedValue(
        makeGrowthMeasurement({ lengthMeasurementPosition: LengthMeasurementPosition.STANDING }),
      );
      prisma.growthMeasurement.update.mockResolvedValue(
        makeGrowthMeasurement({ lengthMeasurementPosition: null }),
      );

      const result = await service.update(HOUSEHOLD_ID, CHILD_ID, MEASUREMENT_ID, {
        lengthMeasurementPosition: null,
      });

      expect(prisma.growthMeasurement.update).toHaveBeenCalledWith({
        where: { id: MEASUREMENT_ID },
        data: { lengthMeasurementPosition: null },
      });
      expect(result.lengthMeasurementPosition).toBeNull();
      expect(result.effectiveLengthMeasurementPosition).toBe(LengthMeasurementPosition.LYING);
    });

    it('rejects an update that would clear all three values (W-1)', async () => {
      await expect(
        service.update(HOUSEHOLD_ID, CHILD_ID, MEASUREMENT_ID, {
          weightGrams: null,
          lengthMillimeters: null,
          headCircumferenceMillimeters: null,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.growthMeasurement.update).not.toHaveBeenCalled();
    });

    it('accepts clearing two of three values', async () => {
      prisma.growthMeasurement.update.mockResolvedValue(
        makeGrowthMeasurement({ lengthMillimeters: null, headCircumferenceMillimeters: null }),
      );

      await expect(
        service.update(HOUSEHOLD_ID, CHILD_ID, MEASUREMENT_ID, {
          lengthMillimeters: null,
          headCircumferenceMillimeters: null,
        }),
      ).resolves.toMatchObject({ weightGrams: 6400 });
    });

    it('rejects moving a measurement before the child birth date (W-5)', async () => {
      await expect(
        service.update(HOUSEHOLD_ID, CHILD_ID, MEASUREMENT_ID, {
          measuredAt: '2024-06-01T00:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.growthMeasurement.update).not.toHaveBeenCalled();
    });

    it('404s for a measurement belonging to another child', async () => {
      prisma.growthMeasurement.findUnique.mockResolvedValue(null);

      await expect(
        service.update(HOUSEHOLD_ID, CHILD_ID, MEASUREMENT_ID, { weightGrams: 6600 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('hard-deletes the measurement (W-8)', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.growthMeasurement.findUnique.mockResolvedValue(makeGrowthMeasurement());
      prisma.growthMeasurement.delete.mockResolvedValue(makeGrowthMeasurement());

      await service.remove(HOUSEHOLD_ID, CHILD_ID, MEASUREMENT_ID);

      expect(prisma.growthMeasurement.delete).toHaveBeenCalledWith({
        where: { id: MEASUREMENT_ID },
      });
    });

    it('404s instead of deleting a measurement from another household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.remove(HOUSEHOLD_ID, CHILD_ID, MEASUREMENT_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.growthMeasurement.delete).not.toHaveBeenCalled();
    });
  });

  describe('getReference', () => {
    it('returns the five WHO percentile curves over the whole age range', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());

      const reference = await service.getReference(HOUSEHOLD_ID, CHILD_ID, 'WEIGHT_FOR_AGE');

      if (!reference.available) {
        throw new Error('expected the reference to be available');
      }
      expect(reference.curves.map((curve) => curve.percentile)).toEqual([3, 15, 50, 85, 97]);
      expect(reference.stepDays).toBe(REFERENCE_BAND_STEP_DAYS);
      expect(reference.unit).toBe('GRAMS');
      expect(reference.curves[0].points[0].ageInDays).toBe(0);
      expect(reference.curves[0].points.at(-1)?.ageInDays).toBe(REFERENCE_MAX_AGE_DAYS);
    });

    it('places the P50 curve at the published newborn median', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());

      const reference = await service.getReference(HOUSEHOLD_ID, CHILD_ID, 'WEIGHT_FOR_AGE');

      if (!reference.available) {
        throw new Error('expected the reference to be available');
      }
      const median = reference.curves.find((curve) => curve.percentile === 50);
      // WHO weight-for-age, boys, day 0: M = 3.3464 kg -> 3346 g.
      expect(median?.points[0].value).toBe(3346);
    });

    it('keeps the curves ordered by percentile at any fixed age', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());

      const reference = await service.getReference(
        HOUSEHOLD_ID,
        CHILD_ID,
        'HEAD_CIRCUMFERENCE_FOR_AGE',
      );

      if (!reference.available) {
        throw new Error('expected the reference to be available');
      }
      const sampleIndex = 20;
      const valuesAtSample = reference.curves.map((curve) => curve.points[sampleIndex].value);
      expect(valuesAtSample).toEqual([...valuesAtSample].sort((a, b) => a - b));
    });

    it('reports the body-measure boundary so the chart can label the switch', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());

      const reference = await service.getReference(
        HOUSEHOLD_ID,
        CHILD_ID,
        'LENGTH_OR_HEIGHT_FOR_AGE',
      );

      if (!reference.available) {
        throw new Error('expected the reference to be available');
      }
      expect(reference.lengthToHeightBoundaryDays).toBe(731);
      expect(reference.unit).toBe('MILLIMETERS');
    });

    it('reports the missing sex instead of a sex-neutral approximation (W-10)', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild({ sex: null }));

      const reference = await service.getReference(HOUSEHOLD_ID, CHILD_ID, 'WEIGHT_FOR_AGE');

      expect(reference).toEqual({
        indicator: 'WEIGHT_FOR_AGE',
        sex: null,
        available: false,
        reason: 'CHILD_SEX_NOT_SET',
      });
    });
  });
});
