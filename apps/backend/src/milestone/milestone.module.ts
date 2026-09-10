import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChildModule } from '../child/child.module';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { HouseholdModule } from '../household/household.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MilestonePhotoStorageService } from './milestone-photo-storage.service';
import { MilestoneController } from './milestone.controller';
import { MilestoneService } from './milestone.service';

@Module({
  // Same imports as GrowthModule: milestones are online-only and deliberately
  // do not broadcast (M-15), so there is no RealtimeModule dependency — a
  // memory recorded on one device does not need to appear on another within
  // the second.
  imports: [PrismaModule, AuthModule, HouseholdModule, ChildModule],
  controllers: [MilestoneController],
  // HouseholdMembershipGuard has to be re-declared as a provider here rather
  // than relying on HouseholdModule's export: NestJS resolves a guard
  // referenced via `@UseGuards(GuardClass)` from the module declaring the
  // controller — same pattern as ChildModule/GrowthModule.
  providers: [MilestoneService, MilestonePhotoStorageService, HouseholdMembershipGuard],
  // Exported for the PDF report (roadmap Phase 7.4) — see GrowthModule's
  // identical note.
  exports: [MilestoneService],
})
export class MilestoneModule {}
