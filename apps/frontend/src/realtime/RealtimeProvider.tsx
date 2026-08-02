import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { useAuth } from '../auth/useAuth';
import { queryClient } from '../lib/query-client';
import { RealtimeContext, type RealtimeContextValue } from './RealtimeContext';
import { createSocket } from './socket-client';

type EventChangeType = 'FEEDING' | 'SLEEP' | 'DIAPER';

/** Mirrors the backend's `EventChangePayload` shape (see `realtime/realtime.service.ts`). */
interface EventChangedPayload {
  type: EventChangeType;
  action: 'created' | 'updated' | 'deleted';
  eventId: string;
  childId: string;
  householdId: string;
}

/** Maps a broadcast's event type to the query-key segment each event-type's components use. */
const EVENT_TYPE_QUERY_KEY_SEGMENT: Record<EventChangeType, string> = {
  FEEDING: 'feeding-events',
  SLEEP: 'sleep-events',
  DIAPER: 'diaper-events',
};

/**
 * Opens the app's single Socket.IO connection once the user is
 * authenticated, and tears it down on logout. Must be mounted inside
 * `AuthProvider` (see `main.tsx`) so `useAuth()` is available here.
 *
 * The `Socket` instance itself is created exactly once, via a lazy
 * `useState` initializer (not inside an effect): this repo's ESLint config
 * enforces `react-hooks/set-state-in-effect`, which flags synchronously
 * calling a state setter with a freshly-constructed external-system value
 * directly inside an effect body — the officially recommended fix for
 * "wrap an external resource and publish it to React state" is to avoid
 * that setState call entirely. `socket-client.ts`'s `createSocket()` passes
 * `autoConnect: false` for exactly this reason: the actual network
 * connect/disconnect is driven imperatively (calling methods on the
 * already-constructed instance) by the effect below, keyed off
 * `isAuthenticated` — no new `Socket` object, and therefore no `setSocket`
 * call, is ever needed after the initial one.
 *
 * Handles two things for every connected consumer, without any consumer
 * needing to know about sockets directly:
 * - live updates: an incoming `event:changed` message invalidates the
 *   matching React Query key family, so any mounted list/timer query
 *   refetches (see `useHouseholdRoom` for how a page opts into receiving
 *   these for a given household in the first place).
 * - reconnect handling: Socket.IO's client handles the connection retry
 *   itself; on every `connect` (which fires identically on the first
 *   connect and on every automatic reconnect), a broad `['households']`
 *   invalidation makes the currently-visible screen eventually-consistent
 *   with anything missed while disconnected, without a server-side replay
 *   log. `invalidateQueries` only *refetches* currently-mounted/observed
 *   queries — everything else is just marked stale for next use — so this
 *   stays cheap.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [socket] = useState<Socket>(() => createSocket());
  const [isConnected, setIsConnected] = useState(false);

  // Registers the socket's event listeners once, for the socket instance's
  // entire lifetime (it never changes identity — see doc comment above).
  useEffect(() => {
    const handleConnect = () => {
      setIsConnected(true);
      void queryClient.invalidateQueries({ queryKey: ['households'] });
    };
    const handleDisconnect = () => setIsConnected(false);
    const handleConnectError = () => setIsConnected(false);
    const handleEventChanged = (payload: EventChangedPayload) => {
      const segment = EVENT_TYPE_QUERY_KEY_SEGMENT[payload.type];
      void queryClient.invalidateQueries({
        queryKey: ['households', payload.householdId, 'children', payload.childId, segment],
      });
      // Type-independent invalidation, in addition to the per-type one
      // above: `invalidateQueries` matches by key-prefix by default, so this
      // partial key also invalidates the daily-timeline/stats queries (see
      // `event-api.ts`) for whatever date is currently mounted — those
      // aren't scoped to a single event type, so they can't be reached by
      // the per-type segment alone.
      void queryClient.invalidateQueries({
        queryKey: ['households', payload.householdId, 'children', payload.childId, 'events'],
      });
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('event:changed', handleEventChanged);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('event:changed', handleEventChanged);
    };
  }, [socket]);

  // Drives the actual network connection off auth state, imperatively —
  // see doc comment above for why this calls methods on the existing
  // socket rather than creating/storing a new one.
  useEffect(() => {
    if (isAuthenticated) {
      socket.connect();
    } else {
      socket.disconnect();
    }
  }, [socket, isAuthenticated]);

  const value = useMemo<RealtimeContextValue>(
    () => ({ socket, isConnected }),
    [socket, isConnected],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
