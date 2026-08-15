import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { NotificationController } from './notification.controller';
import { NotificationSettingsService } from './notification-settings.service';
import type { NotificationSettingsView } from './notification-settings.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

const HOUSEHOLD_ID = 'household-1';
const CHILD_ID = 'child-1';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'parent@example.com',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
};

const view: NotificationSettingsView = {
  feedingReminderEnabled: true,
  feedingReminderThresholdHours: 4,
  dailySummaryEnabled: true,
  dailySummaryHourLocal: 20,
};

describe('NotificationController', () => {
  let settingsService: jest.Mocked<Pick<NotificationSettingsService, 'get' | 'update'>>;
  let controller: NotificationController;

  beforeEach(() => {
    settingsService = { get: jest.fn(), update: jest.fn() };
    controller = new NotificationController(
      settingsService as unknown as NotificationSettingsService,
    );
  });

  it('delegates GET to the service with householdId, childId and the current user id', async () => {
    settingsService.get.mockResolvedValue(view);

    const result = await controller.get(HOUSEHOLD_ID, CHILD_ID, user);

    expect(settingsService.get).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, user.id);
    expect(result).toBe(view);
  });

  it('delegates PUT to the service with householdId, childId, current user id and dto', async () => {
    const dto: UpdateNotificationSettingsDto = {
      feedingReminderEnabled: false,
      feedingReminderThresholdHours: 6,
      dailySummaryEnabled: false,
      dailySummaryHourLocal: 9,
    };
    settingsService.update.mockResolvedValue({ ...view, ...dto });

    const result = await controller.update(HOUSEHOLD_ID, CHILD_ID, dto, user);

    expect(settingsService.update).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, user.id, dto);
    expect(result).toEqual({ ...view, ...dto });
  });
});
