import { useEffect } from 'react';
import { useRealtimeConnection } from './useRealtimeConnection';

/**
 * Joins the given household's WebSocket room for as long as this hook is
 * mounted with a defined `householdId`, leaving it on unmount or before
 * switching to a different household — rooms are joined per-active-route,
 * not all at once at connection time (see `RealtimeGateway`'s doc comment
 * on the backend for the full rationale). Call this from whichever page
 * component already has `householdId` from its route params; there is no
 * global "current household" state to hook into instead.
 *
 * `householdId` may be `undefined` while route params haven't resolved yet
 * (mirrors how callers already guard `useQuery({ enabled: !!householdId })`
 * elsewhere) — this hook simply no-ops until it is defined.
 */
export function useHouseholdRoom(householdId: string | undefined): void {
  const { socket } = useRealtimeConnection();

  useEffect(() => {
    if (!socket || !householdId) {
      return;
    }

    const join = () => socket.emit('joinHousehold', { householdId });
    join();
    // Re-join on every reconnect too: Socket.IO's automatic reconnection
    // establishes a fresh server-side connection (and thus a fresh,
    // room-less socket on the server) even though the client-side `Socket`
    // object here stays the same — a room joined before a disconnect
    // doesn't survive a reconnect on its own.
    socket.on('connect', join);

    return () => {
      socket.off('connect', join);
      socket.emit('leaveHousehold', { householdId });
    };
  }, [socket, householdId]);
}
