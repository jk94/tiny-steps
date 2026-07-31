import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { HouseholdModule } from '../household/household.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ChildPhotoStorageService } from './child-photo-storage.service';
import { ChildController } from './child.controller';
import { ChildService } from './child.service';

@Module({
  // AuthModule: reuses its exported JwtAuthGuard/CsrfGuard.
  // HouseholdModule: reuses its exported HouseholdAccessService (child
  // routes are nested under /households/:householdId/children and reuse
  // the same membership check unmodified — see ADR-0003).
  // PrismaModule is `@Global()` already, but imported explicitly here for
  // clarity/consistency, mirroring HouseholdModule's own doc comment.
  imports: [PrismaModule, AuthModule, HouseholdModule],
  controllers: [ChildController],
  // HouseholdMembershipGuard is re-declared as a provider here (not just
  // pulled in via HouseholdModule's export): NestJS resolves a guard
  // referenced via `@UseGuards(GuardClass)` from the module that declares
  // the controller using it, not transitively through an imported module's
  // own provider graph — so ChildController needs its own instance,
  // constructed with the HouseholdAccessService exported by HouseholdModule
  // (see the comment there).
  providers: [ChildService, ChildPhotoStorageService, HouseholdMembershipGuard],
})
export class ChildModule {}
