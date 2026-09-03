import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../common/clock.service';
import { EventType } from '../event/event-type.enum';
import { HealthRecordKind, toHealthRecordKind } from '../health-record/health-record-kind.enum';
import { PushSenderService } from '../push/push-sender.service';
import type { PushNotificationPayload } from '../push/push-sender.service';
import {
  addDays,
  resolveMedicalReminderTrigger,
  startOfLocalDay,
  type MedicalReminderTrigger,
} from './medical-reminder-trigger';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  MEDICAL_REMINDER_MAX_LEAD_DAYS,
  MEDICAL_REMINDER_OVERDUE_GRACE_DAYS,
} from './notification-settings.service';

const MS_PER_HOUR = 1000 * 60 * 60;

/** Cron job names, so they can be looked up via Nest's `SchedulerRegistry`. */
export const FEEDING_REMINDER_CRON = 'feeding-reminders';
export const DAILY_SUMMARY_CRON = 'daily-summaries';
export const MEDICAL_REMINDER_CRON = 'medical-reminders';

/** The subset of a `HealthRecord` one reminder run needs. */
interface DueHealthRecord {
  id: string;
  childId: string;
  kind: string;
  name: string;
  dueAt: Date | null;
  reminderLastSentAt: Date | null;
  child: { householdId: string };
}

/**
 * Time-driven push triggers. Both cron methods are ordinary async methods that
 * take no arguments and read "now" from the injected `ClockService`, so unit
 * tests call them directly with a pinned clock instead of waiting on real
 * wall-clock time (the `@Cron` wiring itself is asserted separately via Nest's
 * `SchedulerRegistry`).
 *
 * All timezone reasoning here uses the SERVER's local time (`Date` local
 * getters) — an MVP simplification, matching `NotificationSettings`'
 * `dailySummaryHourLocal` doc comment. Per-user timezones are out of scope.
 */
