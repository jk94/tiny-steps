import { HOUSEHOLD_ROLES_KEY } from '../household/guards/require-role.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { EventType } from '../event/event-type.enum';
import { CreateSleepEventDto } from './dto/create-sleep-event.dto';
import { UpdateSleepEventDto } from './dto/update-sleep-event.dto';
import { SleepController } from './sleep.controller';
import { SleepService } from './sleep.service';
import type { SleepEventSummary } from './sleep.service';

const HOUSEHOLD_ID = 'household-1';
const CHILD_ID = 'child-1';
const EVENT_ID = 'event-1';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'parent@example.com',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
};

const summary: SleepEventSummary = {
  id: EVENT_ID,
  childId: CHILD_ID,
  userId: user.id,
  type: EventType.SLEEP,
  occurredAt: new Date('2026-01-01T20:00:00.000Z'),
  startedAt: new Date('2026-01-01T20:00:00.000Z'),
  endedAt: null,
  durationSeconds: null,
  createdAt: new Date('2026-01-01T20:00:00.000Z'),
};

const ROUTE_METHOD_NAMES = [
  'create',
  'list',
  'getActiveTimer',
  'getOne',
  'update',
  'remove',
  'stop',
] as const;

describe('SleepController', () => {
  let sleepService: jest.Mocked<
    Pick<
      SleepService,
      'create' | 'list' | 'findActiveTimer' | 'findOne' | 'update' | 'remove' | 'stop'
    >
  >;
  let controller: SleepController;

  beforeEach(() => {
    sleepService = {
      create: jest.fn(),
      list: jest.fn(),
      findActiveTimer: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      stop: jest.fn(),
    };
    controller = new SleepController(sleepService as unknown as SleepService);
  });

  describe('create', () => {
    it('delegates to SleepService.create with householdId, childId, the current user id, and the dto', async () => {
      sleepService.create.mockResolvedValue(summary);
      const dto: CreateSleepEventDto = {};

      const result = await controller.create(HOUSEHOLD_ID, CHILD_ID, dto, user);

      expect(sleepService.create).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, user.id, dto);
      expect(result).toBe(summary);
    });
  });

  describe('list', () => {
    it('delegates to SleepService.list with householdId and childId', async () => {
      sleepService.list.mockResolvedValue([summary]);

      const result = await controller.list(HOUSEHOLD_ID, CHILD_ID);

      expect(sleepService.list).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID);
      expect(result).toEqual([summary]);
    });
  });

  describe('getActiveTimer', () => {
    it('delegates to SleepService.findActiveTimer with householdId and childId', async () => {
      sleepService.findActiveTimer.mockResolvedValue(null);

      const result = await controller.getActiveTimer(HOUSEHOLD_ID, CHILD_ID);

      expect(sleepService.findActiveTimer).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID);
      expect(result).toBeNull();
    });
  });

  describe('getOne', () => {
    it('delegates to SleepService.findOne with householdId, childId, eventId', async () => {
      sleepService.findOne.mockResolvedValue(summary);

      const result = await controller.getOne(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

      expect(sleepService.findOne).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);
      expect(result).toBe(summary);
    });
  });

  describe('update', () => {
    it('delegates to SleepService.update with householdId, childId, eventId, dto', async () => {
      sleepService.update.mockResolvedValue(summary);
      const dto: UpdateSleepEventDto = { endedAt: '2026-01-01T20:30:00.000Z' };

      const result = await controller.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, dto);

      expect(sleepService.update).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, dto);
      expect(result).toBe(summary);
    });
  });

  describe('remove', () => {
    it('delegates to SleepService.remove with householdId, childId, eventId', async () => {
      sleepService.remove.mockResolvedValue(undefined);

      await controller.remove(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

      expect(sleepService.remove).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);
    });
  });

  describe('stop', () => {
    it('delegates to SleepService.stop with householdId, childId, eventId', async () => {
      sleepService.stop.mockResolvedValue(summary);

      const result = await controller.stop(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

      expect(sleepService.stop).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);
      expect(result).toBe(summary);
    });
  });

  describe('role requirements', () => {
    // Deliberate deviation from ChildController: no route on this
    // controller carries `@RequireRole` — both OWNER and CO_PARENT may
    // create/edit/delete Sleep events (see the controller's own doc
    // comment). Asserted explicitly here so a future reader doesn't wonder
    // why there's no 403 test for this controller.
    it.each(ROUTE_METHOD_NAMES)('%s has no required role', (methodName) => {
      const roles = Reflect.getMetadata(HOUSEHOLD_ROLES_KEY, SleepController.prototype[methodName]);
      expect(roles).toBeUndefined();
    });
  });
});
