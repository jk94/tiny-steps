import { HOUSEHOLD_ROLES_KEY } from '../household/guards/require-role.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { EventType } from '../event/event-type.enum';
import { CreateFeedingEventDto } from './dto/create-feeding-event.dto';
import { UpdateFeedingEventDto } from './dto/update-feeding-event.dto';
import { FeedingController } from './feeding.controller';
import { FeedingService } from './feeding.service';
import type { FeedingEventSummary } from './feeding.service';
import { FeedingType } from './feeding-type.enum';

const HOUSEHOLD_ID = 'household-1';
const CHILD_ID = 'child-1';
const EVENT_ID = 'event-1';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'parent@example.com',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
};

const summary: FeedingEventSummary = {
  id: EVENT_ID,
  childId: CHILD_ID,
  userId: user.id,
  type: EventType.FEEDING,
  feedingType: FeedingType.SOLID,
  occurredAt: new Date('2026-01-01T10:00:00.000Z'),
  startedAt: null,
  endedAt: null,
  durationSeconds: null,
  side: null,
  amountMl: null,
  note: null,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
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

describe('FeedingController', () => {
  let feedingService: jest.Mocked<
    Pick<
      FeedingService,
      'create' | 'list' | 'findActiveTimer' | 'findOne' | 'update' | 'remove' | 'stop'
    >
  >;
  let controller: FeedingController;

  beforeEach(() => {
    feedingService = {
      create: jest.fn(),
      list: jest.fn(),
      findActiveTimer: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      stop: jest.fn(),
    };
    controller = new FeedingController(feedingService as unknown as FeedingService);
  });

  describe('create', () => {
    it('delegates to FeedingService.create with householdId, childId, the current user id, and the dto', async () => {
      feedingService.create.mockResolvedValue(summary);
      const dto: CreateFeedingEventDto = { feedingType: FeedingType.SOLID };

      const result = await controller.create(HOUSEHOLD_ID, CHILD_ID, dto, user);

      expect(feedingService.create).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, user.id, dto);
      expect(result).toBe(summary);
    });
  });

  describe('list', () => {
    it('delegates to FeedingService.list with householdId and childId', async () => {
      feedingService.list.mockResolvedValue([summary]);

      const result = await controller.list(HOUSEHOLD_ID, CHILD_ID);

      expect(feedingService.list).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID);
      expect(result).toEqual([summary]);
    });
  });

  describe('getActiveTimer', () => {
    it('delegates to FeedingService.findActiveTimer with householdId and childId', async () => {
      feedingService.findActiveTimer.mockResolvedValue(null);

      const result = await controller.getActiveTimer(HOUSEHOLD_ID, CHILD_ID);

      expect(feedingService.findActiveTimer).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID);
      expect(result).toBeNull();
    });
  });

  describe('getOne', () => {
    it('delegates to FeedingService.findOne with householdId, childId, eventId', async () => {
      feedingService.findOne.mockResolvedValue(summary);

      const result = await controller.getOne(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

      expect(feedingService.findOne).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);
      expect(result).toBe(summary);
    });
  });

  describe('update', () => {
    it('delegates to FeedingService.update with householdId, childId, eventId, dto', async () => {
      feedingService.update.mockResolvedValue(summary);
      const dto: UpdateFeedingEventDto = { note: 'updated' };

      const result = await controller.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, dto);

      expect(feedingService.update).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, dto);
      expect(result).toBe(summary);
    });
  });

  describe('remove', () => {
    it('delegates to FeedingService.remove with householdId, childId, eventId', async () => {
      feedingService.remove.mockResolvedValue(undefined);

      await controller.remove(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

      expect(feedingService.remove).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);
    });
  });

  describe('stop', () => {
    it('delegates to FeedingService.stop with householdId, childId, eventId', async () => {
      feedingService.stop.mockResolvedValue(summary);

      const result = await controller.stop(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

      expect(feedingService.stop).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);
      expect(result).toBe(summary);
    });
  });

  describe('role requirements', () => {
    // Deliberate deviation from ChildController: no route on this
    // controller carries `@RequireRole` — both OWNER and CO_PARENT may
    // create/edit/delete Feeding events (see the controller's own doc
    // comment). Asserted explicitly here so a future reader doesn't wonder
    // why there's no 403 test for this controller.
    it.each(ROUTE_METHOD_NAMES)('%s has no required role', (methodName) => {
      const roles = Reflect.getMetadata(
        HOUSEHOLD_ROLES_KEY,
        FeedingController.prototype[methodName],
      );
      expect(roles).toBeUndefined();
    });
  });
});
