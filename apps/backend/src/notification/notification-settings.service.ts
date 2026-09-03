import { Injectable, NotFoundException } from '@nestjs/common';
import { Child, NotificationSettings } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

/**
 * Default advance notice for a medical reminder (MED-7).
 *
 * Three days is a product decision, not an arbitrary number: it is long enough
 * to still get a pediatrician appointment, short enough that the reminder is
 * not forgotten again before the date. Named rather than inlined, and
 * adjustable per (user, child) through `medicalReminderLeadDays`.
 */
export const MEDICAL_REMINDER_DEFAULT_LEAD_DAYS = 3;

/**
 * Upper bound for a configured lead time. Doubles as the scheduler's
 * look-ahead horizon: no member can ask to be reminded earlier than this, so
 * nothing further out needs to be scanned at all.
 */
export const MEDICAL_REMINDER_MAX_LEAD_DAYS = 30;

/**
 * How far back the daily scan still picks up an untouched overdue record.
 * Purely a bound on how much of the table the query walks — a record already
 * reminded about is inert regardless, and one still un-actioned after a month
 * is not going to be fixed by another push.
 */
export const MEDICAL_REMINDER_OVERDUE_GRACE_DAYS = 30;

/**
 * The client-facing subset of a `NotificationSettings` row — the editable
 * fields, without the internal `feedingReminderLastSentAt` bookkeeping or DB
 * ids/timestamps.
 */
export interface NotificationSettingsView {
  feedingReminderEnabled: boolean;
  feedingReminderThresholdHours: number;
  dailySummaryEnabled: boolean;
  dailySummaryHourLocal: number;
  medicalReminderEnabled: boolean;
  medicalReminderLeadDays: number;
}

/**
 * Defaults returned by `get()` when a (user, child) pair has no settings row
 * yet — kept in sync with the `@default(...)` values on the Prisma model, so a
 * brand-new child shows sensible toggles before the user ever saves.
 *
 * The medical-reminder defaults are also what the scheduler falls back to for a
 * household member with no row at all: reminders are opt-OUT, so a shared
 * appointment is not silently missed by whoever never opened the settings page.
 */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettingsView = {
  feedingReminderEnabled: true,
  feedingReminderThresholdHours: 4,
  dailySummaryEnabled: true,
  dailySummaryHourLocal: 20,
  medicalReminderEnabled: true,
  medicalReminderLeadDays: MEDICAL_REMINDER_DEFAULT_LEAD_DAYS,
};

/**
 * CRUD for per-(user, child) notification settings. Household-scoped access is
 * enforced by the controller's `HouseholdMembershipGuard`; this service adds
 * the same `findChildOrThrow` child/household double-check as `EventService`/
 * `ExportService`, so a child from another household resolves to 404 rather
 * than leaking or mutating cross-household settings.
 */
@Injectable()
export class NotificationSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(
    householdId: string,
    childId: string,
    userId: string,
  ): Promise<NotificationSettingsView> {
    await this.findChildOrThrow(householdId, childId);

    const settings = await this.prisma.notificationSettings.findUnique({
      where: { userId_childId: { userId, childId } },
    });

    return settings ? toView(settings) : DEFAULT_NOTIFICATION_SETTINGS;
  }

  async update(
    householdId: string,
    childId: string,
    userId: string,
    dto: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettingsView> {
    await this.findChildOrThrow(householdId, childId);

    const settings = await this.prisma.notificationSettings.upsert({
      where: { userId_childId: { userId, childId } },
      create: { userId, childId, ...dto },
      update: { ...dto },
    });

    return toView(settings);
  }

  private async findChildOrThrow(householdId: string, childId: string): Promise<Child> {
    const child = await this.prisma.child.findUnique({
      where: { id: childId, householdId },
    });

    if (!child) {
      throw new NotFoundException();
    }

    return child;
  }
}

function toView(settings: NotificationSettings): NotificationSettingsView {
  return {
    feedingReminderEnabled: settings.feedingReminderEnabled,
    feedingReminderThresholdHours: settings.feedingReminderThresholdHours,
    dailySummaryEnabled: settings.dailySummaryEnabled,
    dailySummaryHourLocal: settings.dailySummaryHourLocal,
    medicalReminderEnabled: settings.medicalReminderEnabled,
    medicalReminderLeadDays: settings.medicalReminderLeadDays,
  };
}
