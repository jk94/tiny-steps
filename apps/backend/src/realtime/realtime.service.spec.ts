import type { Server } from 'socket.io';
import { EventType } from '../event/event-type.enum';
import { EVENT_CHANGED, EventChangePayload, RealtimeService } from './realtime.service';

function makeRemoteSocket(userId: string) {
  return {
    data: { user: { id: userId } },
    leave: jest.fn(),
  };
}

describe('RealtimeService', () => {
  let service: RealtimeService;

  beforeEach(() => {
    service = new RealtimeService();
  });

  describe('broadcastEventChange', () => {
    it('no-ops when the server has not been set yet', () => {
      const payload: EventChangePayload = {
        type: EventType.FEEDING,
        action: 'created',
        eventId: 'event-1',
        childId: 'child-1',
        householdId: 'household-1',
      };

      expect(() => service.broadcastEventChange('household-1', payload)).not.toThrow();
    });

    it('emits event:changed to the household room once the server is set', () => {
      const emit = jest.fn();
      const to = jest.fn().mockReturnValue({ emit });
      service.setServer({ to } as unknown as Server);

      const payload: EventChangePayload = {
        type: EventType.FEEDING,
        action: 'created',
        eventId: 'event-1',
        childId: 'child-1',
        householdId: 'household-1',
      };

      service.broadcastEventChange('household-1', payload);

      expect(to).toHaveBeenCalledWith('household:household-1');
      expect(emit).toHaveBeenCalledWith(EVENT_CHANGED, payload);
    });
  });

  describe('evictFromHousehold', () => {
    it('does not throw when the server has not been set yet', async () => {
      await expect(service.evictFromHousehold('user-1', 'household-1')).resolves.toBeUndefined();
    });

    it("leaves the room for the matching user's socket", async () => {
      const targetSocket = makeRemoteSocket('user-1');
      const fetchSockets = jest.fn().mockResolvedValue([targetSocket]);
      const inFn = jest.fn().mockReturnValue({ fetchSockets });
      service.setServer({ in: inFn } as unknown as Server);

      await service.evictFromHousehold('user-1', 'household-1');

      expect(inFn).toHaveBeenCalledWith('household:household-1');
      expect(targetSocket.leave).toHaveBeenCalledWith('household:household-1');
    });

    it("leaves other users' sockets in the same room untouched", async () => {
      const targetSocket = makeRemoteSocket('user-1');
      const otherSocket = makeRemoteSocket('user-2');
      const fetchSockets = jest.fn().mockResolvedValue([targetSocket, otherSocket]);
      const inFn = jest.fn().mockReturnValue({ fetchSockets });
      service.setServer({ in: inFn } as unknown as Server);

      await service.evictFromHousehold('user-1', 'household-1');

      expect(targetSocket.leave).toHaveBeenCalledWith('household:household-1');
      expect(otherSocket.leave).not.toHaveBeenCalled();
    });

    it('does nothing (and does not throw) when the user has no sockets in the room', async () => {
      const otherSocket = makeRemoteSocket('user-2');
      const fetchSockets = jest.fn().mockResolvedValue([otherSocket]);
      const inFn = jest.fn().mockReturnValue({ fetchSockets });
      service.setServer({ in: inFn } as unknown as Server);

      await expect(service.evictFromHousehold('user-1', 'household-1')).resolves.toBeUndefined();
      expect(otherSocket.leave).not.toHaveBeenCalled();
    });
  });
});
