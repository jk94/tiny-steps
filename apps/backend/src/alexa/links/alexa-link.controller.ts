import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CsrfGuard } from '../../auth/guards/csrf.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-request';
import { AlexaEnabledGuard } from '../alexa-enabled.guard';
import { UpdateAlexaLinkDto } from './dto/update-alexa-link.dto';
import { AlexaLinksOverview, AlexaLinkService, AlexaLinkView } from './alexa-link.service';

/**
 * The signed-in user's own Alexa links (ALX-12). User-scoped, not under
 * `/households/:householdId`, so no `@RequireRole` applies — every user may
 * manage their own links whatever their household roles are.
 */
@Controller('alexa/links')
@UseGuards(JwtAuthGuard)
export class AlexaLinkController {
  constructor(private readonly linkService: AlexaLinkService) {}

  /**
   * Deliberately not behind `AlexaEnabledGuard`: the profile page uses the
   * `enabled` flag to decide whether to show the Alexa section at all.
   */
  @Get()
  overview(@CurrentUser() user: AuthenticatedUser): Promise<AlexaLinksOverview> {
    return this.linkService.overview(user.id);
  }

  @UseGuards(AlexaEnabledGuard, CsrfGuard)
  @Patch(':linkId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('linkId') linkId: string,
    @Body() dto: UpdateAlexaLinkDto,
  ): Promise<AlexaLinkView> {
    return this.linkService.setDefaultChild(user.id, linkId, dto.defaultChildId);
  }

  @UseGuards(AlexaEnabledGuard, CsrfGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':linkId')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('linkId') linkId: string): Promise<void> {
    return this.linkService.revoke(user.id, linkId);
  }
}
