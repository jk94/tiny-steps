import { EXCEPTION_FILTERS_METADATA } from '@nestjs/common/constants';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { HOUSEHOLD_ROLES_KEY } from '../household/guards/require-role.decorator';
import { HealthRecordValidationExceptionFilter } from './filters/health-record-validation.exception-filter';
import { HealthRecordKind } from './health-record-kind.enum';
import { HealthRecordController } from './health-record.controller';
import { HealthRecordService } from './health-record.service';
import type { HealthRecordSummary } from './health-record.service';

const HOUSEHOLD_ID = 'household-1';
const CHILD_ID = 'child-1';
const RECORD_ID = 'health-record-1';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'parent@example.com',
  name: 'Parent',
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
};

const summary: HealthRecordSummary = {
  id: RECORD_ID,
  childId: CHILD_ID,
  userId: user.id,
  kind: HealthRecordKind.MEDICATION,
  name: 'Paracetamol',
  administeredAt: '2025-08-20T14:30:00.000Z',
  dueAt: null,
  doseAmount: 5,
  doseUnit: 'ml',
  vaccineBatch: null,
  note: null,
  reminderEnabled: false,
  createdAt: '2025-08-21T09:00:00.000Z',
  updatedAt: '2025-08-21T09:00:00.000Z',
};

const ROUTE_METHOD_NAMES = ['create', 'list', 'getOne', 'update', 'remove'] as const;

/** The `@UseGuards(...)` classes Nest recorded for one controller method. */
function guardsOf(methodName: (typeof ROUTE_METHOD_NAMES)[number]): unknown[] {
  return (Reflect.getMetadata('__guards__', HealthRecordController.prototype[methodName]) ??
    []) as unknown[];
}

/** The `@UseFilters(...)` classes Nest recorded for one controller method. */
function filtersOf(methodName: (typeof ROUTE_METHOD_NAMES)[number]): unknown[] {
  return (Reflect.getMetadata(
    EXCEPTION_FILTERS_METADATA,
    HealthRecordController.prototype[methodName],
  ) ?? []) as unknown[];
}

describe('HealthRecordController', () => {
  let healthRecordService: jest.Mocked<
    Pick<HealthRecordService, 'create' | 'list' | 'findOne' | 'update' | 'remove'>
  >;
  let controller: HealthRecordController;

  beforeEach(() => {
    healthRecordService = {
      create: jest.fn(),
      list: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    controller = new HealthRecordController(healthRecordService as unknown as HealthRecordService);
  });

  it('delegates create with the current user id (MED-1)', async () => {
    healthRecordService.create.mockResolvedValue(summary);
    const dto = {
      kind: HealthRecordKind.MEDICATION,
      name: 'Paracetamol',
      administeredAt: '2025-08-20T14:30:00.000Z',
    };

    const result = await controller.create(HOUSEHOLD_ID, CHILD_ID, dto, user);

    expect(healthRecordService.create).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, user.id, dto);
    expect(result).toBe(summary);
  });

  it('forwards the kind/status filters to list', async () => {
    healthRecordService.list.mockResolvedValue([summary]);
    const query = { kind: HealthRecordKind.VACCINATION, status: 'planned' as const };

    const result = await controller.list(HOUSEHOLD_ID, CHILD_ID, query);

    expect(healthRecordService.list).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, query);
    expect(result).toEqual([summary]);
  });

  it('delegates getOne with the record id', async () => {
    healthRecordService.findOne.mockResolvedValue(summary);

    const result = await controller.getOne(HOUSEHOLD_ID, CHILD_ID, RECORD_ID);

    expect(healthRecordService.findOne).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, RECORD_ID);
    expect(result).toBe(summary);
  });

  it('delegates a "mark as done" patch like any other update (MED-5)', async () => {
    healthRecordService.update.mockResolvedValue(summary);
    const dto = { administeredAt: '2025-08-20T14:30:00.000Z' };

    const result = await controller.update(HOUSEHOLD_ID, CHILD_ID, RECORD_ID, dto);

    expect(healthRecordService.update).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, RECORD_ID, dto);
    expect(result).toBe(summary);
  });

  it('delegates remove and returns nothing', async () => {
    healthRecordService.remove.mockResolvedValue(undefined);

    await expect(controller.remove(HOUSEHOLD_ID, CHILD_ID, RECORD_ID)).resolves.toBeUndefined();
    expect(healthRecordService.remove).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, RECORD_ID);
  });

  describe('route metadata', () => {
    it('answers DELETE with 204 No Content', () => {
      expect(Reflect.getMetadata('__httpCode__', HealthRecordController.prototype.remove)).toBe(
        204,
      );
    });

    it.each(['create', 'update', 'remove'] as const)(
      'guards the write route %s with authentication, membership and CSRF',
      (methodName) => {
        expect(guardsOf(methodName)).toEqual([JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard]);
      },
    );

    it.each(['list', 'getOne'] as const)(
      'guards the read route %s with authentication and membership only',
      (methodName) => {
        expect(guardsOf(methodName)).toEqual([JwtAuthGuard, HouseholdMembershipGuard]);
      },
    );

    // The filter is what turns the global ValidationPipe's flat message array
    // into the `{ code, fields }` body the frontend's error mapping reads.
    it.each(['create', 'update', 'remove'] as const)(
      'reshapes validation failures on %s',
      (methodName) => {
        expect(filtersOf(methodName)).toEqual([HealthRecordValidationExceptionFilter]);
      },
    );

    // Deliberate: no route requires a specific household role — both OWNER and
    // CO_PARENT may record and manage health records, exactly like the event,
    // growth and milestone controllers. The Betreuer/Beobachter audit is Phase
    // 7.5's job.
    it.each(ROUTE_METHOD_NAMES)('%s has no required role', (methodName) => {
      expect(
        Reflect.getMetadata(HOUSEHOLD_ROLES_KEY, HealthRecordController.prototype[methodName]),
      ).toBeUndefined();
    });
  });
});
