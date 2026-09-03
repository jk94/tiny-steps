import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChildModule } from '../child/child.module';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { HouseholdModule } from '../household/household.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthRecordController } from './health-record.controller';
import { HealthRecordService } from './health-record.service';

@Module({
  // Same imports as MilestoneModule: health records are online-only and
  // deliberately do not broadcast (MED-15), so there is no RealtimeModule
  // dependency. Note also that this module owns no scheduling — the reminder
  // cron lives in the existing NotificationSchedulerService rather than in a
  // second scheduler class, and reaches `healthRecord` through Prisma directly.
  imports: [PrismaModule, AuthModule, HouseholdModule, ChildModule],
  controllers: [HealthRecordController],
  // HouseholdMembershipGuard has to be re-declared as a provider here rather
  // than relying on HouseholdModule's export: NestJS resolves a guard
  // referenced via `@UseGuards(GuardClass)` from the module declaring the
  // controller — same pattern as ChildModule/GrowthModule/MilestoneModule.
  providers: [HealthRecordService, HouseholdMembershipGuard],
})
export class HealthRecordModule {}
