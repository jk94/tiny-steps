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
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { StopEventDto } from '../event/dto/stop-event.dto';
import { CreateSleepEventDto } from './dto/create-sleep-event.dto';
import { UpdateSleepEventDto } from './dto/update-sleep-event.dto';
import { SleepService } from './sleep.service';
import type { SleepEventSummary } from './sleep.service';

/**
 * No `@RequireRole` on any route in this controller: both OWNER and
 * CO_PARENT may create/edit/delete Sleep events (per this repo's CLAUDE.md
 * roles table, only `Child` create/delete is Owner-restricted, not events).
 * Consequently a 403 cannot occur here — a non-member already resolves to
 * 404 via `HouseholdAccessService.findMembershipOrThrow` (invoked by
 * `HouseholdMembershipGuard`) before any role check would run, so there's
 * deliberately no 403 test for this controller.
 */
@Controller('households/:householdId/children/:childId/sleep-events')
export class SleepController {
  constructor(private readonly sleepService: SleepService) {}

  // Guard order matters: HouseholdMembershipGuard reads request.user
  // (populated by JwtAuthGuard), and CsrfGuard is last, mirroring
  // ChildController's/FeedingController's guard ordering.
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @Post()
  async create(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Body() dto: CreateSleepEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SleepEventSummary> {
    return this.sleepService.create(householdId, childId, user.id, dto);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get()
  async list(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
  ): Promise<SleepEventSummary[]> {
    return this.sleepService.list(householdId, childId);
  }

  // Must be declared before `GET :eventId` — otherwise Nest/Express route
  // matching would capture "active-timer" as the `:eventId` param.
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get('active-timer')
  async getActiveTimer(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
  ): Promise<SleepEventSummary | null> {
    return this.sleepService.findActiveTimer(householdId, childId);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get(':eventId')
  async getOne(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('eventId') eventId: string,
  ): Promise<SleepEventSummary> {
    return this.sleepService.findOne(householdId, childId, eventId);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @Patch(':eventId')
  async update(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateSleepEventDto,
  ): Promise<SleepEventSummary> {
    return this.sleepService.update(householdId, childId, eventId, dto);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @Delete(':eventId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('eventId') eventId: string,
  ): Promise<void> {
    await this.sleepService.remove(householdId, childId, eventId);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @Post(':eventId/stop')
  async stop(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('eventId') eventId: string,
    @Body() dto: StopEventDto,
  ): Promise<SleepEventSummary> {
    return this.sleepService.stop(householdId, childId, eventId, dto);
  }
}
