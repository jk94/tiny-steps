import { HOUSEHOLD_ROLES_KEY } from './guards/require-role.decorator';
import { HouseholdController } from './household.controller';
import { OWNER_ROLES } from './household-permissions';
import { HouseholdRole } from './household-role.enum';
import { HouseholdService } from './household.service';
import { InviteService } from './invite.service';
import type { HouseholdScopedRequest } from './types/household-scoped-request';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';

const currentUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'parent@example.com',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const member = {
  userId: 'user-2',
  email: 'co-parent@example.com',
  name: 'Co Parent',
  role: HouseholdRole.CO_PARENT,
  joinedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('HouseholdController', () => {
  let householdService: jest.Mocked<
    Pick<
      HouseholdService,
      'create' | 'listForUser' | 'listMembers' | 'changeMemberRole' | 'removeMember'
    >
  >;
  let inviteService: jest.Mocked<Pick<InviteService, 'create'>>;
  let controller: HouseholdController;

  beforeEach(() => {
    householdService = {
      create: jest.fn(),
      listForUser: jest.fn(),
      listMembers: jest.fn(),
      changeMemberRole: jest.fn(),
      removeMember: jest.fn(),
    };
    inviteService = { create: jest.fn() };
    controller = new HouseholdController(
      householdService as unknown as HouseholdService,
      inviteService as unknown as InviteService,
    );
  });

  describe('create', () => {
    it('delegates to HouseholdService.create and returns it as OWNER', async () => {
      const household = {
        id: 'household-1',
        name: 'Our Home',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      householdService.create.mockResolvedValue(household as never);

      const result = await controller.create({ name: 'Our Home' }, currentUser);

      expect(householdService.create).toHaveBeenCalledWith('user-1', { name: 'Our Home' });
      expect(result).toEqual({
        id: household.id,
        name: household.name,
        role: HouseholdRole.OWNER,
        createdAt: household.createdAt,
      });
    });
  });

  describe('list', () => {
    it('delegates to HouseholdService.listForUser and returns its result as-is', async () => {
      const summaries = [
        {
          id: 'household-1',
          name: 'Our Home',
          role: HouseholdRole.OWNER,
          createdAt: new Date(),
        },
      ];
      householdService.listForUser.mockResolvedValue(summaries);

      const result = await controller.list(currentUser);

      expect(householdService.listForUser).toHaveBeenCalledWith('user-1');
      expect(result).toBe(summaries);
    });
  });

  describe('getOne', () => {
    it('reads the household straight off request.membership (no second query)', () => {
      const request = {
        membership: {
          id: 'membership-1',
          userId: 'user-1',
          householdId: 'household-1',
          role: HouseholdRole.CO_PARENT,
          createdAt: new Date(),
          household: {
            id: 'household-1',
            name: 'Our Home',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        },
      } as unknown as HouseholdScopedRequest;

      const result = controller.getOne(request);

      expect(result).toEqual({
        id: 'household-1',
        name: 'Our Home',
        role: HouseholdRole.CO_PARENT,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
    });
  });

  describe('listMembers', () => {
    it('delegates to HouseholdService.listMembers with the householdId param', async () => {
      const members = [member];
      householdService.listMembers.mockResolvedValue(members);

      const result = await controller.listMembers('household-1');

      expect(householdService.listMembers).toHaveBeenCalledWith('household-1');
      expect(result).toBe(members);
    });

    it('returns an empty array for a household with no members', async () => {
      householdService.listMembers.mockResolvedValue([]);

      const result = await controller.listMembers('household-1');

      expect(result).toEqual([]);
    });
  });

  describe('createInvite', () => {
    it('forwards the requested role to InviteService.create', async () => {
      const invite = { token: 'raw-token', expiresAt: new Date() };
      inviteService.create.mockResolvedValue(invite);

      const result = await controller.createInvite(
        'household-1',
        { role: HouseholdRole.CAREGIVER },
        currentUser,
      );

      expect(inviteService.create).toHaveBeenCalledWith(
        'user-1',
        'household-1',
        HouseholdRole.CAREGIVER,
      );
      expect(result).toBe(invite);
    });

    it('leaves the role undefined for a body-less invite, so the service default applies', async () => {
      inviteService.create.mockResolvedValue({ token: 'raw-token', expiresAt: new Date() });

      await controller.createInvite('household-1', {}, currentUser);

      expect(inviteService.create).toHaveBeenCalledWith('user-1', 'household-1', undefined);
    });
  });

  describe('member management', () => {
    it('changeMemberRole passes the acting user and the target user id', async () => {
      householdService.changeMemberRole.mockResolvedValue(member);

      const result = await controller.changeMemberRole(
        'household-1',
        'user-2',
        { role: HouseholdRole.CO_PARENT },
        currentUser,
      );

      expect(householdService.changeMemberRole).toHaveBeenCalledWith(
        'household-1',
        'user-1',
        'user-2',
        HouseholdRole.CO_PARENT,
      );
      expect(result).toBe(member);
    });

    it('removeMember passes the acting user and the target user id', async () => {
      householdService.removeMember.mockResolvedValue(undefined);

      await expect(
        controller.removeMember('household-1', 'user-2', currentUser),
      ).resolves.toBeUndefined();

      expect(householdService.removeMember).toHaveBeenCalledWith('household-1', 'user-1', 'user-2');
    });

    it.each(['createInvite', 'changeMemberRole', 'removeMember'] as const)(
      'restricts %s to OWNER',
      (methodName) => {
        expect(
          Reflect.getMetadata(HOUSEHOLD_ROLES_KEY, HouseholdController.prototype[methodName]),
        ).toEqual([...OWNER_ROLES]);
      },
    );

    it('answers DELETE .../members/:userId with 204 No Content', () => {
      expect(Reflect.getMetadata('__httpCode__', HouseholdController.prototype.removeMember)).toBe(
        204,
      );
    });

    it.each(['getOne', 'listMembers'] as const)(
      'leaves the read route %s open to any member',
      (methodName) => {
        expect(
          Reflect.getMetadata(HOUSEHOLD_ROLES_KEY, HouseholdController.prototype[methodName]),
        ).toBeUndefined();
      },
    );
  });
});
