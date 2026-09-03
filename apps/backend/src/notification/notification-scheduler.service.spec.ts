import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleModule, SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../common/clock.service';
import { EventType } from '../event/event-type.enum';
import { PushSenderService } from '../push/push-sender.service';
import { HealthRecordKind } from '../health-record/health-record-kind.enum';
import {
  DAILY_SUMMARY_CRON,
  FEEDING_REMINDER_CRON,
  MEDICAL_REMINDER_CRON,
  NotificationSchedulerService,
} from './notification-scheduler.service';
import {
  MEDICAL_REMINDER_DEFAULT_LEAD_DAYS,
  MEDICAL_REMINDER_MAX_LEAD_DAYS,
  MEDICAL_REMINDER_OVERDUE_GRACE_DAYS,
} from './notification-settings.service';

const USER_ID = 'user-1';
const CHILD_ID = 'child-1';
const HOUSEHOLD_ID = 'household-1';
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
    medicalReminderEnabled: true,
    medicalReminderLeadDays: MEDICAL_REMINDER_DEFAULT_LEAD_DAYS,
    ...overrides,
  };
}

describe('NotificationSchedulerService', () => {
  let prisma: {
    notificationSettings: { findMany: jest.Mock; update: jest.Mock };
    event: { findFirst: jest.Mock; count: jest.Mock };
    pushSubscription: { findMany: jest.Mock };
    child: { findUnique: jest.Mock };
    healthRecord: { findMany: jest.Mock; update: jest.Mock };
    membership: { findMany: jest.Mock };
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
      child: { findUnique: jest.fn().mockResolvedValue({ householdId: HOUSEHOLD_ID }) },
      healthRecord: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      membership: { findMany: jest.fn().mockResolvedValue([]) },
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
      prisma.event.findFirst.mockResolvedValue({ occurredAt: FEEDING_AT, createdAt: FEEDING_AT });

      await service.checkFeedingReminders();

      expect(pushSender.sendToTokens).not.toHaveBeenCalled();
      expect(prisma.notificationSettings.update).not.toHaveBeenCalled();
    });

    it('sends just over the threshold and stamps feedingReminderLastSentAt', async () => {
      const now = new Date('2026-01-01T14:01:00.000Z');
      clock.now.mockReturnValue(now);
      prisma.notificationSettings.findMany.mockResolvedValue([makeFeedingSettings()]);
      prisma.event.findFirst.mockResolvedValue({ occurredAt: FEEDING_AT, createdAt: FEEDING_AT });

      await service.checkFeedingReminders();

      expect(prisma.event.findFirst).toHaveBeenCalledWith({
        where: { childId: CHILD_ID, type: EventType.FEEDING },
        orderBy: { occurredAt: 'desc' },
      });
      expect(pushSender.sendToTokens).toHaveBeenCalledTimes(1);
      expect(pushSender.sendToTokens).toHaveBeenCalledWith(
        TOKENS,
        // `householdId` is what makes the tap deep-linkable (MED-11) — every
        // in-app route is household-scoped.
        expect.objectContaining({
          data: { type: 'FEEDING_REMINDER', householdId: HOUSEHOLD_ID, childId: CHILD_ID },
        }),
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
      prisma.event.findFirst.mockResolvedValue({ occurredAt: FEEDING_AT, createdAt: FEEDING_AT });

      await service.checkFeedingReminders();

      expect(pushSender.sendToTokens).not.toHaveBeenCalled();
      expect(prisma.notificationSettings.update).not.toHaveBeenCalled();
    });

    it('re-sends once a newer feeding was logged after the last reminder', async () => {
      clock.now.mockReturnValue(new Date('2026-01-01T20:00:00.000Z'));
      prisma.notificationSettings.findMany.mockResolvedValue([
        makeFeedingSettings({ feedingReminderLastSentAt: new Date('2026-01-01T14:05:00.000Z') }),
      ]);
      // A newer feeding at 15:30 — more than 4h before now, and logged after the
      // last reminder — so the reminder is re-armed.
      prisma.event.findFirst.mockResolvedValue({
        occurredAt: new Date('2026-01-01T15:30:00.000Z'),
        createdAt: new Date('2026-01-01T15:30:00.000Z'),
      });

      await service.checkFeedingReminders();

      expect(pushSender.sendToTokens).toHaveBeenCalledTimes(1);
    });

    it('re-sends when a backdated feeding is logged after the last reminder (dedup by createdAt, not occurredAt)', async () => {
      // Last reminder was sent at 12:30. The user then backfills a feeding whose
      // occurredAt (09:00) is EARLIER than the last reminder, but whose createdAt
      // (13:00) is later — i.e. it was only just logged. Since we've never
      // reminded about this newly-logged record, and the gap since 09:00 now
      // exceeds the 4h threshold, the reminder is legitimately due again.
      clock.now.mockReturnValue(new Date('2026-01-01T14:00:00.000Z'));
      prisma.notificationSettings.findMany.mockResolvedValue([
        makeFeedingSettings({ feedingReminderLastSentAt: new Date('2026-01-01T12:30:00.000Z') }),
      ]);
      prisma.event.findFirst.mockResolvedValue({
        occurredAt: new Date('2026-01-01T09:00:00.000Z'),
        createdAt: new Date('2026-01-01T13:00:00.000Z'),
      });

      await service.checkFeedingReminders();

      expect(pushSender.sendToTokens).toHaveBeenCalledTimes(1);
      expect(prisma.notificationSettings.update).toHaveBeenCalledTimes(1);
    });

    it('continues to the next row when one row send rejects (does not abort the tick)', async () => {
      clock.now.mockReturnValue(new Date('2026-01-01T15:00:00.000Z'));
      prisma.notificationSettings.findMany.mockResolvedValue([
        makeFeedingSettings({ id: 'settings-1', userId: 'user-1', childId: 'child-1' }),
        makeFeedingSettings({ id: 'settings-2', userId: 'user-2', childId: 'child-2' }),
      ]);
      // Both children have an overdue feeding.
      prisma.event.findFirst.mockResolvedValue({ occurredAt: FEEDING_AT, createdAt: FEEDING_AT });
      // First send rejects (e.g. transport-level FCM failure), second resolves.
      pushSender.sendToTokens
        .mockRejectedValueOnce(new Error('FCM down'))
        .mockResolvedValueOnce(undefined);

      await expect(service.checkFeedingReminders()).resolves.toBeUndefined();

      // Both rows were still attempted despite the first failing.
      expect(pushSender.sendToTokens).toHaveBeenCalledTimes(2);
      // Only the successful row stamped its last-sent timestamp.
      expect(prisma.notificationSettings.update).toHaveBeenCalledTimes(1);
      expect(prisma.notificationSettings.update).toHaveBeenCalledWith({
        where: { id: 'settings-2' },
        data: expect.objectContaining({ feedingReminderLastSentAt: expect.any(Date) }),
      });
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
      expect(payload.data).toEqual({
        type: 'DAILY_SUMMARY',
        householdId: HOUSEHOLD_ID,
        childId: CHILD_ID,
      });
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

    it('continues to the next row when one row send rejects (does not abort the tick)', async () => {
      clock.now.mockReturnValue(new Date(2026, 0, 1, 20, 0, 0));
      prisma.notificationSettings.findMany.mockResolvedValue([
        makeFeedingSettings({
          id: 'settings-1',
          userId: 'user-1',
          childId: 'child-1',
          dailySummaryEnabled: true,
          dailySummaryHourLocal: 20,
        }),
        makeFeedingSettings({
          id: 'settings-2',
          userId: 'user-2',
          childId: 'child-2',
          dailySummaryEnabled: true,
          dailySummaryHourLocal: 20,
        }),
      ]);
      prisma.event.count.mockResolvedValue(1);
      // First send rejects (e.g. transport-level FCM failure), second resolves.
      pushSender.sendToTokens
        .mockRejectedValueOnce(new Error('FCM down'))
        .mockResolvedValueOnce(undefined);

      await expect(service.sendDailySummaries()).resolves.toBeUndefined();

      // Both due rows were still attempted despite the first failing — critical
      // here since these are hour-matched and won't self-heal on the next tick.
      expect(pushSender.sendToTokens).toHaveBeenCalledTimes(2);
    });
  });

  describe('checkMedicalReminders', () => {
    // Local-component dates so the suite is timezone-independent: the rule
    // works in server-local days (see medical-reminder-trigger.ts).
    const DUE_AT = new Date(2026, 2, 20); // Fri, 20 Mar 2026
    const RECORD_ID = 'health-record-1';
    const at = (day: number, hour = 8) => new Date(2026, 2, day, hour, 0, 0);

    function makeRecord(overrides: Partial<Record<string, unknown>> = {}) {
      return {
        id: RECORD_ID,
        childId: CHILD_ID,
        kind: HealthRecordKind.VACCINATION as string,
        name: '6-fach-Impfung',
        dueAt: DUE_AT,
        reminderLastSentAt: null as Date | null,
        child: { householdId: HOUSEHOLD_ID },
        ...overrides,
      };
    }

    function makeMedicalSettings(overrides: Partial<Record<string, unknown>> = {}) {
      return makeFeedingSettings({ feedingReminderEnabled: false, ...overrides });
    }

    /** Every household member's user id, in one place. */
    function withMembers(...userIds: string[]) {
      prisma.membership.findMany.mockResolvedValue(userIds.map((userId) => ({ userId })));
    }

    /** The user ids the run actually pushed to, in call order. */
    function pushedUserIds(): string[] {
      return prisma.pushSubscription.findMany.mock.calls.map(
        (call: [{ where: { userId: string } }]) => call[0].where.userId,
      );
    }

    beforeEach(() => {
      // One token set per user, keyed off the queried userId, so the assertions
      // can tell recipients apart.
      prisma.pushSubscription.findMany.mockImplementation(
        ({ where }: { where: { userId: string } }) =>
          Promise.resolve([{ token: `tok-${where.userId}` }]),
      );
    });

    it('scans only enabled, not-yet-done records inside the due window', async () => {
      clock.now.mockReturnValue(at(17));

      await service.checkMedicalReminders();

      const { where, select } = prisma.healthRecord.findMany.mock.calls[0][0];
      expect(where.reminderEnabled).toBe(true);
      // MED-10: a record marked as done drops out of the scan entirely.
      expect(where.administeredAt).toBeNull();
      expect(where.dueAt.not).toBeNull();
      expect(where.dueAt.lte).toEqual(new Date(2026, 2, 17 + MEDICAL_REMINDER_MAX_LEAD_DAYS, 8));
      expect(where.dueAt.gte).toEqual(
        new Date(2026, 2, 17 - MEDICAL_REMINDER_OVERDUE_GRACE_DAYS, 8),
      );
      // The household is what the deep link and the member fan-out need.
      expect(select.child).toEqual({ select: { householdId: true } });
    });

    it('does nothing for a record whose household has no members', async () => {
      clock.now.mockReturnValue(at(20));
      prisma.healthRecord.findMany.mockResolvedValue([makeRecord()]);
      withMembers();

      await service.checkMedicalReminders();

      expect(pushSender.sendToTokens).not.toHaveBeenCalled();
      expect(prisma.healthRecord.update).not.toHaveBeenCalled();
    });

    it('sends a German lead-time push carrying the deep-link ids (MED-11)', async () => {
      const now = at(17);
      clock.now.mockReturnValue(now);
      prisma.healthRecord.findMany.mockResolvedValue([makeRecord()]);
      withMembers(USER_ID);
      prisma.notificationSettings.findMany.mockResolvedValue([makeMedicalSettings()]);

      await service.checkMedicalReminders();

      const [tokens, payload] = pushSender.sendToTokens.mock.calls[0];
      expect(tokens).toEqual([`tok-${USER_ID}`]);
      expect(payload.title).toBe('Anstehender Termin');
      expect(payload.body).toContain('Impfung');
      expect(payload.body).toContain('6-fach-Impfung');
      expect(payload.data).toEqual({
        type: 'MEDICAL_REMINDER',
        householdId: HOUSEHOLD_ID,
        childId: CHILD_ID,
        healthRecordId: RECORD_ID,
      });
      expect(prisma.healthRecord.update).toHaveBeenCalledWith({
        where: { id: RECORD_ID },
        data: { reminderLastSentAt: now },
      });
    });

    it('words a medication differently from a vaccination', async () => {
      clock.now.mockReturnValue(at(20));
      prisma.healthRecord.findMany.mockResolvedValue([
        makeRecord({ kind: HealthRecordKind.MEDICATION, name: 'Vitamin D' }),
      ]);
      withMembers(USER_ID);
      prisma.notificationSettings.findMany.mockResolvedValue([makeMedicalSettings()]);

      await service.checkMedicalReminders();

      const [, payload] = pushSender.sendToTokens.mock.calls[0];
      expect(payload.title).toBe('Heute fällig');
      expect(payload.body).toContain('Medikament');
    });

    it('says "war fällig" for an entry that is already overdue', async () => {
      clock.now.mockReturnValue(at(25));
      prisma.healthRecord.findMany.mockResolvedValue([makeRecord()]);
      withMembers(USER_ID);
      prisma.notificationSettings.findMany.mockResolvedValue([makeMedicalSettings()]);

      await service.checkMedicalReminders();

      const [, payload] = pushSender.sendToTokens.mock.calls[0];
      expect(payload.title).toBe('Überfälliger Termin');
    });

    it('gives each member their own lead reminder and both the due-day one', async () => {
      // Two members of the same household with 7- and 3-day lead times. The
      // record's single shared stamp is threaded from run to run, exactly as
      // the DB would.
      withMembers('user-early', 'user-late');
      prisma.notificationSettings.findMany.mockResolvedValue([
        makeMedicalSettings({ id: 's-early', userId: 'user-early', medicalReminderLeadDays: 7 }),
        makeMedicalSettings({ id: 's-late', userId: 'user-late', medicalReminderLeadDays: 3 }),
      ]);

      let stamp: Date | null = null;
      prisma.healthRecord.update.mockImplementation(
        ({ data }: { data: { reminderLastSentAt: Date } }) => {
          stamp = data.reminderLastSentAt;
          return Promise.resolve({});
        },
      );

      const runOn = async (day: number): Promise<string[]> => {
        pushSender.sendToTokens.mockClear();
        prisma.pushSubscription.findMany.mockClear();
        clock.now.mockReturnValue(at(day));
        prisma.healthRecord.findMany.mockResolvedValue([makeRecord({ reminderLastSentAt: stamp })]);
        await service.checkMedicalReminders();
        return pushedUserIds();
      };

      expect(await runOn(12)).toEqual([]); // before either lead window
      expect(await runOn(13)).toEqual(['user-early']); // D-7
      expect(stamp).toEqual(at(13));
      expect(await runOn(15)).toEqual([]); // early member already reminded
      expect(await runOn(17)).toEqual(['user-late']); // D-3
      expect(stamp).toEqual(at(17));
      expect(await runOn(20)).toEqual(['user-early', 'user-late']); // due day, both
      expect(stamp).toEqual(at(20));
      expect(await runOn(21)).toEqual([]); // nothing left to say
    });

    it('costs a late-enabling member their lead push but not the due-day one', async () => {
      withMembers(USER_ID);
      prisma.notificationSettings.findMany.mockResolvedValue([makeMedicalSettings()]);
      // Another member's lead push already stamped the record on D-3.
      const stamped = at(17);

      clock.now.mockReturnValue(at(18));
      prisma.healthRecord.findMany.mockResolvedValue([makeRecord({ reminderLastSentAt: stamped })]);
      await service.checkMedicalReminders();
      expect(pushSender.sendToTokens).not.toHaveBeenCalled();

      clock.now.mockReturnValue(at(20));
      prisma.healthRecord.findMany.mockResolvedValue([makeRecord({ reminderLastSentAt: stamped })]);
      await service.checkMedicalReminders();
      expect(pushSender.sendToTokens).toHaveBeenCalledTimes(1);
    });

    it('treats a member with no settings row as enabled with the default lead time', async () => {
      clock.now.mockReturnValue(at(17));
      prisma.healthRecord.findMany.mockResolvedValue([makeRecord()]);
      withMembers(USER_ID, 'user-without-settings');
      // Only one of the two members has ever saved settings.
      prisma.notificationSettings.findMany.mockResolvedValue([makeMedicalSettings()]);

      await service.checkMedicalReminders();

      // Reminders are opt-OUT, so a shared appointment is not silently missed
      // by whoever never opened the settings page.
      expect(pushedUserIds()).toEqual([USER_ID, 'user-without-settings']);
    });

    it('sends nothing and stamps nothing when every member opted out (MED-8)', async () => {
      clock.now.mockReturnValue(at(20));
      prisma.healthRecord.findMany.mockResolvedValue([makeRecord()]);
      withMembers(USER_ID);
      prisma.notificationSettings.findMany.mockResolvedValue([
        makeMedicalSettings({ medicalReminderEnabled: false }),
      ]);

      await service.checkMedicalReminders();

      expect(pushSender.sendToTokens).not.toHaveBeenCalled();
      expect(prisma.healthRecord.update).not.toHaveBeenCalled();
    });

    it('continues to the next record when one record lookup rejects', async () => {
      clock.now.mockReturnValue(at(20));
      prisma.healthRecord.findMany.mockResolvedValue([
        makeRecord({ id: 'record-a' }),
        makeRecord({ id: 'record-b' }),
      ]);
      prisma.membership.findMany
        .mockRejectedValueOnce(new Error('DB hiccup'))
        .mockResolvedValueOnce([{ userId: USER_ID }]);
      prisma.notificationSettings.findMany.mockResolvedValue([makeMedicalSettings()]);

      await expect(service.checkMedicalReminders()).resolves.toBeUndefined();

      expect(pushSender.sendToTokens).toHaveBeenCalledTimes(1);
      expect(prisma.healthRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-b' },
        data: expect.objectContaining({ reminderLastSentAt: expect.any(Date) }),
      });
    });

    it('still reaches the second member when the first send rejects', async () => {
      const now = at(20);
      clock.now.mockReturnValue(now);
      prisma.healthRecord.findMany.mockResolvedValue([makeRecord()]);
      withMembers('user-a', 'user-b');
      prisma.notificationSettings.findMany.mockResolvedValue([
        makeMedicalSettings({ id: 's-a', userId: 'user-a' }),
        makeMedicalSettings({ id: 's-b', userId: 'user-b' }),
      ]);
      pushSender.sendToTokens
        .mockRejectedValueOnce(new Error('FCM down'))
        .mockResolvedValueOnce(undefined);

      await expect(service.checkMedicalReminders()).resolves.toBeUndefined();

      expect(pushSender.sendToTokens).toHaveBeenCalledTimes(2);
      // One successful delivery is enough to stamp the shared column — the
      // failed member forfeits this trigger, by design (no per-member state).
      expect(prisma.healthRecord.update).toHaveBeenCalledTimes(1);
      expect(prisma.healthRecord.update).toHaveBeenCalledWith({
        where: { id: RECORD_ID },
        data: { reminderLastSentAt: now },
      });
    });

    it('nudges an already-overdue new entry exactly once', async () => {
      withMembers(USER_ID);
      prisma.notificationSettings.findMany.mockResolvedValue([makeMedicalSettings()]);
      let stamp: Date | null = null;
      prisma.healthRecord.update.mockImplementation(
        ({ data }: { data: { reminderLastSentAt: Date } }) => {
          stamp = data.reminderLastSentAt;
          return Promise.resolve({});
        },
      );

      clock.now.mockReturnValue(at(25));
      prisma.healthRecord.findMany.mockResolvedValue([makeRecord({ reminderLastSentAt: stamp })]);
      await service.checkMedicalReminders();
      expect(pushSender.sendToTokens).toHaveBeenCalledTimes(1);

      clock.now.mockReturnValue(at(26));
      prisma.healthRecord.findMany.mockResolvedValue([makeRecord({ reminderLastSentAt: stamp })]);
      await service.checkMedicalReminders();
      expect(pushSender.sendToTokens).toHaveBeenCalledTimes(1);
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

  it('registers all named cron jobs without waiting on real time', () => {
    expect(registry.getCronJob(FEEDING_REMINDER_CRON)).toBeDefined();
    expect(registry.getCronJob(DAILY_SUMMARY_CRON)).toBeDefined();
    expect(registry.getCronJob(MEDICAL_REMINDER_CRON)).toBeDefined();
  });
});
