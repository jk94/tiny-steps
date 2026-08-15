import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto';
import { PushService } from './push.service';

/**
 * Device push-token registration. Deliberately NOT household-scoped (no
 * `HouseholdMembershipGuard`): a token belongs to a user's device, not a
 * household. Mutating routes, so `CsrfGuard` is applied after `JwtAuthGuard`,
 * matching the guard ordering used across the other mutating controllers.
 */
@Controller('push/subscriptions')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async subscribe(
    @Body() dto: CreatePushSubscriptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.pushService.upsert(user.id, dto);
  }

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Delete(':token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribe(
    @Param('token') token: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.pushService.remove(user.id, token);
  }
}
