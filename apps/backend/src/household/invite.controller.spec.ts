import { InviteController } from './invite.controller';
import { HouseholdRole } from './household-role.enum';
import { InviteService } from './invite.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';

const currentUser: AuthenticatedUser = {
  id: 'user-2',
  email: 'invitee@example.com',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('InviteController', () => {
  let inviteService: jest.Mocked<Pick<InviteService, 'preview' | 'accept'>>;
  let controller: InviteController;

  beforeEach(() => {
    inviteService = { preview: jest.fn(), accept: jest.fn() };
    controller = new InviteController(inviteService as unknown as InviteService);
  });

  describe('preview', () => {
    it('delegates to InviteService.preview and returns its result as-is', async () => {
      const preview = {
        status: 'valid' as const,
        householdName: 'Our Home',
        expiresAt: new Date(),
      };
      inviteService.preview.mockResolvedValue(preview);

      const result = await controller.preview('some-token');

      expect(inviteService.preview).toHaveBeenCalledWith('some-token');
      expect(result).toBe(preview);
    });
  });

  describe('accept', () => {
    it('delegates to InviteService.accept using the current authenticated user', async () => {
      const accepted = {
        household: { id: 'household-1', name: 'Our Home' },
        role: HouseholdRole.CO_PARENT,
      };
      inviteService.accept.mockResolvedValue(accepted);

      const result = await controller.accept('some-token', currentUser);

      expect(inviteService.accept).toHaveBeenCalledWith('some-token', 'user-2');
      expect(result).toBe(accepted);
    });
  });
});
