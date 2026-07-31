import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let prisma: { user: { findUnique: jest.Mock } };
  let strategy: JwtStrategy;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    strategy = new JwtStrategy(prisma as unknown as PrismaService, {
      accessSecret: 'a',
      refreshSecret: 'r',
    });
  });

  it('returns the sanitized user (no passwordHash) for a valid payload with an existing DB row', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'parent@example.com',
      passwordHash: 'should-not-leak',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await strategy.validate({ sub: 'user-1' });

    expect(result).toEqual({
      id: 'user-1',
      email: 'parent@example.com',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('rejects when the user no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(strategy.validate({ sub: 'deleted-user' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
