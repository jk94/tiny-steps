import { NotFoundException } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type { AccessTokenVerifierService } from '../auth/access-token-verifier.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import type { HouseholdAccessService } from '../household/household-access.service';
import { AuthenticatedSocket, RealtimeGateway } from './realtime.gateway';
import type { RealtimeService } from './realtime.service';

// `cookie` is a pure-ESM package (no CommonJS build), which this project's
// CommonJS unit-test runner can't `require()` directly — same reason every
// spec that transitively imports the also-ESM-only `openid-client` mocks it
// (see e.g. `oidc-provider-registry.service.spec.ts`). This mock keeps
// `parseCookie`'s real multi-cookie-header-splitting behavior so
// `handleConnection`'s parsing logic is still meaningfully exercised below.
jest.mock('cookie', () => ({
  parseCookie: (header: string): Record<string, string> =>
    Object.fromEntries(
      header.split(';').map((pair) => {
        const [key, ...rest] = pair.trim().split('=');
        return [key, rest.join('=')];
      }),
    ),
}));

const USER: AuthenticatedUser = {
  id: 'user-1',
  email: 'parent@example.com',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

function makeSocket(cookieHeader: string | undefined): Socket {
  return {
    id: 'socket-1',
    handshake: { headers: { cookie: cookieHeader } },
    data: {},
    disconnect: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
  } as unknown as Socket;
}

describe('RealtimeGateway', () => {
  let accessTokenVerifier: { verify: jest.Mock };
  let householdAccessService: { findMembershipOrThrow: jest.Mock };
  let realtimeService: { setServer: jest.Mock };
  let gateway: RealtimeGateway;

  beforeEach(() => {
    accessTokenVerifier = { verify: jest.fn() };
    householdAccessService = { findMembershipOrThrow: jest.fn() };
    realtimeService = { setServer: jest.fn() };
    gateway = new RealtimeGateway(
      accessTokenVerifier as unknown as AccessTokenVerifierService,
      householdAccessService as unknown as HouseholdAccessService,
      realtimeService as unknown as RealtimeService,
    );
  });

  describe('handleConnection', () => {
    it('disconnects a socket with no cookie header at all', async () => {
      const socket = makeSocket(undefined);

      await gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(accessTokenVerifier.verify).not.toHaveBeenCalled();
    });

    it('disconnects a socket whose cookie header has no access_token cookie', async () => {
      const socket = makeSocket('other_cookie=value');

      await gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(accessTokenVerifier.verify).not.toHaveBeenCalled();
    });

    it('disconnects a socket whose access_token cookie fails verification', async () => {
      const socket = makeSocket('access_token=bad-token');
      accessTokenVerifier.verify.mockRejectedValue(new Error('invalid'));

      await gateway.handleConnection(socket);

      expect(accessTokenVerifier.verify).toHaveBeenCalledWith('bad-token');
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('authenticates and stashes the resolved user on socket.data, without disconnecting', async () => {
      const socket = makeSocket('access_token=good-token');
      accessTokenVerifier.verify.mockResolvedValue(USER);

      await gateway.handleConnection(socket);

      expect(accessTokenVerifier.verify).toHaveBeenCalledWith('good-token');
      expect((socket as AuthenticatedSocket).data.user).toBe(USER);
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('extracts access_token correctly alongside other cookies', async () => {
      const socket = makeSocket('csrf_token=abc; access_token=good-token; other=1');
      accessTokenVerifier.verify.mockResolvedValue(USER);

      await gateway.handleConnection(socket);

      expect(accessTokenVerifier.verify).toHaveBeenCalledWith('good-token');
      expect(socket.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('handleJoinHousehold', () => {
    it('joins the household room when the user is a member', async () => {
      const socket = makeSocket(undefined);
      (socket as AuthenticatedSocket).data.user = USER;
      householdAccessService.findMembershipOrThrow.mockResolvedValue({
        id: 'membership-1',
      });

      await gateway.handleJoinHousehold(socket as AuthenticatedSocket, {
        householdId: 'household-1',
      });

      expect(householdAccessService.findMembershipOrThrow).toHaveBeenCalledWith(
        USER.id,
        'household-1',
      );
      expect(socket.join).toHaveBeenCalledWith('household:household-1');
    });

    it('does not join the room when the user is not a member', async () => {
      const socket = makeSocket(undefined);
      (socket as AuthenticatedSocket).data.user = USER;
      householdAccessService.findMembershipOrThrow.mockRejectedValue(new NotFoundException());

      await gateway.handleJoinHousehold(socket as AuthenticatedSocket, {
        householdId: 'household-1',
      });

      expect(socket.join).not.toHaveBeenCalled();
    });

    it('no-ops when householdId is missing from the message', async () => {
      const socket = makeSocket(undefined);
      (socket as AuthenticatedSocket).data.user = USER;

      await gateway.handleJoinHousehold(
        socket as AuthenticatedSocket,
        {} as { householdId: string },
      );

      expect(householdAccessService.findMembershipOrThrow).not.toHaveBeenCalled();
      expect(socket.join).not.toHaveBeenCalled();
    });
  });

  describe('handleLeaveHousehold', () => {
    it('leaves the household room when the user is a member', async () => {
      const socket = makeSocket(undefined);
      (socket as AuthenticatedSocket).data.user = USER;
      householdAccessService.findMembershipOrThrow.mockResolvedValue({
        id: 'membership-1',
      });

      await gateway.handleLeaveHousehold(socket as AuthenticatedSocket, {
        householdId: 'household-1',
      });

      expect(socket.leave).toHaveBeenCalledWith('household:household-1');
    });

    it('does not leave the room when the user is not a member', async () => {
      const socket = makeSocket(undefined);
      (socket as AuthenticatedSocket).data.user = USER;
      householdAccessService.findMembershipOrThrow.mockRejectedValue(new NotFoundException());

      await gateway.handleLeaveHousehold(socket as AuthenticatedSocket, {
        householdId: 'household-1',
      });

      expect(socket.leave).not.toHaveBeenCalled();
    });
  });

  describe('afterInit', () => {
    it('hands the Socket.IO server off to RealtimeService', () => {
      const server = { to: jest.fn() };

      gateway.afterInit(server as never);

      expect(realtimeService.setServer).toHaveBeenCalledWith(server);
    });
  });
});
