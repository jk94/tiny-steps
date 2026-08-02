import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { parseCookie } from 'cookie';
import type { Server, Socket } from 'socket.io';
import { AccessTokenVerifierService } from '../auth/access-token-verifier.service';
import { ACCESS_TOKEN_COOKIE_NAME } from '../auth/auth-cookie.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { HouseholdAccessService } from '../household/household-access.service';
import { householdRoom } from './household-room.util';
import { RealtimeService } from './realtime.service';

export interface AuthenticatedSocketData {
  user: AuthenticatedUser;
}

/** A `Socket` whose `data.user` has been populated by `handleConnection` below. */
export type AuthenticatedSocket = Socket & { data: AuthenticatedSocketData };

interface HouseholdRoomMessage {
  householdId: string;
}

/**
 * Real-time transport for household-scoped event-change notifications (see
 * `RealtimeService.broadcastEventChange`). Attached to the same HTTP server
 * Nest already listens on — default Socket.IO path (`/socket.io`) and
 * namespace (`/`), no `cors` option: this app never enables CORS (see
 * `main.ts`'s doc comment) since the SPA and API are always served from the
 * same origin, and that reasoning applies here unchanged.
 *
 * Household "rooms" are joined per-active-route via the `joinHousehold`/
 * `leaveHousehold` messages below, NOT all-at-once at connection time —
 * see `useHouseholdRoom` on the frontend, which is the sole caller.
 */
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayConnection, OnGatewayInit {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly accessTokenVerifier: AccessTokenVerifierService,
    private readonly householdAccessService: HouseholdAccessService,
    private readonly realtimeService: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.realtimeService.setServer(server);
  }

  /**
   * Authenticates the handshake off the httpOnly `access_token` cookie
   * alone — deliberately no CSRF check here. A cross-origin page has no way
   * to get a browser to attach this cookie to a socket handshake in the
   * first place: every auth cookie is `SameSite=Lax`, and (like every other
   * route in this app, see `main.ts`) this server never enables CORS, so
   * there's no cross-origin caller that could even reach this handshake
   * with the cookie attached. This mirrors the app's existing HTTP CSRF
   * mitigation stance, not an oversight.
   *
   * `socket.handshake.headers.cookie` is parsed manually with the `cookie`
   * package since no Express `cookie-parser` middleware runs for the WS
   * upgrade request (that middleware is only wired into the HTTP request
   * pipeline, see `main.ts`).
   */
  async handleConnection(socket: Socket): Promise<void> {
    const rawCookieHeader = socket.handshake.headers.cookie;
    const token = rawCookieHeader
      ? parseCookie(rawCookieHeader)[ACCESS_TOKEN_COOKIE_NAME]
      : undefined;

    if (!token) {
      this.logger.debug(`Rejecting socket ${socket.id}: no access_token cookie on handshake`);
      socket.disconnect(true);
      return;
    }

    try {
      const user = await this.accessTokenVerifier.verify(token);
      (socket as AuthenticatedSocket).data.user = user;
    } catch {
      this.logger.debug(`Rejecting socket ${socket.id}: invalid access token`);
      socket.disconnect(true);
    }
  }

  /**
   * Joins the household's room after re-checking membership server-side
   * (never trusts the client-supplied `householdId` alone) — mirrors
   * `HouseholdMembershipGuard`'s HTTP-side check. Silently no-ops if the
   * user isn't a member, same "look like it doesn't exist" posture as
   * `HouseholdAccessService.findMembershipOrThrow`'s 404 on the HTTP side.
   */
  @SubscribeMessage('joinHousehold')
  async handleJoinHousehold(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: HouseholdRoomMessage,
  ): Promise<void> {
    if (!data?.householdId) {
      return;
    }

    const isMember = await this.isHouseholdMember(socket, data.householdId);
    if (!isMember) {
      return;
    }

    await socket.join(householdRoom(data.householdId));
  }

  /** Symmetric with `handleJoinHousehold` — see its doc comment. */
  @SubscribeMessage('leaveHousehold')
  async handleLeaveHousehold(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: HouseholdRoomMessage,
  ): Promise<void> {
    if (!data?.householdId) {
      return;
    }

    const isMember = await this.isHouseholdMember(socket, data.householdId);
    if (!isMember) {
      return;
    }

    await socket.leave(householdRoom(data.householdId));
  }

  private async isHouseholdMember(
    socket: AuthenticatedSocket,
    householdId: string,
  ): Promise<boolean> {
    try {
      await this.householdAccessService.findMembershipOrThrow(socket.data.user.id, householdId);
      return true;
    } catch {
      return false;
    }
  }
}
