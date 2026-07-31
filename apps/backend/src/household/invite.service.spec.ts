import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    const setupTransaction = (
      existingMembership: unknown,
      updateManyResult: { count: number } = { count: 1 },
    ) => {
      const tx = {
        membership: {
          findUnique: jest.fn().mockResolvedValue(existingMembership),
          create: jest.fn(),
        },
        invite: { updateMany: jest.fn().mockResolvedValue(updateManyResult) },
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

      expect(tx.invite.updateMany).toHaveBeenCalledWith({
        where: {
          id: row.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gte: expect.any(Date) },
        },
        data: { acceptedAt: expect.any(Date), acceptedByUserId: 'user-2' },
      });
      expect(tx.membership.create).toHaveBeenCalledWith({
        data: { userId: 'user-2', householdId: household.id, role: HouseholdRole.CO_PARENT },
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
      expect(tx.invite.updateMany).toHaveBeenCalledWith({
        where: {
          id: row.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gte: expect.any(Date) },
        },
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

    it('throws NotFoundException when the atomic invite update finds no matching row and the user has no membership (consumed/invalidated concurrently)', async () => {
      const row = buildInviteRow();
      prisma.invite.findUnique.mockResolvedValue(row);
      setupTransaction(null, { count: 0 });

      await expect(service.accept('token', 'user-2')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns success without throwing when the atomic invite update finds no matching row but the user already has a Membership (same-user concurrent double-submit)', async () => {
      const row = buildInviteRow();
      prisma.invite.findUnique.mockResolvedValue(row);
      const existingMembership = { id: 'membership-existing' };
      const tx = setupTransaction(existingMembership, { count: 0 });

      const result = await service.accept('token', 'user-2');

      expect(tx.membership.create).not.toHaveBeenCalled();
      expect(result).toEqual({ household, role: HouseholdRole.CO_PARENT });
    });

    it('returns the existing Membership instead of throwing when creating it hits a unique-constraint race (P2002 backstop)', async () => {
      const row = buildInviteRow();
      prisma.invite.findUnique.mockResolvedValue(row);
      const tx = setupTransaction(null);
      tx.membership.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`userId`,`householdId`)',
          {
            code: 'P2002',
            clientVersion: '7.9.1',
          },
        ),
      );

      const result = await service.accept('token', 'user-2');

      expect(result).toEqual({ household, role: HouseholdRole.CO_PARENT });
    });

    it('rethrows unrelated errors from Membership creation unchanged', async () => {
      const row = buildInviteRow();
      prisma.invite.findUnique.mockResolvedValue(row);
      const tx = setupTransaction(null);
      const unrelatedError = new Error('connection lost');
      tx.membership.create.mockRejectedValue(unrelatedError);

      await expect(service.accept('token', 'user-2')).rejects.toThrow(unrelatedError);
    });
  });
});
