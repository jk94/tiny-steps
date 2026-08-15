import { Injectable, NotFoundException } from '@nestjs/common';
import { Child, NotificationSettings } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

/**
 * The client-facing subset of a `NotificationSettings` row — the four editable
 * fields, without the internal `feedingReminderLastSentAt` bookkeeping or DB
 * ids/timestamps.
 */
export interface NotificationSettingsView {
  feedingReminderEnabled: boolean;
  feedingReminderThresholdHours: number;
  dailySummaryEnabled: boolean;
  dailySummaryHourLocal: number;
}

/**
 * Defaults returned by `get()` when a (user, child) pair has no settings row
 * yet — kept in sync with the `@default(...)` values on the Prisma model, so a
 * brand-new child shows sensible toggles before the user ever saves.
 */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettingsView = {
  feedingReminderEnabled: true,
  feedingReminderThresholdHours: 4,
  dailySummaryEnabled: true,
  dailySummaryHourLocal: 20,
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
  };
}
