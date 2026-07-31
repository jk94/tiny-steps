import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { AcceptedInvite, InvitePreview, InviteService } from './invite.service';

@Controller('invites')
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  // Deliberately unauthenticated — lets a not-yet-registered invitee see
  // what they're being invited to before logging in/registering.
  @Get(':token')
  async preview(@Param('token') token: string): Promise<InvitePreview> {
    return this.inviteService.preview(token);
  }

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @HttpCode(HttpStatus.OK)
  @Post(':token/accept')
  async accept(
    @Param('token') token: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AcceptedInvite> {
    return this.inviteService.accept(token, user.id);
  }
}
