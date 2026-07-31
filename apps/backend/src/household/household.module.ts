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
  // HouseholdAccessService is exported alongside HouseholdMembershipGuard
  // (not just the guard itself): NestJS resolves a guard referenced via
  // `@UseGuards(GuardClass)` from the *consuming* controller's own module,
  // so `ChildModule` re-declares `HouseholdMembershipGuard` as its own
  // provider (see `child.module.ts`) rather than relying purely on this
  // export — that re-declared instance needs HouseholdAccessService
  // resolvable from ChildModule's own import graph, hence exporting it here
  // too.
  exports: [HouseholdMembershipGuard, HouseholdAccessService],
})
export class HouseholdModule {}
