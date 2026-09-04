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
  Req,
  UseGuards,
} from '@nestjs/common';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { ChangeMemberRoleDto } from './dto/change-member-role.dto';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { HouseholdMembershipGuard } from './guards/household-membership.guard';
import { RequireRole } from './guards/require-role.decorator';
import { OWNER_ROLES } from './household-permissions';
import { HouseholdRole, toHouseholdRole } from './household-role.enum';
import { HouseholdService } from './household.service';
import type { HouseholdMemberSummary, HouseholdSummary } from './household.service';
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

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get(':householdId/members')
  async listMembers(@Param('householdId') householdId: string): Promise<HouseholdMemberSummary[]> {
    return this.householdService.listMembers(householdId);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(...OWNER_ROLES)
  @Post(':householdId/invites')
  async createInvite(
    @Param('householdId') householdId: string,
    @Body() dto: CreateInviteDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreatedInvite> {
    // The role comes from the inviting owner's request, never from the
    // invitee (ROL-8); a body-less invite still means CO_PARENT.
    return this.inviteService.create(user.id, householdId, dto.role);
  }

  // `:userId` is a `User.id`, matching what `GET .../members` returns, not the
  // internal `Membership.id` — the client never sees the latter.
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(...OWNER_ROLES)
  @Patch(':householdId/members/:userId')
  async changeMemberRole(
    @Param('householdId') householdId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: ChangeMemberRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HouseholdMemberSummary> {
    return this.householdService.changeMemberRole(householdId, user.id, targetUserId, dto.role);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(...OWNER_ROLES)
  @Delete(':householdId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('householdId') householdId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.householdService.removeMember(householdId, user.id, targetUserId);
  }
}
