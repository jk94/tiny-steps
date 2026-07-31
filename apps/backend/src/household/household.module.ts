import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HouseholdMembershipGuard } from './guards/household-membership.guard';
import { HouseholdAccessService } from './household-access.service';
import { HouseholdController } from './household.controller';
import { HouseholdService } from './household.service';
import { InviteController } from './invite.controller';
import { InviteService } from './invite.service';

@Module({
  // AuthModule is imported (not just relied on globally) to reuse its
  // exported JwtAuthGuard/CsrfGuard — HouseholdModule only consumes those
  // exports, so there's no circular dependency back into AuthModule.
  // PrismaModule is `@Global()` already, but imported explicitly here for
  // clarity/consistency with the rest of this module's dependencies.
  imports: [PrismaModule, AuthModule],
  controllers: [HouseholdController, InviteController],
  providers: [HouseholdService, InviteService, HouseholdAccessService, HouseholdMembershipGuard],
  exports: [HouseholdMembershipGuard],
})
export class HouseholdModule {}
