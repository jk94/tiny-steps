import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { HouseholdActor } from '../household/decorators/household-actor.decorator';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { RequireRole } from '../household/guards/require-role.decorator';
import { ENTRY_WRITE_ROLES, FULL_WRITE_ROLES } from '../household/household-permissions';
import { CreateDiaperEventDto } from './dto/create-diaper-event.dto';
import { UpdateDiaperEventDto } from './dto/update-diaper-event.dto';
import { DiaperService } from './diaper.service';
import type { DiaperEventSummary } from './diaper.service';

/**
 * Role scoping (Phase 7.5), mirroring `FeedingController`/`SleepController`:
 * reads are open to every member; recording and editing need
 * `ENTRY_WRITE_ROLES` (a CAREGIVER additionally only reaches entries they
 * recorded themselves — enforced per-row in `DiaperService` via
 * `assertMayEditEntry`); deleting needs `FULL_WRITE_ROLES`. A non-member still
 * resolves to 404 in `HouseholdMembershipGuard` before any role check runs.
 *
 * Only 5 routes here — no `active-timer` or `/stop` route, since Diaper is
 * never timer-based (see `DiaperService`'s doc comment). Consequently
 * there's no route-ordering hazard either (no static segment colliding
 * with `:eventId`, unlike `FeedingController`'s `active-timer`).
 */
@Controller('households/:householdId/children/:childId/diaper-events')
export class DiaperController {
  constructor(private readonly diaperService: DiaperService) {}

  // Guard order matters: HouseholdMembershipGuard reads request.user
  // (populated by JwtAuthGuard), and CsrfGuard is last, mirroring
  // FeedingController's/SleepController's guard ordering.
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(...ENTRY_WRITE_ROLES)
  @Post()
  async create(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Body() dto: CreateDiaperEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DiaperEventSummary> {
    return this.diaperService.create(householdId, childId, user.id, dto);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get()
  async list(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
  ): Promise<DiaperEventSummary[]> {
    return this.diaperService.list(householdId, childId);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get(':eventId')
  async getOne(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('eventId') eventId: string,
  ): Promise<DiaperEventSummary> {
    return this.diaperService.findOne(householdId, childId, eventId);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(...ENTRY_WRITE_ROLES)
  @Patch(':eventId')
  async update(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateDiaperEventDto,
    @HouseholdActor() actor: HouseholdActor,
  ): Promise<DiaperEventSummary> {
    return this.diaperService.update(householdId, childId, eventId, actor, dto);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(...FULL_WRITE_ROLES)
  @Delete(':eventId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('eventId') eventId: string,
  ): Promise<void> {
    await this.diaperService.remove(householdId, childId, eventId);
  }
}
