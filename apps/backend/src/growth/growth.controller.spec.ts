import { CsrfGuard } from '../auth/guards/csrf.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import type { HouseholdActor } from '../household/decorators/household-actor.decorator';
import { HOUSEHOLD_ROLES_KEY } from '../household/guards/require-role.decorator';
import { ENTRY_WRITE_ROLES, FULL_WRITE_ROLES } from '../household/household-permissions';
import { HouseholdRole } from '../household/household-role.enum';
import { GrowthController } from './growth.controller';
import { GrowthService } from './growth.service';
import type { GrowthMeasurementSummary, GrowthReferenceResponse } from './growth.service';

const HOUSEHOLD_ID = 'household-1';
const CHILD_ID = 'child-1';
const MEASUREMENT_ID = 'measurement-1';

// Role scoping (Phase 7.5): the controller only forwards the injected actor,
// so one representative value is enough here — the role rules themselves are
// covered by the guard, service and e2e specs.
const OWNER_ACTOR: HouseholdActor = { userId: 'user-1', role: HouseholdRole.OWNER };

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

/** Route method → the exact role bundle its `@RequireRole` must declare. */
const ROLE_SCOPED_ROUTES = [
  ['create', ENTRY_WRITE_ROLES],
  ['update', ENTRY_WRITE_ROLES],
  ['remove', FULL_WRITE_ROLES],
] as const;

/** Routes any household member may call, so they carry no role metadata. */
const READ_OPEN_ROUTES = ['list', 'getReference', 'getOne'] as const;

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

    const result = await controller.update(
      HOUSEHOLD_ID,
      CHILD_ID,
      MEASUREMENT_ID,
      dto,
      OWNER_ACTOR,
    );

    expect(growthService.update).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      MEASUREMENT_ID,
      OWNER_ACTOR,
      dto,
    );
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

    it('sets no Cache-Control on the reference bands', () => {
      // The response depends on `Child.sex`, so an HTTP cache would keep
      // serving `available: false` after a parent fills that field in.
      expect(
        Reflect.getMetadata('__headers__', GrowthController.prototype.getReference),
      ).toBeUndefined();
    });

    it('classifies every route as either role-scoped or read-open', () => {
      // Catches a newly added route that nobody classified below.
      expect([...ROLE_SCOPED_ROUTES.map(([name]) => name), ...READ_OPEN_ROUTES].sort()).toEqual(
        [...ROUTE_METHOD_NAMES].sort(),
      );
    });

    // Every writing route must carry an explicit role requirement (ROL-2) —
    // `HouseholdMembershipGuard` rejects unannotated writes outright.
    it.each(ROLE_SCOPED_ROUTES)('%s requires the expected roles', (methodName, expectedRoles) => {
      expect(
        Reflect.getMetadata(HOUSEHOLD_ROLES_KEY, GrowthController.prototype[methodName]),
      ).toEqual([...expectedRoles]);
    });

    it.each(READ_OPEN_ROUTES)('leaves the read route %s open to any member', (methodName) => {
      expect(
        Reflect.getMetadata(HOUSEHOLD_ROLES_KEY, GrowthController.prototype[methodName]),
      ).toBeUndefined();
    });
  });
});
