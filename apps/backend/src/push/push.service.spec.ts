import { PrismaService } from '../prisma/prisma.service';
import { PushPlatform } from './push-platform.enum';
import { PushService } from './push.service';

const USER_ID = 'user-1';
const TOKEN = 'fcm-token-abc';

describe('PushService', () => {
  let prisma: { pushSubscription: { upsert: jest.Mock; deleteMany: jest.Mock } };
  let service: PushService;

  beforeEach(() => {
    prisma = {
      pushSubscription: { upsert: jest.fn(), deleteMany: jest.fn() },
    };
    service = new PushService(prisma as unknown as PrismaService);
  });

  it('upserts a subscription keyed by token, creating for a new device', async () => {
    prisma.pushSubscription.upsert.mockResolvedValue({ id: 'sub-1' });

    await service.upsert(USER_ID, { token: TOKEN, platform: PushPlatform.ANDROID });

    expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith({
      where: { token: TOKEN },
      create: { userId: USER_ID, token: TOKEN, platform: PushPlatform.ANDROID },
      update: { userId: USER_ID, platform: PushPlatform.ANDROID },
    });
  });

  it('rejects an unknown platform value via toPushPlatform', async () => {
    await expect(
      service.upsert(USER_ID, { token: TOKEN, platform: 'WINDOWS' as PushPlatform }),
    ).rejects.toThrow('Invalid PushPlatform');
    expect(prisma.pushSubscription.upsert).not.toHaveBeenCalled();
  });

  it('removes a subscription scoped to the calling user', async () => {
    prisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });

    await service.remove(USER_ID, TOKEN);

    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { token: TOKEN, userId: USER_ID },
    });
  });
});
