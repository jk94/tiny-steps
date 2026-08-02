import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import type { EventType } from '../event/event-type.enum';
import { householdRoom } from './household-room.util';

export type EventChangeAction = 'created' | 'updated' | 'deleted';

/**
 * Deliberately thin (ids only, no event body) — clients refetch the
 * changed list via React Query rather than the socket carrying full event
 * payloads, keeping this broadcast cheap and this payload shape stable
 * regardless of how much a given event type's own fields grow.
 */
export interface EventChangePayload {
  type: EventType;
  action: EventChangeAction;
  eventId: string;
  childId: string;
  householdId: string;
}

export const EVENT_CHANGED = 'event:changed';

/**
 * Thin wrapper around the gateway's `Server` instance, so
 * `FeedingService`/`SleepService`/`DiaperService` can broadcast a change
 * without depending on `RealtimeGateway` (and the Nest WS-gateway
 * machinery) directly — same DI-boundary rationale as e.g.
 * `HouseholdAccessService` being split out of `HouseholdMembershipGuard`.
 */
@Injectable()
export class RealtimeService {
  private server: Server | undefined;

  /** Called once by `RealtimeGateway.afterInit()` when the Socket.IO server is ready. */
  setServer(server: Server): void {
    this.server = server;
  }

  broadcastEventChange(householdId: string, payload: EventChangePayload): void {
    // `server` is only unset in the brief window before
    // `RealtimeGateway.afterInit()` runs (before the app has finished
    // bootstrapping) — no HTTP request that could reach a
    // create/update/remove/stop call site exists yet at that point, but
    // this stays defensive rather than assuming that ordering can never
    // change.
    this.server?.to(householdRoom(householdId)).emit(EVENT_CHANGED, payload);
  }
}
