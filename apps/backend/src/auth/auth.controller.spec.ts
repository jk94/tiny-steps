import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  AuthController,
  REFRESH_TOKEN_COOKIE_NAME,
} from './auth.controller';
import { AuthResult, AuthService } from './auth.service';
import { CSRF_COOKIE_NAME } from './guards/csrf.guard';
import { AuthenticatedUser } from './types/authenticated-request';

const buildAuthResult = (): AuthResult => ({
  user: {
    id: 'user-1',
    email: 'parent@example.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  tokens: { accessToken: 'access-token-value', refreshToken: 'refresh-token-value' },
});

describe('AuthController', () => {
  let authService: jest.Mocked<Pick<AuthService, 'register' | 'login' | 'refresh' | 'logout'>>;
  let controller: AuthController;
  let res: jest.Mocked<Pick<Response, 'cookie' | 'clearCookie'>>;

  beforeEach(() => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
    };
    controller = new AuthController(authService as unknown as AuthService);
    res = {
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
    };
  });

  describe('register', () => {
    it('registers, sets access/refresh/csrf cookies, and returns the sanitized user', async () => {
      const result = buildAuthResult();
      authService.register.mockResolvedValue(result);

      const response = await controller.register(
        { email: 'parent@example.com', password: 'super-secret-1' },
        res as unknown as Response,
      );

      expect(authService.register).toHaveBeenCalledWith({
        email: 'parent@example.com',
        password: 'super-secret-1',
      });
      expect(response).toEqual({ user: result.user });

      expect(res.cookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE_NAME,
        'access-token-value',
        expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/api' }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE_NAME,
        'refresh-token-value',
        expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/api/auth' }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        CSRF_COOKIE_NAME,
        expect.any(String),
        expect.objectContaining({ httpOnly: false, sameSite: 'lax', path: '/api' }),
      );
    });
  });

  describe('login', () => {
    it('logs in and sets the same cookies as register', async () => {
      const result = buildAuthResult();
      authService.login.mockResolvedValue(result);

      const response = await controller.login(
        { email: 'parent@example.com', password: 'super-secret-1' },
        res as unknown as Response,
      );

      expect(authService.login).toHaveBeenCalledWith({
        email: 'parent@example.com',
        password: 'super-secret-1',
      });
      expect(response).toEqual({ user: result.user });
      expect(res.cookie).toHaveBeenCalledTimes(3);
    });
  });

  describe('refresh', () => {
    const buildRequest = (cookies: Record<string, string>): Request =>
      ({ cookies }) as unknown as Request;

    it('rotates cookies on a valid refresh_token cookie', async () => {
      const result = buildAuthResult();
      authService.refresh.mockResolvedValue(result);

      const response = await controller.refresh(
        buildRequest({ [REFRESH_TOKEN_COOKIE_NAME]: 'old-refresh-token' }),
        res as unknown as Response,
      );

      expect(authService.refresh).toHaveBeenCalledWith('old-refresh-token');
      expect(response).toEqual({ user: result.user });
      expect(res.cookie).toHaveBeenCalledTimes(3);
    });

    it('clears cookies and rejects when no refresh_token cookie is present', async () => {
      await expect(
        controller.refresh(buildRequest({}), res as unknown as Response),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(res.clearCookie).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE_NAME, expect.anything());
      expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE_NAME, expect.anything());
      expect(res.clearCookie).toHaveBeenCalledWith(CSRF_COOKIE_NAME, expect.anything());
      expect(authService.refresh).not.toHaveBeenCalled();
    });

    it('clears cookies and rethrows when AuthService.refresh() rejects (e.g. reused/expired token)', async () => {
      const error = new UnauthorizedException('Invalid refresh token');
      authService.refresh.mockRejectedValue(error);

      await expect(
        controller.refresh(
          buildRequest({ [REFRESH_TOKEN_COOKIE_NAME]: 'reused-token' }),
          res as unknown as Response,
        ),
      ).rejects.toBe(error);

      expect(res.clearCookie).toHaveBeenCalledTimes(3);
    });
  });

  describe('logout', () => {
    const buildRequest = (cookies: Record<string, string>): Request =>
      ({ cookies }) as unknown as Request;

    it('revokes the session and clears all cookies', async () => {
      await controller.logout(
        buildRequest({ [REFRESH_TOKEN_COOKIE_NAME]: 'refresh-token-value' }),
        res as unknown as Response,
      );

      expect(authService.logout).toHaveBeenCalledWith('refresh-token-value');
      expect(res.clearCookie).toHaveBeenCalledTimes(3);
    });

    it('still clears cookies even without a refresh_token cookie present', async () => {
      await controller.logout(buildRequest({}), res as unknown as Response);

      expect(authService.logout).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledTimes(3);
    });
  });

  describe('me', () => {
    it('returns the currently authenticated user as-is', () => {
      const user: AuthenticatedUser = {
        id: 'user-1',
        email: 'parent@example.com',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      };

      expect(controller.me(user)).toBe(user);
    });
  });
});
