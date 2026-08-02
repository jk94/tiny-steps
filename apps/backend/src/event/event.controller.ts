import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { EventRangeQueryDto } from './dto/event-range-query.dto';
import { EventService } from './event.service';
import type { EventStatsSummary, TimelineEventSummary } from './event.service';

/**
 * Read-only routes spanning all three event types — no `CsrfGuard`, matching
 * every other GET route in this codebase (CSRF only matters for
 * state-changing requests). No `@RequireRole` either: any household member
 * may view the timeline/stats, same read-access rule as everywhere else.
 */
@Controller('households/:householdId/children/:childId/events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get('daily')
  async getDaily(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Query() query: EventRangeQueryDto,
  ): Promise<TimelineEventSummary[]> {
    return this.eventService.listDaily(
      householdId,
      childId,
      new Date(query.from),
      new Date(query.to),
    );
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get('stats')
  async getStats(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Query() query: EventRangeQueryDto,
  ): Promise<EventStatsSummary> {
    return this.eventService.getStatsSummary(
      householdId,
      childId,
      new Date(query.from),
      new Date(query.to),
    );
  }
}
