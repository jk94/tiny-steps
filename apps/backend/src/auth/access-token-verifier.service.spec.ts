import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AccessTokenVerifierService } from './access-token-verifier.service';

const JWT_SECRETS = { accessSecret: 'access-secret', refreshSecret: 'refresh-secret' };

describe('AccessTokenVerifierService', () => {
  let jwtService: JwtService;
  let prisma: { user: { findUnique: jest.Mock } };
  let service: AccessTokenVerifierService;

  beforeEach(() => {
    jwtService = new JwtService({});
    prisma = { user: { findUnique: jest.fn() } };
    service = new AccessTokenVerifierService(
      jwtService,
      prisma as unknown as PrismaService,
      JWT_SECRETS,
    );
  });

  it('resolves the sanitized user (no passwordHash) for a validly signed token with an existing DB row', async () => {
    const token = await jwtService.signAsync(
      { sub: 'user-1' },
      { secret: JWT_SECRETS.accessSecret },
    );
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'parent@example.com',
      passwordHash: 'should-not-leak',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await service.verify(token);

    expect(result).toEqual({
      id: 'user-1',
      email: 'parent@example.com',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
  });

  it('rejects a token signed with the wrong secret', async () => {
    const token = await jwtService.signAsync({ sub: 'user-1' }, { secret: 'wrong-secret' });

    await expect(service.verify(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an expired token', async () => {
    const token = await jwtService.signAsync(
      { sub: 'user-1' },
      { secret: JWT_SECRETS.accessSecret, expiresIn: -1 },
    );

    await expect(service.verify(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a malformed token', async () => {
    await expect(service.verify('not-a-jwt')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a token carrying a `purpose` claim (shaped like an oidc_txn token, not a real access token)', async () => {
    const token = await jwtService.signAsync(
      { sub: 'user-1', purpose: 'oidc_txn' },
      { secret: JWT_SECRETS.accessSecret },
    );

    await expect(service.verify(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a token without a string `sub`', async () => {
    const token = await jwtService.signAsync({}, { secret: JWT_SECRETS.accessSecret });

    await expect(service.verify(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects when the user no longer exists', async () => {
    const token = await jwtService.signAsync(
      { sub: 'deleted-user' },
      { secret: JWT_SECRETS.accessSecret },
    );
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.verify(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
