/**
 * The Socket.IO room name for a household's real-time channel. Shared by
 * `RealtimeGateway` (joins/leaves it per `joinHousehold`/`leaveHousehold`)
 * and `RealtimeService` (broadcasts into it) — kept in its own module with
 * no further imports so neither of those two needs to depend on the other
 * just for this one string format.
 */
export function householdRoom(householdId: string): string {
  return `household:${householdId}`;
}
