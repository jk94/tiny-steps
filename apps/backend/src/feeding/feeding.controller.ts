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
import { CreateFeedingEventDto } from './dto/create-feeding-event.dto';
import { UpdateFeedingEventDto } from './dto/update-feeding-event.dto';
import { FeedingService } from './feeding.service';
import type { FeedingEventSummary } from './feeding.service';

/**
 * No `@RequireRole` on any route in this controller: both OWNER and
 * CO_PARENT may create/edit/delete Feeding events (per this repo's
 * CLAUDE.md roles table, only `Child` create/delete is Owner-restricted,
 * not events). Consequently a 403 cannot occur here — a non-member already
 * resolves to 404 via `HouseholdAccessService.findMembershipOrThrow`
 * (invoked by `HouseholdMembershipGuard`) before any role check would run,
 * so there's deliberately no 403 test for this controller.
 */
@Controller('households/:householdId/children/:childId/feeding-events')
export class FeedingController {
  constructor(private readonly feedingService: FeedingService) {}

  // Guard order matters: HouseholdMembershipGuard reads request.user
  // (populated by JwtAuthGuard), and CsrfGuard is last, mirroring
  // ChildController's guard ordering.
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
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
  @Patch(':eventId')
  async update(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateFeedingEventDto,
  ): Promise<FeedingEventSummary> {
    return this.feedingService.update(householdId, childId, eventId, dto);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
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
  @Post(':eventId/stop')
  async stop(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('eventId') eventId: string,
  ): Promise<FeedingEventSummary> {
    return this.feedingService.stop(householdId, childId, eventId);
  }
}
