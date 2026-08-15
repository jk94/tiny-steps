import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationSettingsService,
} from './notification-settings.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

const HOUSEHOLD_ID = 'household-1';
const CHILD_ID = 'child-1';
const USER_ID = 'user-1';

function makeChild() {
  return { id: CHILD_ID, householdId: HOUSEHOLD_ID, name: 'Alex' };
}

function makeSettingsRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'settings-1',
    userId: USER_ID,
    childId: CHILD_ID,
    feedingReminderEnabled: false,
    feedingReminderThresholdHours: 3,
    feedingReminderLastSentAt: null,
    dailySummaryEnabled: false,
    dailySummaryHourLocal: 8,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('NotificationSettingsService', () => {
  let prisma: {
    child: { findUnique: jest.Mock };
    notificationSettings: { findUnique: jest.Mock; upsert: jest.Mock };
  };
  let service: NotificationSettingsService;

  beforeEach(() => {
    prisma = {
      child: { findUnique: jest.fn() },
      notificationSettings: { findUnique: jest.fn(), upsert: jest.fn() },
    };
    service = new NotificationSettingsService(prisma as unknown as PrismaService);
  });

  describe('get', () => {
    it('throws NotFoundException when the child is not in the household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.get(HOUSEHOLD_ID, CHILD_ID, USER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.notificationSettings.findUnique).not.toHaveBeenCalled();
    });

    it('returns defaults when no settings row exists yet', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.notificationSettings.findUnique.mockResolvedValue(null);

      const result = await service.get(HOUSEHOLD_ID, CHILD_ID, USER_ID);

      expect(result).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
      expect(prisma.notificationSettings.findUnique).toHaveBeenCalledWith({
        where: { userId_childId: { userId: USER_ID, childId: CHILD_ID } },
      });
    });

    it('returns the stored view (without internal bookkeeping fields) when a row exists', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.notificationSettings.findUnique.mockResolvedValue(
        makeSettingsRow({ feedingReminderLastSentAt: new Date('2026-01-01T00:00:00.000Z') }),
      );

      const result = await service.get(HOUSEHOLD_ID, CHILD_ID, USER_ID);

      expect(result).toEqual({
        feedingReminderEnabled: false,
        feedingReminderThresholdHours: 3,
        dailySummaryEnabled: false,
        dailySummaryHourLocal: 8,
      });
    });
  });

  describe('update', () => {
    const dto: UpdateNotificationSettingsDto = {
      feedingReminderEnabled: true,
      feedingReminderThresholdHours: 5,
      dailySummaryEnabled: true,
      dailySummaryHourLocal: 21,
    };

    it('throws NotFoundException when the child is not in the household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.update(HOUSEHOLD_ID, CHILD_ID, USER_ID, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.notificationSettings.upsert).not.toHaveBeenCalled();
    });

    it('upserts by (userId, childId) and returns the resulting view', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.notificationSettings.upsert.mockResolvedValue(makeSettingsRow(dto));

      const result = await service.update(HOUSEHOLD_ID, CHILD_ID, USER_ID, dto);

      expect(prisma.notificationSettings.upsert).toHaveBeenCalledWith({
        where: { userId_childId: { userId: USER_ID, childId: CHILD_ID } },
        create: { userId: USER_ID, childId: CHILD_ID, ...dto },
        update: { ...dto },
      });
      expect(result).toEqual(dto);
    });
  });
});
