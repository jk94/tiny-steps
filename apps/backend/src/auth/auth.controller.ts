import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthCookieService, REFRESH_TOKEN_COOKIE_NAME } from './auth-cookie.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateAuthMeDto } from './dto/update-auth-me.dto';
import { CsrfGuard } from './guards/csrf.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthEnabledGuard } from './guards/local-auth-enabled.guard';
import type { AuthenticatedRequest, AuthenticatedUser } from './types/authenticated-request';

export { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from './auth-cookie.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @UseGuards(LocalAuthEnabledGuard)
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthenticatedUser }> {
    const result = await this.authService.register(dto);
    this.authCookieService.setAuthCookies(res, result.tokens);
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
    this.authCookieService.setAuthCookies(res, result.tokens);
    return { user: result.user };
  }

  // Deliberately not behind JwtAuthGuard: the access token may already be
  // expired by the time a client calls this — that's the whole point of a
  // refresh endpoint. Only the (longer-lived) refresh_token cookie matters.
  // Still behind CsrfGuard: it's a state-changing, cookie-authenticated
  // route (matches `logout`'s CSRF protection).
  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthenticatedUser }> {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    if (!refreshToken) {
      this.authCookieService.clearAuthCookies(res);
      throw new UnauthorizedException('Invalid refresh token');
    }

    try {
      const result = await this.authService.refresh(refreshToken);
      this.authCookieService.setAuthCookies(res, result.tokens);
      return { user: result.user };
    } catch (error) {
      this.authCookieService.clearAuthCookies(res);
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
    this.authCookieService.clearAuthCookies(res);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  // Same guard combo as `logout`: state-changing and cookie-authenticated,
  // so it needs CSRF protection on top of the access-token check.
  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAuthMeDto,
  ): Promise<AuthenticatedUser> {
    return this.authService.updateName(user.id, dto.name);
  }
}
