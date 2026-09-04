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
import { StopEventDto } from '../event/dto/stop-event.dto';
import { CreateFeedingEventDto } from './dto/create-feeding-event.dto';
import { UpdateFeedingEventDto } from './dto/update-feeding-event.dto';
import { FeedingService } from './feeding.service';
import type { FeedingEventSummary } from './feeding.service';

/**
 * Role scoping (Phase 7.5): reads are open to every member; recording, editing
 * and stopping need `ENTRY_WRITE_ROLES` (a CAREGIVER additionally only reaches
 * entries they recorded themselves — enforced per-row in `FeedingService` via
 * `assertMayEditEntry`); deleting needs `FULL_WRITE_ROLES`. A non-member still
 * resolves to 404 in `HouseholdMembershipGuard` before any role check runs, so
 * 403 here always means "member, wrong role" rather than "unknown household".
 */
@Controller('households/:householdId/children/:childId/feeding-events')
export class FeedingController {
  constructor(private readonly feedingService: FeedingService) {}

  // Guard order matters: HouseholdMembershipGuard reads request.user
  // (populated by JwtAuthGuard), and CsrfGuard is last, mirroring
  // ChildController's guard ordering.
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(...ENTRY_WRITE_ROLES)
  @Post()
  async create(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Body() dto: CreateFeedingEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FeedingEventSummary> {
    return this.feedingService.create(householdId, childId, user.id, dto);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get()
  async list(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
  ): Promise<FeedingEventSummary[]> {
    return this.feedingService.list(householdId, childId);
  }

  // Must be declared before `GET :eventId` — otherwise Nest/Express route
  // matching would capture "active-timer" as the `:eventId` param.
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get('active-timer')
  async getActiveTimer(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
  ): Promise<FeedingEventSummary | null> {
    return this.feedingService.findActiveTimer(householdId, childId);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get(':eventId')
  async getOne(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('eventId') eventId: string,
  ): Promise<FeedingEventSummary> {
    return this.feedingService.findOne(householdId, childId, eventId);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(...ENTRY_WRITE_ROLES)
  @Patch(':eventId')
  async update(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateFeedingEventDto,
    @HouseholdActor() actor: HouseholdActor,
  ): Promise<FeedingEventSummary> {
    return this.feedingService.update(householdId, childId, eventId, actor, dto);
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
    await this.feedingService.remove(householdId, childId, eventId);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(...ENTRY_WRITE_ROLES)
  @Post(':eventId/stop')
  async stop(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('eventId') eventId: string,
    @Body() dto: StopEventDto,
    @HouseholdActor() actor: HouseholdActor,
  ): Promise<FeedingEventSummary> {
    return this.feedingService.stop(householdId, childId, eventId, actor, dto);
  }
}
