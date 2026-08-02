import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChildModule } from '../child/child.module';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { HouseholdModule } from '../household/household.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DiaperController } from './diaper.controller';
import { DiaperService } from './diaper.service';

@Module({
  // AuthModule/HouseholdModule: reuses their exported JwtAuthGuard/
  // CsrfGuard/HouseholdAccessService (diaper routes are nested under
  // /households/:householdId/children/:childId/diaper-events and reuse
  // the same membership check unmodified — see ChildModule's own doc
  // comment for the identical reasoning).
  // ChildModule currently provides no functional wiring here: it doesn't
  // export ChildService (or any provider), so DiaperService can't and
  // doesn't inject it — instead it re-implements the same child/household
  // scoping check directly via PrismaService (mirroring ChildService's own
  // `findChildOrThrow`, see DiaperService's doc comment). The import is
  // kept anyway, intentionally, as a placeholder documenting the real
  // dependency relationship (household->child->diaper), same rationale as
  // FeedingModule's/SleepModule's own doc comments — this is the third
  // module to carry it unchanged, not yet the trigger to extract a shared
  // provider.
  // PrismaModule is `@Global()` already, but imported explicitly here for
  // clarity/consistency, mirroring HouseholdModule's/ChildModule's/
  // FeedingModule's/SleepModule's own doc comments.
  imports: [PrismaModule, AuthModule, HouseholdModule, ChildModule],
  controllers: [DiaperController],
  // HouseholdMembershipGuard is re-declared as a provider here (not just
  // pulled in via HouseholdModule's export): NestJS resolves a guard
  // referenced via `@UseGuards(GuardClass)` from the module that declares
  // the controller using it, not transitively through an imported module's
  // own provider graph — same pattern as `ChildModule`/`FeedingModule`/
  // `SleepModule`.
  providers: [DiaperService, HouseholdMembershipGuard],
})
export class DiaperModule {}
