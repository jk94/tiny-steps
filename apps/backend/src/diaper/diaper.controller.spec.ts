import { HOUSEHOLD_ROLES_KEY } from '../household/guards/require-role.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { EventType } from '../event/event-type.enum';
import { CreateDiaperEventDto } from './dto/create-diaper-event.dto';
import { UpdateDiaperEventDto } from './dto/update-diaper-event.dto';
import { DiaperController } from './diaper.controller';
import { DiaperService } from './diaper.service';
import type { DiaperEventSummary } from './diaper.service';
import { DiaperType } from './diaper-type.enum';

const HOUSEHOLD_ID = 'household-1';
const CHILD_ID = 'child-1';
const EVENT_ID = 'event-1';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'parent@example.com',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
};

const summary: DiaperEventSummary = {
  id: EVENT_ID,
  childId: CHILD_ID,
  userId: user.id,
  type: EventType.DIAPER,
  diaperType: DiaperType.PEE,
  occurredAt: new Date('2026-01-01T10:00:00.000Z'),
  note: null,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
};

const ROUTE_METHOD_NAMES = ['create', 'list', 'getOne', 'update', 'remove'] as const;

describe('DiaperController', () => {
  let diaperService: jest.Mocked<
    Pick<DiaperService, 'create' | 'list' | 'findOne' | 'update' | 'remove'>
  >;
  let controller: DiaperController;

  beforeEach(() => {
    diaperService = {
      create: jest.fn(),
      list: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    controller = new DiaperController(diaperService as unknown as DiaperService);
  });

  describe('create', () => {
    it('delegates to DiaperService.create with householdId, childId, the current user id, and the dto', async () => {
      diaperService.create.mockResolvedValue(summary);
      const dto: CreateDiaperEventDto = { diaperType: DiaperType.PEE };

      const result = await controller.create(HOUSEHOLD_ID, CHILD_ID, dto, user);

      expect(diaperService.create).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, user.id, dto);
      expect(result).toBe(summary);
    });
  });

  describe('list', () => {
    it('delegates to DiaperService.list with householdId and childId', async () => {
      diaperService.list.mockResolvedValue([summary]);

      const result = await controller.list(HOUSEHOLD_ID, CHILD_ID);

      expect(diaperService.list).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID);
      expect(result).toEqual([summary]);
    });
  });

  describe('getOne', () => {
    it('delegates to DiaperService.findOne with householdId, childId, eventId', async () => {
      diaperService.findOne.mockResolvedValue(summary);

      const result = await controller.getOne(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

      expect(diaperService.findOne).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);
      expect(result).toBe(summary);
    });
  });

  describe('update', () => {
    it('delegates to DiaperService.update with householdId, childId, eventId, dto', async () => {
      diaperService.update.mockResolvedValue(summary);
      const dto: UpdateDiaperEventDto = { note: 'updated' };

      const result = await controller.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, dto);

      expect(diaperService.update).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, dto);
      expect(result).toBe(summary);
    });
  });

  describe('remove', () => {
    it('delegates to DiaperService.remove with householdId, childId, eventId', async () => {
      diaperService.remove.mockResolvedValue(undefined);

      await controller.remove(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

      expect(diaperService.remove).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);
    });
  });

  describe('role requirements', () => {
    // Deliberate deviation from ChildController: no route on this
    // controller carries `@RequireRole` — both OWNER and CO_PARENT may
    // create/edit/delete Diaper events (see the controller's own doc
    // comment). Asserted explicitly here so a future reader doesn't wonder
    // why there's no 403 test for this controller.
    it.each(ROUTE_METHOD_NAMES)('%s has no required role', (methodName) => {
      const roles = Reflect.getMetadata(
        HOUSEHOLD_ROLES_KEY,
        DiaperController.prototype[methodName],
      );
      expect(roles).toBeUndefined();
    });
  });
});
