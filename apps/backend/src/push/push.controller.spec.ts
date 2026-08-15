import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { PushController } from './push.controller';
import { PushPlatform } from './push-platform.enum';
import { PushService } from './push.service';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'parent@example.com',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
};

describe('PushController', () => {
  let pushService: jest.Mocked<Pick<PushService, 'upsert' | 'remove'>>;
  let controller: PushController;

  beforeEach(() => {
    pushService = { upsert: jest.fn(), remove: jest.fn() };
    controller = new PushController(pushService as unknown as PushService);
  });

  it('delegates subscribe to PushService.upsert with the current user id and dto', async () => {
    const dto = { token: 'tok', platform: PushPlatform.IOS };

    await controller.subscribe(dto, user);

    expect(pushService.upsert).toHaveBeenCalledWith(user.id, dto);
  });

  it('delegates unsubscribe to PushService.remove with the current user id and token', async () => {
    await controller.unsubscribe('tok', user);

    expect(pushService.remove).toHaveBeenCalledWith(user.id, 'tok');
  });
});
