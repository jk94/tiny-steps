import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChildModule } from '../child/child.module';
import { ClockService } from '../common/clock.service';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { HouseholdModule } from '../household/household.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PushModule } from '../push/push.module';
import { NotificationController } from './notification.controller';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { NotificationSettingsService } from './notification-settings.service';

@Module({
  // AuthModule/HouseholdModule/ChildModule: same nested household/child
  // scoping as EventModule/ExportModule — the settings routes live under
  // /households/:householdId/children/:childId. PushModule: exports
  // PushSenderService, injected into the scheduler to actually deliver pushes.
  imports: [PrismaModule, AuthModule, HouseholdModule, ChildModule, PushModule],
  controllers: [NotificationController],
  // HouseholdMembershipGuard re-declared as a provider (see EventModule's own
  // doc comment). ClockService is provided here for the scheduler; it's a
  // trivial stateless wrapper, so a local provider is fine (no shared module).
  providers: [
    NotificationSettingsService,
    NotificationSchedulerService,
    HouseholdMembershipGuard,
    ClockService,
  ],
})
export class NotificationModule {}
