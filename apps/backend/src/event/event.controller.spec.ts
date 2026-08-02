import { DiaperType } from '../diaper/diaper-type.enum';
import { EventController } from './event.controller';
import { EventRangeQueryDto } from './dto/event-range-query.dto';
import { EventService } from './event.service';
import type { EventStatsSummary, TimelineEventSummary } from './event.service';
import { EventType } from './event-type.enum';

const HOUSEHOLD_ID = 'household-1';
const CHILD_ID = 'child-1';

const query: EventRangeQueryDto = {
  from: '2026-01-01T00:00:00.000Z',
  to: '2026-01-02T00:00:00.000Z',
};

const timeline: TimelineEventSummary[] = [
  {
    id: 'diaper-1',
    childId: CHILD_ID,
    userId: 'user-1',
    type: EventType.DIAPER,
    diaperType: DiaperType.PEE,
    occurredAt: new Date(query.from),
    note: null,
    createdAt: new Date(query.from),
  },
];

const stats: EventStatsSummary = {
  sleepHoursToday: 1.5,
  feedingCountToday: 4,
  lastEventAt: { FEEDING: new Date(query.from), SLEEP: null, DIAPER: null },
};

describe('EventController', () => {
  let eventService: jest.Mocked<Pick<EventService, 'listDaily' | 'getStatsSummary'>>;
  let controller: EventController;

  beforeEach(() => {
    eventService = {
      listDaily: jest.fn(),
      getStatsSummary: jest.fn(),
    };
    controller = new EventController(eventService as unknown as EventService);
  });

  describe('getDaily', () => {
    it('delegates to EventService.listDaily with householdId, childId, and parsed from/to dates', async () => {
      eventService.listDaily.mockResolvedValue(timeline);

      const result = await controller.getDaily(HOUSEHOLD_ID, CHILD_ID, query);

      expect(eventService.listDaily).toHaveBeenCalledWith(
        HOUSEHOLD_ID,
        CHILD_ID,
        new Date(query.from),
        new Date(query.to),
      );
      expect(result).toBe(timeline);
    });
  });

  describe('getStats', () => {
    it('delegates to EventService.getStatsSummary with householdId, childId, and parsed from/to dates', async () => {
      eventService.getStatsSummary.mockResolvedValue(stats);

      const result = await controller.getStats(HOUSEHOLD_ID, CHILD_ID, query);

      expect(eventService.getStatsSummary).toHaveBeenCalledWith(
        HOUSEHOLD_ID,
        CHILD_ID,
        new Date(query.from),
        new Date(query.to),
      );
      expect(result).toBe(stats);
    });
  });
});
