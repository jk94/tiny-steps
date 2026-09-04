import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { HouseholdRole } from './household-role.enum';
import { HouseholdService } from './household.service';
import { PrismaService } from '../prisma/prisma.service';

const HOUSEHOLD_ID = 'household-1';
const OWNER_ID = 'user-1';
const MEMBER_ID = 'user-2';
const JOINED_AT = new Date('2026-01-01T00:00:00.000Z');

function makeMembership(overrides: Record<string, unknown> = {}) {
  return {
    id: 'membership-2',
    userId: MEMBER_ID,
    householdId: HOUSEHOLD_ID,
    role: HouseholdRole.CO_PARENT as string,
    createdAt: JOINED_AT,
    user: { id: MEMBER_ID, email: 'co-parent@example.com', name: 'Co Parent' },
    ...overrides,
  };
}

/** The machine-readable `code` a structured error carries. */
function codeOf(error: unknown): string | undefined {
  const body = (error as ForbiddenException).getResponse();
  return typeof body === 'object' && body !== null ? (body as { code?: string }).code : undefined;
}

describe('HouseholdService', () => {
  let prisma: {
    household: { create: jest.Mock };
    membership: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
  };
  let service: HouseholdService;

  beforeEach(() => {
    prisma = {
      household: { create: jest.fn() },
      membership: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
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
    it('maps membership + user rows to name/email/role/joinedAt summaries (ROL-9)', async () => {
      prisma.membership.findMany.mockResolvedValue([
        makeMembership({
          id: 'membership-1',
          userId: OWNER_ID,
          role: HouseholdRole.OWNER,
          user: { id: OWNER_ID, email: 'owner@example.com', name: 'Owner' },
        }),
        makeMembership(),
      ]);

      const result = await service.listMembers(HOUSEHOLD_ID);

      expect(prisma.membership.findMany).toHaveBeenCalledWith({
        where: { householdId: HOUSEHOLD_ID },
        include: { user: true },
      });
      expect(result).toEqual([
        {
          userId: OWNER_ID,
          email: 'owner@example.com',
          name: 'Owner',
          role: HouseholdRole.OWNER,
          joinedAt: JOINED_AT,
        },
        {
          userId: MEMBER_ID,
          email: 'co-parent@example.com',
          name: 'Co Parent',
          role: HouseholdRole.CO_PARENT,
          joinedAt: JOINED_AT,
        },
      ]);
    });

    it('keeps a missing display name as null rather than inventing one', async () => {
      prisma.membership.findMany.mockResolvedValue([
        makeMembership({ user: { id: MEMBER_ID, email: 'co-parent@example.com', name: null } }),
      ]);

      const [member] = await service.listMembers(HOUSEHOLD_ID);

      expect(member.name).toBeNull();
    });

    it('returns an empty array for a household with no members', async () => {
      prisma.membership.findMany.mockResolvedValue([]);

      const result = await service.listMembers(HOUSEHOLD_ID);

      expect(result).toEqual([]);
    });
  });

  describe('changeMemberRole', () => {
    it('promotes a member and returns the updated summary', async () => {
      prisma.membership.findUnique.mockResolvedValue(makeMembership());
      prisma.membership.update.mockResolvedValue(makeMembership({ role: HouseholdRole.CAREGIVER }));

      const result = await service.changeMemberRole(
        HOUSEHOLD_ID,
        OWNER_ID,
        MEMBER_ID,
        HouseholdRole.CAREGIVER,
      );

      expect(prisma.membership.findUnique).toHaveBeenCalledWith({
        where: { userId_householdId: { userId: MEMBER_ID, householdId: HOUSEHOLD_ID } },
        include: { user: true },
      });
      expect(prisma.membership.update).toHaveBeenCalledWith({
        where: { id: 'membership-2' },
        data: { role: HouseholdRole.CAREGIVER },
        include: { user: true },
      });
      expect(result.role).toBe(HouseholdRole.CAREGIVER);
    });

    it('is a no-op when the member already holds the requested role', async () => {
      prisma.membership.findUnique.mockResolvedValue(makeMembership());

      const result = await service.changeMemberRole(
        HOUSEHOLD_ID,
        OWNER_ID,
        MEMBER_ID,
        HouseholdRole.CO_PARENT,
      );

      expect(prisma.membership.update).not.toHaveBeenCalled();
      expect(result.role).toBe(HouseholdRole.CO_PARENT);
    });

    it('refuses to change the caller’s own role (ROL-7)', async () => {
      const failure = service.changeMemberRole(
        HOUSEHOLD_ID,
        OWNER_ID,
        OWNER_ID,
        HouseholdRole.OBSERVER,
      );

      await expect(failure).rejects.toBeInstanceOf(ForbiddenException);
      await expect(failure.catch(codeOf)).resolves.toBe('CANNOT_CHANGE_OWN_ROLE');
      // Refused before the row is even read — nothing can have been written.
      expect(prisma.membership.findUnique).not.toHaveBeenCalled();
    });

    it('404s for a user who is not a member of this household', async () => {
      prisma.membership.findUnique.mockResolvedValue(null);

      await expect(
        service.changeMemberRole(HOUSEHOLD_ID, OWNER_ID, 'stranger', HouseholdRole.OBSERVER),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses to demote the last remaining owner (ROL-6)', async () => {
      prisma.membership.findUnique.mockResolvedValue(makeMembership({ role: HouseholdRole.OWNER }));
      prisma.membership.count.mockResolvedValue(1);

      const failure = service.changeMemberRole(
        HOUSEHOLD_ID,
        OWNER_ID,
        MEMBER_ID,
        HouseholdRole.CO_PARENT,
      );

      await expect(failure).rejects.toBeInstanceOf(ConflictException);
      await expect(failure.catch(codeOf)).resolves.toBe('LAST_OWNER_CANNOT_BE_DEMOTED');
      expect(prisma.membership.update).not.toHaveBeenCalled();
    });

    it('demotes an owner while another owner remains', async () => {
      prisma.membership.findUnique.mockResolvedValue(makeMembership({ role: HouseholdRole.OWNER }));
      prisma.membership.count.mockResolvedValue(2);
      prisma.membership.update.mockResolvedValue(makeMembership({ role: HouseholdRole.CO_PARENT }));

      await expect(
        service.changeMemberRole(HOUSEHOLD_ID, OWNER_ID, MEMBER_ID, HouseholdRole.CO_PARENT),
      ).resolves.toMatchObject({ role: HouseholdRole.CO_PARENT });
    });

    it('does not count owners when the target keeps the OWNER role', async () => {
      // Promoting a non-owner to OWNER can never reduce the owner count, so the
      // last-owner guard must not fire (nor cost a query).
      prisma.membership.findUnique.mockResolvedValue(makeMembership());
      prisma.membership.update.mockResolvedValue(makeMembership({ role: HouseholdRole.OWNER }));

      await service.changeMemberRole(HOUSEHOLD_ID, OWNER_ID, MEMBER_ID, HouseholdRole.OWNER);

      expect(prisma.membership.count).not.toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    it('deletes the membership row', async () => {
      prisma.membership.findUnique.mockResolvedValue(makeMembership());

      await service.removeMember(HOUSEHOLD_ID, OWNER_ID, MEMBER_ID);

      expect(prisma.membership.delete).toHaveBeenCalledWith({ where: { id: 'membership-2' } });
    });

    it('refuses self-removal', async () => {
      const failure = service.removeMember(HOUSEHOLD_ID, OWNER_ID, OWNER_ID);

      await expect(failure).rejects.toBeInstanceOf(ForbiddenException);
      await expect(failure.catch(codeOf)).resolves.toBe('CANNOT_REMOVE_SELF');
      expect(prisma.membership.delete).not.toHaveBeenCalled();
    });

    it('404s for a user who is not a member of this household', async () => {
      prisma.membership.findUnique.mockResolvedValue(null);

      await expect(service.removeMember(HOUSEHOLD_ID, OWNER_ID, 'stranger')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('refuses to remove the last remaining owner (ROL-6)', async () => {
      prisma.membership.findUnique.mockResolvedValue(makeMembership({ role: HouseholdRole.OWNER }));
      prisma.membership.count.mockResolvedValue(1);

      const failure = service.removeMember(HOUSEHOLD_ID, OWNER_ID, MEMBER_ID);

      await expect(failure).rejects.toBeInstanceOf(ConflictException);
      await expect(failure.catch(codeOf)).resolves.toBe('LAST_OWNER_CANNOT_BE_REMOVED');
      expect(prisma.membership.delete).not.toHaveBeenCalled();
    });

    it('removes an owner while another owner remains', async () => {
      prisma.membership.findUnique.mockResolvedValue(makeMembership({ role: HouseholdRole.OWNER }));
      prisma.membership.count.mockResolvedValue(2);

      await expect(
        service.removeMember(HOUSEHOLD_ID, OWNER_ID, MEMBER_ID),
      ).resolves.toBeUndefined();
      expect(prisma.membership.delete).toHaveBeenCalled();
    });
  });
});
