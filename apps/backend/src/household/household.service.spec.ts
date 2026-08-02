import { HouseholdRole } from './household-role.enum';
import { HouseholdService } from './household.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HouseholdService', () => {
  let prisma: {
    household: { create: jest.Mock };
    membership: { findMany: jest.Mock };
  };
  let service: HouseholdService;

  beforeEach(() => {
    prisma = {
      household: { create: jest.fn() },
      membership: { findMany: jest.fn() },
    };
    service = new HouseholdService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('creates a household with a nested OWNER membership for the creating user', async () => {
      const household = {
        id: 'household-1',
        name: 'Our Home',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      prisma.household.create.mockResolvedValue(household);

      const result = await service.create('user-1', { name: 'Our Home' });

      expect(result).toBe(household);
      expect(prisma.household.create).toHaveBeenCalledWith({
        data: {
          name: 'Our Home',
          memberships: { create: { userId: 'user-1', role: HouseholdRole.OWNER } },
        },
      });
    });
  });

  describe('listForUser', () => {
    it('maps membership + household rows to household summaries with role', async () => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      prisma.membership.findMany.mockResolvedValue([
        {
          id: 'membership-1',
          userId: 'user-1',
          householdId: 'household-1',
          role: HouseholdRole.OWNER,
          household: { id: 'household-1', name: 'Our Home', createdAt },
        },
        {
          id: 'membership-2',
          userId: 'user-1',
          householdId: 'household-2',
          role: HouseholdRole.CO_PARENT,
          household: { id: 'household-2', name: 'Their Home', createdAt },
        },
      ]);

      const result = await service.listForUser('user-1');

      expect(prisma.membership.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: { household: true },
      });
      expect(result).toEqual([
        { id: 'household-1', name: 'Our Home', role: HouseholdRole.OWNER, createdAt },
        { id: 'household-2', name: 'Their Home', role: HouseholdRole.CO_PARENT, createdAt },
      ]);
    });
  });

  describe('listMembers', () => {
    it('maps membership + user rows to { userId, email } pairs', async () => {
      prisma.membership.findMany.mockResolvedValue([
        {
          id: 'membership-1',
          userId: 'user-1',
          householdId: 'household-1',
          role: HouseholdRole.OWNER,
          user: { id: 'user-1', email: 'owner@example.com' },
        },
        {
          id: 'membership-2',
          userId: 'user-2',
          householdId: 'household-1',
          role: HouseholdRole.CO_PARENT,
          user: { id: 'user-2', email: 'co-parent@example.com' },
        },
      ]);

      const result = await service.listMembers('household-1');

      expect(prisma.membership.findMany).toHaveBeenCalledWith({
        where: { householdId: 'household-1' },
        include: { user: true },
      });
      expect(result).toEqual([
        { userId: 'user-1', email: 'owner@example.com' },
        { userId: 'user-2', email: 'co-parent@example.com' },
      ]);
    });

    it('returns an empty array for a household with no members', async () => {
      prisma.membership.findMany.mockResolvedValue([]);

      const result = await service.listMembers('household-1');

      expect(result).toEqual([]);
    });
  });
});
