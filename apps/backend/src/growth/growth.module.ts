import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChildModule } from '../child/child.module';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { HouseholdModule } from '../household/household.module';
import { PrismaModule } from '../prisma/prisma.module';
import { GrowthController } from './growth.controller';
import { GrowthService } from './growth.service';

@Module({
  // Same imports as FeedingModule minus RealtimeModule: growth tracking is
  // online-only and deliberately does not broadcast (W-16) — there is no
  // second device waiting on a measurement the way there is on a running
  // feeding timer. See GrowthService's doc comment.
  imports: [PrismaModule, AuthModule, HouseholdModule, ChildModule],
  controllers: [GrowthController],
  // HouseholdMembershipGuard has to be re-declared as a provider here rather
  // than relying on HouseholdModule's export: NestJS resolves a guard
  // referenced via `@UseGuards(GuardClass)` from the module declaring the
  // controller — same pattern as ChildModule/FeedingModule.
  providers: [GrowthService, HouseholdMembershipGuard],
})
export class GrowthModule {}
