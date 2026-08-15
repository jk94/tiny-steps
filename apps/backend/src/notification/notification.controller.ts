import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { NotificationSettingsService } from './notification-settings.service';
import type { NotificationSettingsView } from './notification-settings.service';

/**
 * Per-(user, child) notification settings. Household-scoped (routes nest under
 * `/households/:householdId/children/:childId`), so `HouseholdMembershipGuard`
 * runs after `JwtAuthGuard`; the settings themselves are still keyed by the
 * *calling* user, so two members of the same household keep independent
 * settings for the same child. No `@RequireRole` — any member may manage their
 * own notification preferences, consistent with the other read/write routes.
 */
@Controller('households/:householdId/children/:childId/notification-settings')
export class NotificationController {
  constructor(private readonly notificationSettingsService: NotificationSettingsService) {}

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get()
  async get(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationSettingsView> {
    return this.notificationSettingsService.get(householdId, childId, user.id);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @Put()
  async update(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Body() dto: UpdateNotificationSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationSettingsView> {
    return this.notificationSettingsService.update(householdId, childId, user.id, dto);
  }
}
