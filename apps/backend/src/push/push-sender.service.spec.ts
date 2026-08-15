import type { BatchResponse, Messaging } from 'firebase-admin/messaging';
import { PrismaService } from '../prisma/prisma.service';
import { PushSenderService } from './push-sender.service';

function batchResponse(results: Array<{ success: boolean; errorCode?: string }>): BatchResponse {
  return {
    successCount: results.filter((r) => r.success).length,
    failureCount: results.filter((r) => !r.success).length,
    responses: results.map((r) =>
      r.success
        ? { success: true, messageId: 'msg-id' }
        : { success: false, error: { code: r.errorCode ?? 'messaging/unknown' } },
    ),
  } as unknown as BatchResponse;
}

describe('PushSenderService', () => {
  let messaging: { sendEachForMulticast: jest.Mock };
  let prisma: { pushSubscription: { deleteMany: jest.Mock } };

  function makeService(messagingArg: Messaging | null): PushSenderService {
    return new PushSenderService(messagingArg, prisma as unknown as PrismaService);
  }

  beforeEach(() => {
    messaging = { sendEachForMulticast: jest.fn() };
    prisma = { pushSubscription: { deleteMany: jest.fn() } };
  });

  it('does nothing when there are no tokens', async () => {
    const service = makeService(messaging as unknown as Messaging);

    await service.sendToTokens([], { title: 't', body: 'b' });

    expect(messaging.sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('no-ops (does not throw) when push is not configured', async () => {
    const service = makeService(null);

    await expect(service.sendToTokens(['tok'], { title: 't', body: 'b' })).resolves.toBeUndefined();
    expect(prisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it('sends a multicast message with notification and optional data', async () => {
    messaging.sendEachForMulticast.mockResolvedValue(batchResponse([{ success: true }]));
    const service = makeService(messaging as unknown as Messaging);

    await service.sendToTokens(['tok-1'], {
      title: 'Title',
      body: 'Body',
      data: { type: 'FEEDING_REMINDER' },
    });

    expect(messaging.sendEachForMulticast).toHaveBeenCalledWith({
      tokens: ['tok-1'],
      notification: { title: 'Title', body: 'Body' },
      data: { type: 'FEEDING_REMINDER' },
    });
    expect(prisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it('prunes only the tokens FCM reports as unregistered, position-matched', async () => {
    messaging.sendEachForMulticast.mockResolvedValue(
      batchResponse([
        { success: true },
        { success: false, errorCode: 'messaging/registration-token-not-registered' },
        { success: false, errorCode: 'messaging/internal-error' },
      ]),
    );
    const service = makeService(messaging as unknown as Messaging);

    await service.sendToTokens(['good', 'stale', 'transient'], { title: 't', body: 'b' });

    // Only the unregistered token is deleted — not the transient-error one.
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['stale'] } },
    });
  });

  it('does not call deleteMany when all sends succeed', async () => {
    messaging.sendEachForMulticast.mockResolvedValue(
      batchResponse([{ success: true }, { success: true }]),
    );
    const service = makeService(messaging as unknown as Messaging);

    await service.sendToTokens(['a', 'b'], { title: 't', body: 'b' });

    expect(prisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });
});
