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
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { HouseholdActor } from '../household/decorators/household-actor.decorator';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { RequireRole } from '../household/guards/require-role.decorator';
import { ENTRY_WRITE_ROLES, FULL_WRITE_ROLES } from '../household/household-permissions';
import { CreateGrowthMeasurementDto } from './dto/create-growth-measurement.dto';
import { GrowthRangeQueryDto } from './dto/growth-range-query.dto';
import { GrowthReferenceQueryDto } from './dto/growth-reference-query.dto';
import { UpdateGrowthMeasurementDto } from './dto/update-growth-measurement.dto';
import { GrowthService } from './growth.service';
import type { GrowthMeasurementSummary, GrowthReferenceResponse } from './growth.service';

/**
 * Growth measurements for one child (roadmap Phase 7.1).
 *
 * Role scoping (Phase 7.5), exactly like the event controllers: reads are open
 * to every member; recording and editing need `ENTRY_WRITE_ROLES` (a CAREGIVER
 * additionally only reaches measurements they recorded themselves — enforced
 * per-row in `GrowthService` via `assertMayEditEntry`); deleting needs
 * `FULL_WRITE_ROLES`. A non-member still resolves to 404 in
 * `HouseholdMembershipGuard` before any role check runs.
 */
@Controller('households/:householdId/children/:childId/growth')
export class GrowthController {
  constructor(private readonly growthService: GrowthService) {}

  // Guard order matters: HouseholdMembershipGuard reads request.user
  // (populated by JwtAuthGuard), and CsrfGuard is last — same ordering as
  // FeedingController.
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(...ENTRY_WRITE_ROLES)
  @Post()
  async create(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Body() dto: CreateGrowthMeasurementDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GrowthMeasurementSummary> {
    return this.growthService.create(householdId, childId, user.id, dto);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get()
  async list(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Query() range: GrowthRangeQueryDto,
  ): Promise<GrowthMeasurementSummary[]> {
    return this.growthService.list(householdId, childId, range);
  }

  // Must be declared before `GET :measurementId` — otherwise Nest/Express
  // route matching would capture "reference" as the id param (same reason
  // FeedingController declares `active-timer` first).
  //
  // Deliberately NOT HTTP-cached. The WHO tables themselves are static, but
  // the response also depends on `Child.sex`: a parent who fills that in on
  // the settings page must see percentile bands immediately, and a day-long
  // `Cache-Control` would serve them the `available: false` body instead.
  // React Query's `staleTime` already removes the per-tab-switch refetch,
  // without surviving the change that invalidates it.
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get('reference')
  async getReference(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Query() query: GrowthReferenceQueryDto,
  ): Promise<GrowthReferenceResponse> {
    return this.growthService.getReference(householdId, childId, query.indicator);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get(':measurementId')
  async getOne(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('measurementId') measurementId: string,
  ): Promise<GrowthMeasurementSummary> {
    return this.growthService.findOne(householdId, childId, measurementId);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(...ENTRY_WRITE_ROLES)
  @Patch(':measurementId')
  async update(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('measurementId') measurementId: string,
    @Body() dto: UpdateGrowthMeasurementDto,
    @HouseholdActor() actor: HouseholdActor,
  ): Promise<GrowthMeasurementSummary> {
    return this.growthService.update(householdId, childId, measurementId, actor, dto);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(...FULL_WRITE_ROLES)
  @Delete(':measurementId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('measurementId') measurementId: string,
  ): Promise<void> {
    await this.growthService.remove(householdId, childId, measurementId);
  }
}
