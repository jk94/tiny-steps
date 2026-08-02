import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChildModule } from '../child/child.module';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { HouseholdModule } from '../household/household.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FeedingController } from './feeding.controller';
import { FeedingService } from './feeding.service';

@Module({
  // AuthModule/HouseholdModule: reuses their exported JwtAuthGuard/
  // CsrfGuard/HouseholdAccessService (feeding routes are nested under
  // /households/:householdId/children/:childId/feeding-events and reuse
  // the same membership check unmodified — see ChildModule's own doc
  // comment for the identical reasoning). ChildModule is imported for
  // consistency with the household->child->feeding nesting, even though
  // FeedingService resolves child scoping directly via PrismaService
  // (mirroring ChildService's own `findChildOrThrow`) rather than through
  // ChildService, which ChildModule doesn't currently export.
  // PrismaModule is `@Global()` already, but imported explicitly here for
  // clarity/consistency, mirroring HouseholdModule's/ChildModule's own doc
  // comments.
  imports: [PrismaModule, AuthModule, HouseholdModule, ChildModule],
  controllers: [FeedingController],
  // HouseholdMembershipGuard is re-declared as a provider here (not just
  // pulled in via HouseholdModule's export): NestJS resolves a guard
  // referenced via `@UseGuards(GuardClass)` from the module that declares
  // the controller using it, not transitively through an imported module's
  // own provider graph — same pattern as `ChildModule`.
  providers: [FeedingService, HouseholdMembershipGuard],
})
export class FeedingModule {}
