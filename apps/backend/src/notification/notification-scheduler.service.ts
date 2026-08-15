import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../common/clock.service';
import { EventType } from '../event/event-type.enum';
import { PushSenderService } from '../push/push-sender.service';

const MS_PER_HOUR = 1000 * 60 * 60;

/** Cron job names, so they can be looked up via Nest's `SchedulerRegistry`. */
export const FEEDING_REMINDER_CRON = 'feeding-reminders';
export const DAILY_SUMMARY_CRON = 'daily-summaries';

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
          data: { type: 'FEEDING_REMINDER', childId: settings.childId },
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
          data: { type: 'DAILY_SUMMARY', childId: settings.childId },
        });
      } catch (error) {
        this.logger.error(
          `Failed to send daily summary for settings ${settings.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
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

/** Local-midnight-to-next-local-midnight `[from, to)` bounds for the given instant's day. */
function localDayBounds(now: Date): { from: Date; to: Date } {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}
