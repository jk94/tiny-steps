import { CsrfGuard } from '../auth/guards/csrf.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { HOUSEHOLD_ROLES_KEY } from '../household/guards/require-role.decorator';
import { GrowthController } from './growth.controller';
import { GrowthService } from './growth.service';
import type { GrowthMeasurementSummary, GrowthReferenceResponse } from './growth.service';

const HOUSEHOLD_ID = 'household-1';
const CHILD_ID = 'child-1';
const MEASUREMENT_ID = 'measurement-1';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'parent@example.com',
  name: 'Parent',
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
};

const summary: GrowthMeasurementSummary = {
  id: MEASUREMENT_ID,
  childId: CHILD_ID,
  userId: user.id,
  measuredAt: new Date('2025-04-01T09:00:00.000Z'),
  ageInDaysAtMeasurement: 90,
  weightGrams: 6400,
  lengthMillimeters: 615,
  headCircumferenceMillimeters: 405,
  lengthMeasurementPosition: null,
  effectiveLengthMeasurementPosition: null,
  lengthOrHeightReferenceUsed: null,
  note: null,
  createdAt: new Date('2025-04-01T09:00:00.000Z'),
  updatedAt: new Date('2025-04-01T09:00:00.000Z'),
  percentiles: { weight: null, length: null, headCircumference: null },
};

const reference: GrowthReferenceResponse = {
  indicator: 'WEIGHT_FOR_AGE',
  sex: null,
  available: false,
  reason: 'CHILD_SEX_NOT_SET',
};

const ROUTE_METHOD_NAMES = [
  'create',
  'list',
  'getReference',
  'getOne',
  'update',
  'remove',
] as const;

/** The `@UseGuards(...)` classes Nest recorded for one controller method. */
function guardsOf(methodName: (typeof ROUTE_METHOD_NAMES)[number]): unknown[] {
  return (Reflect.getMetadata('__guards__', GrowthController.prototype[methodName]) ??
    []) as unknown[];
}

describe('GrowthController', () => {
  let growthService: jest.Mocked<
    Pick<GrowthService, 'create' | 'list' | 'findOne' | 'update' | 'remove' | 'getReference'>
  >;
  let controller: GrowthController;

  beforeEach(() => {
    growthService = {
      create: jest.fn(),
      list: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getReference: jest.fn(),
    };
    controller = new GrowthController(growthService as unknown as GrowthService);
  });

  it('delegates create with the current user id', async () => {
    growthService.create.mockResolvedValue(summary);
    const dto = { measuredAt: '2025-04-01T09:00:00.000Z', weightGrams: 6400 };

    const result = await controller.create(HOUSEHOLD_ID, CHILD_ID, dto, user);

    expect(growthService.create).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, user.id, dto);
    expect(result).toBe(summary);
  });

  it('forwards the optional from/to range to list', async () => {
    growthService.list.mockResolvedValue([summary]);
    const range = { from: '2025-01-01T00:00:00.000Z', to: '2025-06-01T00:00:00.000Z' };

    const result = await controller.list(HOUSEHOLD_ID, CHILD_ID, range);

    expect(growthService.list).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, range);
    expect(result).toEqual([summary]);
  });

  it('delegates the reference bands with the requested indicator', async () => {
    growthService.getReference.mockResolvedValue(reference);

    const result = await controller.getReference(HOUSEHOLD_ID, CHILD_ID, {
      indicator: 'WEIGHT_FOR_AGE',
    });

    expect(growthService.getReference).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      'WEIGHT_FOR_AGE',
    );
    expect(result).toBe(reference);
  });

  it('delegates getOne with the measurement id', async () => {
    growthService.findOne.mockResolvedValue(summary);

    const result = await controller.getOne(HOUSEHOLD_ID, CHILD_ID, MEASUREMENT_ID);

    expect(growthService.findOne).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, MEASUREMENT_ID);
    expect(result).toBe(summary);
  });

  it('delegates update with the measurement id and the dto', async () => {
    growthService.update.mockResolvedValue(summary);
    const dto = { note: 'U3 check-up' };

    const result = await controller.update(HOUSEHOLD_ID, CHILD_ID, MEASUREMENT_ID, dto);

    expect(growthService.update).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, MEASUREMENT_ID, dto);
    expect(result).toBe(summary);
  });

  it('delegates remove and returns nothing', async () => {
    growthService.remove.mockResolvedValue(undefined);

    await expect(
      controller.remove(HOUSEHOLD_ID, CHILD_ID, MEASUREMENT_ID),
    ).resolves.toBeUndefined();
    expect(growthService.remove).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, MEASUREMENT_ID);
  });

  describe('route metadata', () => {
    it('answers DELETE with 204 No Content', () => {
      expect(Reflect.getMetadata('__httpCode__', GrowthController.prototype.remove)).toBe(204);
    });

    it.each(['create', 'update', 'remove'] as const)(
      'guards the write route %s with authentication, membership and CSRF',
      (methodName) => {
        expect(guardsOf(methodName)).toEqual([JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard]);
      },
    );

    it.each(['list', 'getReference', 'getOne'] as const)(
      'guards the read route %s with authentication and membership only',
      (methodName) => {
        expect(guardsOf(methodName)).toEqual([JwtAuthGuard, HouseholdMembershipGuard]);
      },
    );

    it('caches the static reference bands for a day', () => {
      const headers = Reflect.getMetadata(
        '__headers__',
        GrowthController.prototype.getReference,
      ) as { name: string; value: string }[];
      expect(headers).toContainEqual({
        name: 'Cache-Control',
        value: 'private, max-age=86400',
      });
    });

    // Deliberate: no route requires a specific household role — both OWNER and
    // CO_PARENT may record and manage measurements, exactly like the event
    // controllers (see the controller's doc comment).
    it.each(ROUTE_METHOD_NAMES)('%s has no required role', (methodName) => {
      expect(
        Reflect.getMetadata(HOUSEHOLD_ROLES_KEY, GrowthController.prototype[methodName]),
      ).toBeUndefined();
    });
  });
});
