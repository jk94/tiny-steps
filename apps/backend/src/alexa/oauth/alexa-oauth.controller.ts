import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CsrfGuard } from '../../auth/guards/csrf.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-request';
import { AlexaEnabledGuard } from '../alexa-enabled.guard';
import { OAuthTokenError } from './alexa-oauth.errors';
import { AlexaOAuthService, ConsentChildView } from './alexa-oauth.service';
import {
  AuthorizationDecisionDto,
  AuthorizationRequestQueryDto,
  toAuthorizationRequestParams,
} from './dto/authorization-request.dto';

/**
 * OAuth 2.0 endpoints for Alexa account linking (ALX-7, ADR-0017).
 *
 * The *authorization endpoint* Amazon opens is the SPA route `/alexa/link`
 * (a normal protected page, so local and OIDC login both work there); these
 * two `authorize` routes are what that page calls. The *token endpoint* is
 * called by Amazon's servers directly.
 */
@Controller('alexa/oauth')
@UseGuards(AlexaEnabledGuard)
export class AlexaOAuthController {
  private readonly logger = new Logger(AlexaOAuthController.name);

  constructor(private readonly oauthService: AlexaOAuthService) {}

  @UseGuards(JwtAuthGuard)
  @Get('authorize')
  describe(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AuthorizationRequestQueryDto,
  ): Promise<{ children: ConsentChildView[] }> {
    return this.oauthService.describeAuthorizationRequest(
      user.id,
      toAuthorizationRequestParams(query),
    );
  }

  // Cookie-authenticated and state-changing, hence CSRF-protected like every
  // other mutating SPA route.
  @UseGuards(JwtAuthGuard, CsrfGuard)
  @HttpCode(HttpStatus.OK)
  @Post('authorize')
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AuthorizationDecisionDto,
  ): Promise<{ redirectTo: string }> | { redirectTo: string } {
    const params = toAuthorizationRequestParams(dto);
    return dto.approve
      ? this.oauthService.approve(user.id, params, dto.default_child_id ?? null)
      : this.oauthService.deny(params);
  }

  /**
   * RFC 6749 section 3.2. Hand-serialized rather than DTO-validated: the body
   * is `application/x-www-form-urlencoded`, and both success and error bodies
   * must follow the RFC's exact shape (section 5.1/5.2), which Nest's
   * exception filter would not produce.
   */
  @Post('token')
  async token(@Req() req: Request, @Res() res: Response): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');

    try {
      const body = readFormBody(req.body);
      this.oauthService.authenticateClient(
        req.headers.authorization,
        body.client_id,
        body.client_secret,
      );

      let result;
      switch (body.grant_type) {
        case 'authorization_code':
          result = await this.oauthService.exchangeAuthorizationCode({
            code: body.code,
            redirectUri: body.redirect_uri,
            codeVerifier: body.code_verifier,
          });
          break;
        case 'refresh_token':
          result = await this.oauthService.refresh(body.refresh_token);
          break;
        case undefined:
          throw new OAuthTokenError('invalid_request', 'grant_type is required');
        default:
          throw new OAuthTokenError('unsupported_grant_type');
      }
      res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (!(error instanceof OAuthTokenError)) {
        throw error;
      }
      if (error.code !== 'invalid_client') {
        this.logger.warn(`Alexa token request rejected: ${error.code}`);
      }
      if (error.status === HttpStatus.UNAUTHORIZED) {
        res.setHeader('WWW-Authenticate', 'Basic realm="alexa"');
      }
      res.status(error.status).json({
        error: error.code,
        ...(error.description ? { error_description: error.description } : {}),
      });
    }
  }
}

const TOKEN_PARAMS = [
  'grant_type',
  'code',
  'redirect_uri',
  'code_verifier',
  'refresh_token',
  'client_id',
  'client_secret',
] as const;

type TokenParams = Partial<Record<(typeof TOKEN_PARAMS)[number], string>>;

/**
 * Picks the known token parameters out of the parsed form body. A repeated
 * parameter (parsed into an array) is rejected per RFC 6749 section 3.2.
 */
function readFormBody(body: unknown): TokenParams {
  if (body === null || typeof body !== 'object') {
    throw new OAuthTokenError('invalid_request', 'Expected a form-encoded body');
  }
  const record = body as Record<string, unknown>;
  const params: TokenParams = {};
  for (const name of TOKEN_PARAMS) {
    const value = record[name];
    if (value === undefined || value === '') {
      continue;
    }
    if (typeof value !== 'string') {
      throw new OAuthTokenError('invalid_request', `Parameter ${name} must appear once`);
    }
    params[name] = value;
  }
  return params;
}
