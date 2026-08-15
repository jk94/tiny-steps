import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleModule, SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../common/clock.service';
import { EventType } from '../event/event-type.enum';
import { PushSenderService } from '../push/push-sender.service';
import {
  DAILY_SUMMARY_CRON,
  FEEDING_REMINDER_CRON,
  NotificationSchedulerService,
} from './notification-scheduler.service';

const USER_ID = 'user-1';
const CHILD_ID = 'child-1';
const TOKENS = ['tok-1', 'tok-2'];

// Threshold 4h; a feeding at 10:00 crosses it at 14:00.
const THRESHOLD_HOURS = 4;
const FEEDING_AT = new Date('2026-01-01T10:00:00.000Z');

function makeFeedingSettings(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'settings-1',
    userId: USER_ID,
    childId: CHILD_ID,
    feedingReminderEnabled: true,
    feedingReminderThresholdHours: THRESHOLD_HOURS,
    feedingReminderLastSentAt: null,
    dailySummaryEnabled: false,
    dailySummaryHourLocal: 20,
    ...overrides,
  };
}

describe('NotificationSchedulerService', () => {
  let prisma: {
    notificationSettings: { findMany: jest.Mock; update: jest.Mock };
    event: { findFirst: jest.Mock; count: jest.Mock };
    pushSubscription: { findMany: jest.Mock };
  };
  let pushSender: { sendToTokens: jest.Mock };
  let clock: { now: jest.Mock };
  let service: NotificationSchedulerService;

  beforeEach(() => {
    prisma = {
      notificationSettings: { findMany: jest.fn(), update: jest.fn() },
      event: { findFirst: jest.fn(), count: jest.fn() },
      pushSubscription: {
        findMany: jest.fn().mockResolvedValue(TOKENS.map((token) => ({ token }))),
      },
    };
    pushSender = { sendToTokens: jest.fn().mockResolvedValue(undefined) };
    clock = { now: jest.fn() };
    service = new NotificationSchedulerService(
      prisma as unknown as PrismaService,
      pushSender as unknown as PushSenderService,
      clock as unknown as ClockService,
    );
  });

  describe('checkFeedingReminders', () => {
    it('only queries settings with feeding reminders enabled', async () => {
      clock.now.mockReturnValue(new Date('2026-01-01T15:00:00.000Z'));
      prisma.notificationSettings.findMany.mockResolvedValue([]);

      await service.checkFeedingReminders();

      expect(prisma.notificationSettings.findMany).toHaveBeenCalledWith({
        where: { feedingReminderEnabled: true },
      });
    });

    it('does NOT send just under the threshold (13:59, 3h59m since a 10:00 feeding)', async () => {
      clock.now.mockReturnValue(new Date('2026-01-01T13:59:00.000Z'));
      prisma.notificationSettings.findMany.mockResolvedValue([makeFeedingSettings()]);
      prisma.event.findFirst.mockResolvedValue({ occurredAt: FEEDING_AT });

      await service.checkFeedingReminders();

      expect(pushSender.sendToTokens).not.toHaveBeenCalled();
      expect(prisma.notificationSettings.update).not.toHaveBeenCalled();
    });

    it('sends just over the threshold and stamps feedingReminderLastSentAt', async () => {
      const now = new Date('2026-01-01T14:01:00.000Z');
      clock.now.mockReturnValue(now);
      prisma.notificationSettings.findMany.mockResolvedValue([makeFeedingSettings()]);
      prisma.event.findFirst.mockResolvedValue({ occurredAt: FEEDING_AT });

      await service.checkFeedingReminders();

      expect(prisma.event.findFirst).toHaveBeenCalledWith({
        where: { childId: CHILD_ID, type: EventType.FEEDING },
        orderBy: { occurredAt: 'desc' },
      });
      expect(pushSender.sendToTokens).toHaveBeenCalledTimes(1);
      expect(pushSender.sendToTokens).toHaveBeenCalledWith(
        TOKENS,
        expect.objectContaining({ data: { type: 'FEEDING_REMINDER', childId: CHILD_ID } }),
      );
      expect(prisma.notificationSettings.update).toHaveBeenCalledWith({
        where: { id: 'settings-1' },
        data: { feedingReminderLastSentAt: now },
      });
    });

    it('does not re-send when already reminded about the same feeding (lastSentAt >= feeding)', async () => {
      clock.now.mockReturnValue(new Date('2026-01-01T15:00:00.000Z'));
      prisma.notificationSettings.findMany.mockResolvedValue([
        // Already reminded at 14:05, after the 10:00 feeding.
        makeFeedingSettings({ feedingReminderLastSentAt: new Date('2026-01-01T14:05:00.000Z') }),
      ]);
      prisma.event.findFirst.mockResolvedValue({ occurredAt: FEEDING_AT });

      await service.checkFeedingReminders();

      expect(pushSender.sendToTokens).not.toHaveBeenCalled();
      expect(prisma.notificationSettings.update).not.toHaveBeenCalled();
    });

    it('re-sends once a newer feeding was logged after the last reminder', async () => {
      clock.now.mockReturnValue(new Date('2026-01-01T20:00:00.000Z'));
      prisma.notificationSettings.findMany.mockResolvedValue([
        makeFeedingSettings({ feedingReminderLastSentAt: new Date('2026-01-01T14:05:00.000Z') }),
      ]);
      // A newer feeding at 15:30 — more than 4h before now, and after the last
      // reminder — so the reminder is re-armed.
      prisma.event.findFirst.mockResolvedValue({
        occurredAt: new Date('2026-01-01T15:30:00.000Z'),
      });

      await service.checkFeedingReminders();

      expect(pushSender.sendToTokens).toHaveBeenCalledTimes(1);
    });

    it('skips a child that has no feeding events at all', async () => {
      clock.now.mockReturnValue(new Date('2026-01-01T15:00:00.000Z'));
      prisma.notificationSettings.findMany.mockResolvedValue([makeFeedingSettings()]);
      prisma.event.findFirst.mockResolvedValue(null);

      await service.checkFeedingReminders();

      expect(pushSender.sendToTokens).not.toHaveBeenCalled();
    });
  });

  describe('sendDailySummaries', () => {
    it('selects only enabled rows whose configured hour matches the current server hour', async () => {
      // 20:00 local — build via local components so it's timezone-independent.
      const now = new Date(2026, 0, 1, 20, 0, 0);
      clock.now.mockReturnValue(now);
      prisma.notificationSettings.findMany.mockResolvedValue([]);

      await service.sendDailySummaries();

      expect(prisma.notificationSettings.findMany).toHaveBeenCalledWith({
        where: { dailySummaryEnabled: true, dailySummaryHourLocal: 20 },
      });
    });

    it("sends a per-child summary with today's per-type counts", async () => {
      const now = new Date(2026, 0, 1, 20, 0, 0);
      clock.now.mockReturnValue(now);
      prisma.notificationSettings.findMany.mockResolvedValue([
        makeFeedingSettings({ dailySummaryEnabled: true, dailySummaryHourLocal: 20 }),
      ]);
      // FEEDING, SLEEP, DIAPER counts in Promise.all order.
      prisma.event.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2).mockResolvedValueOnce(7);

      await service.sendDailySummaries();

      expect(pushSender.sendToTokens).toHaveBeenCalledTimes(1);
      const [tokens, payload] = pushSender.sendToTokens.mock.calls[0];
      expect(tokens).toEqual(TOKENS);
      expect(payload.data).toEqual({ type: 'DAILY_SUMMARY', childId: CHILD_ID });
      expect(payload.body).toContain('5');
      expect(payload.body).toContain('2');
      expect(payload.body).toContain('7');
    });

    it('does nothing when no rows are due this hour', async () => {
      clock.now.mockReturnValue(new Date(2026, 0, 1, 11, 0, 0));
      prisma.notificationSettings.findMany.mockResolvedValue([]);

      await service.sendDailySummaries();

      expect(prisma.event.count).not.toHaveBeenCalled();
      expect(pushSender.sendToTokens).not.toHaveBeenCalled();
    });
  });
});

describe('NotificationSchedulerService @Cron wiring', () => {
  let moduleRef: TestingModule;
  let registry: SchedulerRegistry;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot()],
      providers: [
        NotificationSchedulerService,
        { provide: PrismaService, useValue: {} },
        { provide: PushSenderService, useValue: {} },
        { provide: ClockService, useValue: {} },
      ],
    }).compile();
    // init() is what triggers ScheduleModule to register the @Cron jobs.
    await moduleRef.init();
    registry = moduleRef.get(SchedulerRegistry);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('registers both named cron jobs without waiting on real time', () => {
    expect(registry.getCronJob(FEEDING_REMINDER_CRON)).toBeDefined();
    expect(registry.getCronJob(DAILY_SUMMARY_CRON)).toBeDefined();
  });
});
