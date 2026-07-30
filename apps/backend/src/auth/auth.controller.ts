import { randomBytes } from 'crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_TTL_MS } from '../config/jwt.config';
import { AuthResult, AuthService, TokenPair } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CSRF_COOKIE_NAME, CsrfGuard } from './guards/csrf.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthEnabledGuard } from './guards/local-auth-enabled.guard';
import type { AuthenticatedRequest, AuthenticatedUser } from './types/authenticated-request';

export const ACCESS_TOKEN_COOKIE_NAME = 'access_token';
export const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';

/**
 * `secure` is env-conditional: local dev runs over plain HTTP, but any
 * non-development deployment (see README/docker-compose) should always be
 * behind HTTPS, so cookies must require it there.
 */
const isProduction = () => process.env.NODE_ENV === 'production';

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax', // not 'strict' — would break the OIDC redirect-callback flow (later sub-step)
  secure: isProduction(),
};

const accessTokenCookieOptions: CookieOptions = {
  ...baseCookieOptions,
  path: '/api',
  maxAge: ACCESS_TOKEN_TTL_MS,
};

// Scoped tighter than the access-token cookie: only sent to the auth routes
// that actually need it (refresh/logout), reducing exposure.
const refreshTokenCookieOptions: CookieOptions = {
  ...baseCookieOptions,
  path: '/api/auth',
  maxAge: REFRESH_TOKEN_TTL_MS,
};

// Non-httpOnly by design — the double-submit CSRF check requires
// client-side JS to be able to read this value and echo it back in the
// `X-CSRF-Token` header (see `CsrfGuard`).
const csrfCookieOptions: CookieOptions = {
  httpOnly: false,
  sameSite: 'lax',
  secure: isProduction(),
  path: '/api',
  maxAge: REFRESH_TOKEN_TTL_MS,
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthEnabledGuard)
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthenticatedUser }> {
    const result = await this.authService.register(dto);
    this.setAuthCookies(res, result);
    return { user: result.user };
  }

  @UseGuards(LocalAuthEnabledGuard)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthenticatedUser }> {
    const result = await this.authService.login(dto);
    this.setAuthCookies(res, result);
    return { user: result.user };
  }

  // Deliberately not behind JwtAuthGuard: the access token may already be
  // expired by the time a client calls this — that's the whole point of a
  // refresh endpoint. Only the (longer-lived) refresh_token cookie matters.
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthenticatedUser }> {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    if (!refreshToken) {
      this.clearAuthCookies(res);
      throw new UnauthorizedException('Invalid refresh token');
    }

    try {
      const result = await this.authService.refresh(refreshToken);
      this.setAuthCookies(res, result);
      return { user: result.user };
    } catch (error) {
      this.clearAuthCookies(res);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    this.clearAuthCookies(res);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  private setAuthCookies(res: Response, result: AuthResult): void {
    const csrfToken = randomBytes(32).toString('hex');
    this.setTokenCookies(res, result.tokens);
    res.cookie(CSRF_COOKIE_NAME, csrfToken, csrfCookieOptions);
  }

  private setTokenCookies(res: Response, tokens: TokenPair): void {
    res.cookie(ACCESS_TOKEN_COOKIE_NAME, tokens.accessToken, accessTokenCookieOptions);
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken, refreshTokenCookieOptions);
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, accessTokenCookieOptions);
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, refreshTokenCookieOptions);
    res.clearCookie(CSRF_COOKIE_NAME, csrfCookieOptions);
  }
}
