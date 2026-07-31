import { NotFoundException } from '@nestjs/common';
import { HouseholdRole } from './household-role.enum';
import { hashInviteToken } from './invite-token.util';
import { INVITE_TOKEN_TTL_MS, InviteService } from './invite.service';
import { PrismaService } from '../prisma/prisma.service';

describe('InviteService', () => {
  let prisma: {
    invite: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: InviteService;

  const household = { id: 'household-1', name: 'Our Home' };

  const buildInviteRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'invite-1',
    tokenHash: 'irrelevant-for-these-fixtures',
    householdId: household.id,
    createdByUserId: 'owner-1',
    role: HouseholdRole.CO_PARENT,
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    acceptedAt: null,
    acceptedByUserId: null,
    createdAt: new Date(),
    household,
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      invite: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(),
    };
    service = new InviteService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('hashes the token before persisting and never stores the raw value', async () => {
      prisma.invite.create.mockResolvedValue({});

      const result = await service.create('owner-1', household.id);

      const createCall = prisma.invite.create.mock.calls[0][0];
      expect(createCall.data.tokenHash).not.toBe(result.token);
      expect(createCall.data.tokenHash).toBe(hashInviteToken(result.token));
      expect(createCall.data.role).toBe(HouseholdRole.CO_PARENT);
      expect(createCall.data.householdId).toBe(household.id);
      expect(createCall.data.createdByUserId).toBe('owner-1');
    });

    it('sets expiresAt to roughly now + 7 days', async () => {
      prisma.invite.create.mockResolvedValue({});
      const before = Date.now();

      const result = await service.create('owner-1', household.id);

      const after = Date.now();
      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + INVITE_TOKEN_TTL_MS);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + INVITE_TOKEN_TTL_MS);
    });
  });

  describe('preview', () => {
    it('returns invalid when no matching invite exists', async () => {
      prisma.invite.findUnique.mockResolvedValue(null);

      await expect(service.preview('garbage-token')).resolves.toEqual({ status: 'invalid' });
    });

    it('returns expired when expiresAt is in the past', async () => {
      prisma.invite.findUnique.mockResolvedValue(
        buildInviteRow({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.preview('token')).resolves.toEqual({ status: 'expired' });
    });

    it('returns used when acceptedAt is set', async () => {
      prisma.invite.findUnique.mockResolvedValue(buildInviteRow({ acceptedAt: new Date() }));

      await expect(service.preview('token')).resolves.toEqual({ status: 'used' });
    });

    it('returns revoked when revokedAt is set', async () => {
      prisma.invite.findUnique.mockResolvedValue(buildInviteRow({ revokedAt: new Date() }));

      await expect(service.preview('token')).resolves.toEqual({ status: 'revoked' });
    });

    it('returns valid with household name and expiry for a fresh invite', async () => {
      const row = buildInviteRow();
      prisma.invite.findUnique.mockResolvedValue(row);

      await expect(service.preview('token')).resolves.toEqual({
        status: 'valid',
        householdName: household.name,
        expiresAt: row.expiresAt,
      });
    });
  });

  describe('accept', () => {
    const setupTransaction = (existingMembership: unknown) => {
      const tx = {
        membership: {
          findUnique: jest.fn().mockResolvedValue(existingMembership),
          create: jest.fn(),
        },
        invite: { update: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => {
        return callback(tx);
      });
      return tx;
    };

    it('creates a Membership and stamps the invite as accepted on the happy path', async () => {
      const row = buildInviteRow();
      prisma.invite.findUnique.mockResolvedValue(row);
      const tx = setupTransaction(null);

      const result = await service.accept('token', 'user-2');

      expect(tx.membership.create).toHaveBeenCalledWith({
        data: { userId: 'user-2', householdId: household.id, role: HouseholdRole.CO_PARENT },
      });
      expect(tx.invite.update).toHaveBeenCalledWith({
        where: { id: row.id },
        data: { acceptedAt: expect.any(Date), acceptedByUserId: 'user-2' },
      });
      expect(result).toEqual({ household, role: HouseholdRole.CO_PARENT });
    });

    it('does not create a duplicate Membership when one already exists (idempotent), but still consumes the invite', async () => {
      const row = buildInviteRow();
      prisma.invite.findUnique.mockResolvedValue(row);
      const existingMembership = { id: 'membership-existing' };
      const tx = setupTransaction(existingMembership);

      const result = await service.accept('token', 'user-2');

      expect(tx.membership.create).not.toHaveBeenCalled();
      expect(tx.invite.update).toHaveBeenCalledWith({
        where: { id: row.id },
        data: { acceptedAt: expect.any(Date), acceptedByUserId: 'user-2' },
      });
      expect(result).toEqual({ household, role: HouseholdRole.CO_PARENT });
    });

    it.each([
      ['a nonexistent token', null],
      ['an expired invite', buildInviteRow({ expiresAt: new Date(Date.now() - 1000) })],
      ['a revoked invite', buildInviteRow({ revokedAt: new Date() })],
      ['an already-used invite', buildInviteRow({ acceptedAt: new Date() })],
    ])('throws NotFoundException (not a more specific type) for %s', async (_label, row) => {
      prisma.invite.findUnique.mockResolvedValue(row);

      await expect(service.accept('token', 'user-2')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
