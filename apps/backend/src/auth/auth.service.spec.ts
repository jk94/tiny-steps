import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

const JWT_SECRETS = { accessSecret: 'access-secret', refreshSecret: 'refresh-secret' };

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'parent@example.com',
  name: 'Bernd',
  passwordHash: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('AuthService', () => {
  let prisma: {
    user: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let jwtService: JwtService;
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    jwtService = new JwtService({});
    service = new AuthService(prisma as unknown as PrismaService, jwtService, JWT_SECRETS);

    prisma.refreshToken.create.mockResolvedValue({
      id: 'refresh-row-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 1000 * 60),
      revokedAt: null,
      createdAt: new Date(),
    });
    // Default: the atomic rotation update in `refresh()` successfully
    // consumes exactly one (still-unrevoked) row. Individual tests override
    // this to simulate the race/reuse case (count: 0).
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
  });

  describe('register', () => {
    it('hashes the password and creates the user, returning a token pair', async () => {
      prisma.user.create.mockResolvedValue(buildUser());

      const result = await service.register({
        email: 'parent@example.com',
        password: 'super-secret-1',
        name: 'Bernd',
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { email: 'parent@example.com', name: 'Bernd', passwordHash: expect.any(String) },
      });
      const createdPasswordHash = prisma.user.create.mock.calls[0][0].data.passwordHash;
      expect(await argon2.verify(createdPasswordHash, 'super-secret-1')).toBe(true);

      expect(result.user).toEqual({
        id: 'user-1',
        email: 'parent@example.com',
        name: 'Bernd',
        createdAt: buildUser().createdAt,
      });
      expect(result.tokens.accessToken).toEqual(expect.any(String));
      expect(result.tokens.refreshToken).toEqual(expect.any(String));
    });

    it('throws ConflictException on a duplicate email', async () => {
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`email`)',
          {
            code: 'P2002',
            clientVersion: '7.9.1',
          },
        ),
      );

      await expect(
        service.register({
          email: 'parent@example.com',
          password: 'super-secret-1',
          name: 'Bernd',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rethrows unrelated Prisma errors unchanged', async () => {
      const unrelatedError = new Error('connection lost');
      prisma.user.create.mockRejectedValue(unrelatedError);

      await expect(
        service.register({
          email: 'parent@example.com',
          password: 'super-secret-1',
          name: 'Bernd',
        }),
      ).rejects.toBe(unrelatedError);
    });
  });

  describe('login', () => {
    it('succeeds with correct credentials', async () => {
      const passwordHash = await argon2.hash('correct-password');
      prisma.user.findUnique.mockResolvedValue(buildUser({ passwordHash }));

      const result = await service.login({
        email: 'parent@example.com',
        password: 'correct-password',
      });

      expect(result.user.email).toBe('parent@example.com');
      expect(result.tokens.accessToken).toEqual(expect.any(String));
    });

    it('rejects an unknown email with the generic invalid-credentials message', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'whatever1' }),
      ).rejects.toMatchObject({
        message: 'Invalid email or password',
      });
    });

    it('rejects a wrong password with the same generic message as an unknown email', async () => {
      const passwordHash = await argon2.hash('correct-password');
      prisma.user.findUnique.mockResolvedValue(buildUser({ passwordHash }));

      await expect(
        service.login({ email: 'parent@example.com', password: 'wrong-password' }),
      ).rejects.toMatchObject({ message: 'Invalid email or password' });
    });

    it('rejects an OIDC-only user (no passwordHash) with the generic message', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ passwordHash: null }));

      await expect(
        service.login({ email: 'parent@example.com', password: 'whatever1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    const signRefreshToken = (payload: { sub: string; jti: string }) =>
      jwtService.signAsync(payload, { secret: JWT_SECRETS.refreshSecret, expiresIn: '7d' });

    it('rotates a valid refresh token: revokes the old row, issues a new pair', async () => {
      const token = await signRefreshToken({ sub: 'user-1', jti: 'refresh-row-1' });
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'refresh-row-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 1000 * 60),
        revokedAt: null,
        createdAt: new Date(),
      });
      prisma.user.findUnique.mockResolvedValue(buildUser());

      const result = await service.refresh(token);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'refresh-row-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result.tokens.refreshToken).toEqual(expect.any(String));
    });

    it('rejects an expired refresh token JWT', async () => {
      const token = await jwtService.signAsync(
        { sub: 'user-1', jti: 'refresh-row-1' },
        { secret: JWT_SECRETS.refreshSecret, expiresIn: -1 },
      );

      await expect(service.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when the RefreshToken row no longer exists', async () => {
      const token = await signRefreshToken({ sub: 'user-1', jti: 'missing-row' });
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when the RefreshToken row is already revoked and revokes all sessions for that user (reuse detection)', async () => {
      const token = await signRefreshToken({ sub: 'user-1', jti: 'refresh-row-1' });
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'refresh-row-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 1000 * 60),
        revokedAt: new Date(),
        createdAt: new Date(),
      });
      // The atomic rotation update's WHERE clause (`revokedAt: null`) won't
      // match an already-revoked row, so it consumes zero rows.
      prisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('treats a concurrent rotation race (atomic update consumes zero rows) as reuse and revokes all sessions', async () => {
      // Simulates two concurrent requests racing on the same still-valid
      // token: both pass the initial `findUnique` read, but only one atomic
      // `updateMany` can actually consume the row. This test represents the
      // loser of that race.
      const token = await signRefreshToken({ sub: 'user-1', jti: 'refresh-row-1' });
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'refresh-row-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 1000 * 60),
        revokedAt: null,
        createdAt: new Date(),
      });
      prisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'refresh-row-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects when the RefreshToken row has expired server-side', async () => {
      const token = await signRefreshToken({ sub: 'user-1', jti: 'refresh-row-1' });
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'refresh-row-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
        createdAt: new Date(),
      });

      await expect(service.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes the RefreshToken row identified by the token jti', async () => {
      const token = await jwtService.signAsync(
        { sub: 'user-1', jti: 'refresh-row-1' },
        { secret: JWT_SECRETS.refreshSecret, expiresIn: '7d' },
      );

      await service.logout(token);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'refresh-row-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('does nothing (no throw) for an invalid/malformed token', async () => {
      await expect(service.logout('not-a-valid-jwt')).resolves.toBeUndefined();
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('updateName', () => {
    it('persists the new name and returns the refreshed authenticated user', async () => {
      prisma.user.update.mockResolvedValue(buildUser({ name: 'Renamed' }));

      const result = await service.updateName('user-1', 'Renamed');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'Renamed' },
      });
      expect(result).toEqual({
        id: 'user-1',
        email: 'parent@example.com',
        name: 'Renamed',
        createdAt: buildUser().createdAt,
      });
    });

    it('never leaks the password hash of the updated user', async () => {
      prisma.user.update.mockResolvedValue(buildUser({ name: 'Renamed', passwordHash: 'secret' }));

      const result = await service.updateName('user-1', 'Renamed');

      expect(result).not.toHaveProperty('passwordHash');
    });
  });
});
