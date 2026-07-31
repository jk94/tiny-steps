import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { HouseholdMembershipGuard } from './guards/household-membership.guard';
import { RequireRole } from './guards/require-role.decorator';
import { HouseholdRole, toHouseholdRole } from './household-role.enum';
import { HouseholdService } from './household.service';
import type { HouseholdSummary } from './household.service';
import { InviteService } from './invite.service';
import type { CreatedInvite } from './invite.service';
import type { HouseholdScopedRequest } from './types/household-scoped-request';

@Controller('households')
export class HouseholdController {
  constructor(
    private readonly householdService: HouseholdService,
    private readonly inviteService: InviteService,
  ) {}

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Post()
  async create(
    @Body() dto: CreateHouseholdDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HouseholdSummary> {
    const household = await this.householdService.create(user.id, dto);
    return {
      id: household.id,
      name: household.name,
      role: HouseholdRole.OWNER,
      createdAt: household.createdAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<HouseholdSummary[]> {
    return this.householdService.listForUser(user.id);
  }

  // Order matters: HouseholdMembershipGuard reads `request.user`, which
  // JwtAuthGuard must have already populated (see the guard's own doc
  // comment).
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get(':householdId')
  getOne(@Req() req: HouseholdScopedRequest): HouseholdSummary {
    const { membership } = req;
    return {
      id: membership.household.id,
      name: membership.household.name,
      role: toHouseholdRole(membership.role),
      createdAt: membership.household.createdAt,
    };
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(HouseholdRole.OWNER)
  @Post(':householdId/invites')
  async createInvite(
    @Param('householdId') householdId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreatedInvite> {
    return this.inviteService.create(user.id, householdId);
  }
}
