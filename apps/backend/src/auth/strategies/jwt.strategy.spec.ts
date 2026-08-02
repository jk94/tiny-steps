import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AccessTokenVerifierService } from '../access-token-verifier.service';
import type { AuthenticatedUser } from '../types/authenticated-request';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let accessTokenVerifier: { verify: jest.Mock };
  let strategy: JwtStrategy;

  beforeEach(() => {
    accessTokenVerifier = { verify: jest.fn() };
    strategy = new JwtStrategy(accessTokenVerifier as unknown as AccessTokenVerifierService, {
      accessSecret: 'a',
      refreshSecret: 'r',
    });
  });

  function requestWithCookie(token: string | undefined): Request {
    return { cookies: { access_token: token } } as unknown as Request;
  }

  it('delegates to AccessTokenVerifierService.verify() with the raw cookie token, returning its result', async () => {
    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'parent@example.com',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    accessTokenVerifier.verify.mockResolvedValue(user);

    const result = await strategy.validate(requestWithCookie('a-raw-access-token'));

    expect(accessTokenVerifier.verify).toHaveBeenCalledWith('a-raw-access-token');
    expect(result).toBe(user);
  });

  it('rejects with UnauthorizedException, without calling verify(), when the access_token cookie is missing', async () => {
    await expect(strategy.validate(requestWithCookie(undefined))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(accessTokenVerifier.verify).not.toHaveBeenCalled();
  });

  it('propagates rejection from AccessTokenVerifierService.verify()', async () => {
    accessTokenVerifier.verify.mockRejectedValue(new UnauthorizedException('Invalid access token'));

    await expect(strategy.validate(requestWithCookie('bad-token'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
