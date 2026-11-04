import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UseGuards,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { AlexaEnabledGuard } from '../alexa-enabled.guard';
import { AlexaRequestVerifier, AlexaVerificationError } from './alexa-request-verifier';
import { isAlexaRequestEnvelope, type AlexaResponseEnvelope } from './alexa-request.types';
import { AlexaSkillService } from './alexa-skill.service';

/**
 * The skill's HTTPS endpoint (`POST /api/alexa/skill`), configured as the
 * "Default Endpoint" in the Alexa developer console (ADR-0017).
 *
 * Unauthenticated in the app's sense — no cookie, no CSRF: Amazon's request
 * signature is the authentication of the *caller*, and the bearer token inside
 * the request identifies the *user*. Anything that fails verification gets a
 * bare 400, as Amazon's certification rules require.
 */
@Controller('alexa/skill')
@UseGuards(AlexaEnabledGuard)
export class AlexaSkillController {
  private readonly logger = new Logger(AlexaSkillController.name);

  constructor(
    private readonly verifier: AlexaRequestVerifier,
    private readonly skillService: AlexaSkillService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(@Req() req: RawBodyRequest<Request>): Promise<AlexaResponseEnvelope> {
    const envelope: unknown = req.body;
    // The signature covers the exact bytes Amazon sent, so it is checked on the
    // raw body (`rawBody: true` in main.ts), never on re-serialized JSON.
    if (!req.rawBody || !isAlexaRequestEnvelope(envelope)) {
      throw new BadRequestException();
    }

    try {
      await this.verifier.verify(req.headers, req.rawBody, envelope);
    } catch (error) {
      if (error instanceof AlexaVerificationError) {
        this.logger.warn(`Rejected Alexa request: ${error.message}`);
        throw new BadRequestException();
      }
      throw error;
    }

    return this.skillService.handle(envelope);
  }
}