@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushSender: PushSenderService,
    private readonly clock: ClockService,
  ) {}

  /**
   * Sends a "last feeding was over X hours ago" reminder per enabled
   * (user, child) settings row whose threshold has been exceeded.
   *
   * De-duplication is correctness-critical: a reminder is sent only when the
   * threshold is exceeded AND we haven't already reminded about the current
   * known feeding state — i.e. `feedingReminderLastSentAt` is null, or predates
   * the moment the most recent feeding was *logged* (`createdAt`). Comparing
   * against when the feeding was logged rather than its `occurredAt` (when it is
   * claimed to have happened) means a backdated/backfilled feeding still re-arms
   * the reminder: a feeding logged now with an earlier `occurredAt` than the
   * last reminder would be wrongly suppressed if we compared `occurredAt`, even
   * though we have never reminded about that newly-logged record. A long gap
   * with no new feeding is still reminded about exactly once, since `createdAt`
   * is stable across ticks.
   *
   * Each row's send is wrapped in try/catch so a request-level send failure for
   * one (user, child) doesn't abort the remaining rows in this tick.
   */
  @Cron(CronExpression.EVERY_30_MINUTES, { name: FEEDING_REMINDER_CRON })
  async checkFeedingReminders(): Promise<void> {
    const now = this.clock.now();
    const settingsList = await this.prisma.notificationSettings.findMany({
      where: { feedingReminderEnabled: true },
    });

    for (const settings of settingsList) {
      const lastFeeding = await this.prisma.event.findFirst({
        where: { childId: settings.childId, type: EventType.FEEDING },
        orderBy: { occurredAt: 'desc' },
      });

      // No feeding ever logged → nothing to remind about.
      if (!lastFeeding) {
        continue;
      }

      const hoursSinceFeeding = (now.getTime() - lastFeeding.occurredAt.getTime()) / MS_PER_HOUR;
      if (hoursSinceFeeding < settings.feedingReminderThresholdHours) {
        continue;
      }

      // Already reminded about the current feeding state — don't nag again
      // until a newer feeding record is logged. Compare against when the
      // feeding was created (logged), not its `occurredAt`, so a backdated
      // feeding logged after the last reminder still re-arms it.
      const alreadyReminded =
        settings.feedingReminderLastSentAt !== null &&
        settings.feedingReminderLastSentAt >= lastFeeding.createdAt;
      if (alreadyReminded) {
        continue;
      }

      try {
        const tokens = await this.tokensForUser(settings.userId);
        const hours = Math.floor(hoursSinceFeeding);
        await this.pushSender.sendToTokens(tokens, {
          title: 'Fütterungserinnerung',
          body: `Die letzte Fütterung war vor über ${hours} Stunden.`,
          // `householdId` is what makes the tap deep-linkable (MED-11): every
          // in-app route is household-scoped, so the child id alone is not
          // enough to build one.
          data: {
            type: 'FEEDING_REMINDER',
            householdId: await this.householdIdForChild(settings.childId),
            childId: settings.childId,
          },
        });

        await this.prisma.notificationSettings.update({
          where: { id: settings.id },
          data: { feedingReminderLastSentAt: now },
        });
      } catch (error) {
        this.logger.error(
          `Failed to send feeding reminder for settings ${settings.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  /**
   * Sends a daily-summary push per enabled settings row whose configured
   * `dailySummaryHourLocal` matches the current server hour. Runs hourly and
   * self-selects the due rows, so there's no need for a per-hour cron.
   */
  @Cron(CronExpression.EVERY_HOUR, { name: DAILY_SUMMARY_CRON })
  async sendDailySummaries(): Promise<void> {
    const now = this.clock.now();
    const currentHour = now.getHours();

    const settingsList = await this.prisma.notificationSettings.findMany({
      where: { dailySummaryEnabled: true, dailySummaryHourLocal: currentHour },
    });

    if (settingsList.length === 0) {
      return;
    }

    const { from, to } = localDayBounds(now);

    for (const settings of settingsList) {
      // Each row's send is wrapped so a request-level send failure for one
      // (user, child) doesn't skip the rest of this hour's due summaries —
      // unlike feeding reminders these are hour-matched, so a skipped user
      // would miss that day's summary entirely rather than self-healing.
      try {
        const counts = await this.countEventsByType(settings.childId, from, to);
        const tokens = await this.tokensForUser(settings.userId);
        await this.pushSender.sendToTokens(tokens, {
          title: 'Tagesüberblick',
          body: `Heute: ${counts.FEEDING} Fütterungen, ${counts.SLEEP} Schlafphasen, ${counts.DIAPER} Windelwechsel.`,
          // See the feeding reminder above for why `householdId` is carried.
          data: {
            type: 'DAILY_SUMMARY',
            householdId: await this.householdIdForChild(settings.childId),
            childId: settings.childId,
          },
        });
      } catch (error) {
        this.logger.error(
          `Failed to send daily summary for settings ${settings.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  /**
   * Reminds about planned medications and vaccinations (MED-7), at the lead
   * time each household member configured and again on the due day itself.
   *
   * Runs once daily rather than hourly (roadmap decision 2): due dates are
   * day-granular, so a more frequent run would deliver nothing new and would
   * only multiply the de-duplication surface against the single shared
   * `HealthRecord.reminderLastSentAt`.
   *
   * Unlike the feeding reminder this is not driven off `NotificationSettings`
   * rows: the appointment belongs to the child, so it goes to EVERY household
   * member who has not opted out — including members who never opened the
   * settings page and therefore have no row at all.
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM, { name: MEDICAL_REMINDER_CRON })
  async checkMedicalReminders(): Promise<void> {
    const now = this.clock.now();

    const records = await this.prisma.healthRecord.findMany({
      where: {
        reminderEnabled: true,
        // MED-10: an entry marked as done drops out of the scan entirely (a
        // deleted one is gone anyway).
        administeredAt: null,
        dueAt: {
          not: null,
          // Nobody can configure a longer lead time, so nothing further out can
          // be due for a reminder today.
          lte: addDays(now, MEDICAL_REMINDER_MAX_LEAD_DAYS),
          // Only bounds how much of the table is walked — an overdue record
          // that was already nudged is inert regardless of this window.
          gte: addDays(now, -MEDICAL_REMINDER_OVERDUE_GRACE_DAYS),
        },
      },
      select: {
        id: true,
        childId: true,
        kind: true,
        name: true,
        dueAt: true,
        reminderLastSentAt: true,
        child: { select: { householdId: true } },
      },
    });

    for (const record of records) {
      // Per-record isolation, same as the other two crons: one child's failure
      // must not cost every later record its reminder for the day.
      try {
        await this.sendMedicalRemindersForRecord(record, now);
      } catch (error) {
        this.logger.error(
          `Failed to process medical reminders for record ${record.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  /**
   * Fans one due record out to every household member, each judged against
   * their own lead time.
   *
   * The shared `reminderLastSentAt` is snapshotted once up front so all members
   * are resolved against the same pre-run value — reading it per member would
   * make the outcome depend on iteration order.
   */
  private async sendMedicalRemindersForRecord(record: DueHealthRecord, now: Date): Promise<void> {
    const { householdId } = record.child;
    const dueAt = record.dueAt;
    if (!dueAt) {
      return;
    }
    const sentAtSnapshot = record.reminderLastSentAt;

    const members = await this.prisma.membership.findMany({
      where: { householdId },
      select: { userId: true },
    });
    if (members.length === 0) {
      return;
    }

    const settingsRows = await this.prisma.notificationSettings.findMany({
      where: { childId: record.childId, userId: { in: members.map((m) => m.userId) } },
    });
    const settingsByUser = new Map(settingsRows.map((row) => [row.userId, row]));

    let anySent = false;
    for (const { userId } of members) {
      // A missing row means the member never touched the settings — treated as
      // the defaults (enabled), so reminders are opt-out, not opt-in.
      const settings = settingsByUser.get(userId);
      const trigger = resolveMedicalReminderTrigger({
        now,
        dueAt,
        reminderLastSentAt: sentAtSnapshot,
        enabled:
          settings?.medicalReminderEnabled ?? DEFAULT_NOTIFICATION_SETTINGS.medicalReminderEnabled,
        leadDays:
          settings?.medicalReminderLeadDays ??
          DEFAULT_NOTIFICATION_SETTINGS.medicalReminderLeadDays,
      });
      if (!trigger) {
        continue;
      }

      try {
        const tokens = await this.tokensForUser(userId);
        await this.pushSender.sendToTokens(
          tokens,
          medicalReminderPayload(record, householdId, trigger, dueAt, now),
        );
        anySent = true;
      } catch (error) {
        // One member's transport failure forfeits this trigger for them only.
        // There is deliberately no per-(record, member) retry state — that is
        // the second notification mechanism the roadmap rules out.
        this.logger.error(
          `Failed to send medical reminder for record ${record.id} / user ${userId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    if (anySent) {
      await this.prisma.healthRecord.update({
        where: { id: record.id },
        data: { reminderLastSentAt: now },
      });
    }
  }

  /**
   * Resolves a child's household, so a push payload can carry the id its deep
   * link needs (MED-11). Returns an empty string if the child vanished between
   * the settings read and here — the push still goes out, just without a
   * usable deep link, which beats swallowing the reminder.
   */
  private async householdIdForChild(childId: string): Promise<string> {
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      select: { householdId: true },
    });
    return child?.householdId ?? '';
  }

  private async tokensForUser(userId: string): Promise<string[]> {
    const subscriptions = await this.prisma.pushSubscription.findMany({ where: { userId } });
    return subscriptions.map((subscription) => subscription.token);
  }

  private async countEventsByType(
    childId: string,
    from: Date,
    to: Date,
  ): Promise<Record<EventType, number>> {
    const [feeding, sleep, diaper] = await Promise.all([
      this.prisma.event.count({
        where: { childId, type: EventType.FEEDING, occurredAt: { gte: from, lt: to } },
      }),
      this.prisma.event.count({
        where: { childId, type: EventType.SLEEP, occurredAt: { gte: from, lt: to } },
      }),
      this.prisma.event.count({
        where: { childId, type: EventType.DIAPER, occurredAt: { gte: from, lt: to } },
      }),
    ]);

    return { FEEDING: feeding, SLEEP: sleep, DIAPER: diaper };
  }
}

/**
 * Builds the reminder push for one record and trigger.
 *
 * Hardcoded German, exactly like the feeding and daily-summary pushes: the
 * scheduler has no per-user language to translate into — the user's choice is
 * a frontend-only `i18next` setting until Phase 7.6 persists it. The English
 * wording already exists under the frontend's `health.push.*` keys so 7.6 can
 * wire it up without re-authoring the texts. See `docs/known-issues.md`.
 */
function medicalReminderPayload(
  record: DueHealthRecord,
  householdId: string,
  trigger: MedicalReminderTrigger,
  dueAt: Date,
  now: Date,
): PushNotificationPayload {
  const noun =
    toHealthRecordKind(record.kind) === HealthRecordKind.VACCINATION ? 'Impfung' : 'Medikament';
  const dateLabel = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(dueAt);
  const isOverdue = startOfLocalDay(dueAt).getTime() < startOfLocalDay(now).getTime();

  const { title, body } =
    trigger === 'LEAD'
      ? {
          title: 'Anstehender Termin',
          body: `${noun} „${record.name}“ ist am ${dateLabel} fällig.`,
        }
      : isOverdue
        ? {
            title: 'Überfälliger Termin',
            body: `${noun} „${record.name}“ war am ${dateLabel} fällig.`,
          }
        : {
            title: 'Heute fällig',
            body: `${noun} „${record.name}“ ist heute fällig.`,
          };

  return {
    title,
    body,
    // All values must be strings (FCM). `healthRecordId` is what lets the tap
    // open the entry itself rather than just the overview (MED-11).
    data: {
      type: 'MEDICAL_REMINDER',
      householdId,
      childId: record.childId,
      healthRecordId: record.id,
    },
  };
}

/** Local-midnight-to-next-local-midnight `[from, to)` bounds for the given instant's day. */
function localDayBounds(now: Date): { from: Date; to: Date } {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}
