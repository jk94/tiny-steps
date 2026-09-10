import type { HouseholdActor } from '../household/decorators/household-actor.decorator';
import { HOUSEHOLD_ROLES_KEY } from '../household/guards/require-role.decorator';
import { ENTRY_WRITE_ROLES, FULL_WRITE_ROLES } from '../household/household-permissions';
import { HouseholdRole } from '../household/household-role.enum';
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

// Role scoping (Phase 7.5): the controller only forwards the injected actor,
// so one representative value is enough here — the role rules themselves are
// covered by the guard, service and e2e specs.
const OWNER_ACTOR: HouseholdActor = { userId: 'user-1', role: HouseholdRole.OWNER };

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
  updatedAt: new Date('2026-01-01T10:00:00.000Z'),
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

/** Route method → the exact role bundle its `@RequireRole` must declare. */
const ROLE_SCOPED_ROUTES = [
  ['create', ENTRY_WRITE_ROLES],
  ['update', ENTRY_WRITE_ROLES],
  ['stop', ENTRY_WRITE_ROLES],
  ['remove', FULL_WRITE_ROLES],
] as const;

/** Routes any household member may call, so they carry no role metadata. */
const READ_OPEN_ROUTES = ['list', 'getActiveTimer', 'getOne'] as const;

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

      const result = await controller.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, dto, OWNER_ACTOR);

      expect(feedingService.update).toHaveBeenCalledWith(
        HOUSEHOLD_ID,
        CHILD_ID,
        EVENT_ID,
        OWNER_ACTOR,
        dto,
      );
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
    it('delegates to FeedingService.stop with householdId, childId, eventId, and the (optional) body', async () => {
      feedingService.stop.mockResolvedValue(summary);
      const dto = { clientTimestamp: '2026-01-01T11:00:00.000Z' };

      const result = await controller.stop(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, dto);

      expect(feedingService.stop).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, dto);
      expect(result).toBe(summary);
    });

    it('forwards an empty body for a plain online stop', async () => {
      feedingService.stop.mockResolvedValue(summary);

      await controller.stop(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {});

      expect(feedingService.stop).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {});
    });
  });

  describe('role requirements', () => {
    it('classifies every route as either role-scoped or read-open', () => {
      // Catches a newly added route that nobody classified below, which would
      // otherwise slip past the two `it.each` tables unnoticed.
      expect([...ROLE_SCOPED_ROUTES.map(([name]) => name), ...READ_OPEN_ROUTES].sort()).toEqual(
        [...ROUTE_METHOD_NAMES].sort(),
      );
    });

    // Every writing route must carry an explicit role requirement (ROL-2) —
    // `HouseholdMembershipGuard` rejects unannotated writes outright, so a
    // missing annotation is a 403 for everyone rather than a silent hole.
    it.each(ROLE_SCOPED_ROUTES)('%s requires the expected roles', (methodName, expectedRoles) => {
      const roles = Reflect.getMetadata(
        HOUSEHOLD_ROLES_KEY,
        FeedingController.prototype[methodName],
      );
      expect(roles).toEqual([...expectedRoles]);
    });

    it.each(READ_OPEN_ROUTES)('leaves the read route %s open to any member', (methodName) => {
      const roles = Reflect.getMetadata(
        HOUSEHOLD_ROLES_KEY,
        FeedingController.prototype[methodName],
      );
      expect(roles).toBeUndefined();
    });
  });
});
