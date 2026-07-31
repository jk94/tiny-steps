import { NotFoundException } from '@nestjs/common';
import { HouseholdAccessService } from './household-access.service';
import { HouseholdRole } from './household-role.enum';
import { PrismaService } from '../prisma/prisma.service';

describe('HouseholdAccessService', () => {
  let prisma: { membership: { findUnique: jest.Mock } };
  let service: HouseholdAccessService;

  beforeEach(() => {
    prisma = { membership: { findUnique: jest.fn() } };
    service = new HouseholdAccessService(prisma as unknown as PrismaService);
  });

  it('returns the membership with household included when found', async () => {
    const membership = {
      id: 'membership-1',
      userId: 'user-1',
      householdId: 'household-1',
      role: HouseholdRole.OWNER,
      createdAt: new Date(),
      household: { id: 'household-1', name: 'Test Household', createdAt: new Date() },
    };
    prisma.membership.findUnique.mockResolvedValue(membership);

    const result = await service.findMembershipOrThrow('user-1', 'household-1');

    expect(result).toBe(membership);
    expect(prisma.membership.findUnique).toHaveBeenCalledWith({
      where: { userId_householdId: { userId: 'user-1', householdId: 'household-1' } },
      include: { household: true },
    });
  });

  it('throws NotFoundException when no membership row exists', async () => {
    prisma.membership.findUnique.mockResolvedValue(null);

    await expect(service.findMembershipOrThrow('user-1', 'household-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
