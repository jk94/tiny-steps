import { useEffect, type ReactNode } from 'react';
import { useRealtimeConnection } from '../realtime/useRealtimeConnection';
import { drainPendingEventQueue } from './syncQueue';

/**
 * Drives the offline sync-queue (`drainPendingEventQueue`) off two connectivity
 * signals, mounted as a sibling of the realtime wiring (needs its context):
 *
 * - `navigator.onLine`'s `online` event — fast and local-only; harmless if it
 *   fires optimistically, since a doomed resend just fails and reschedules.
 * - the Socket.IO connection coming up (`isConnected`) — authoritative, because
 *   a real handshake actually succeeded. Not gated by per-route room membership:
 *   the drain invalidates the authoritative query keys itself rather than
 *   relying on `event:changed` broadcasts reaching a joined room.
 *
 * Renders nothing of its own — it only registers side effects around `children`.
 */
export function SyncQueueProvider({ children }: { children: ReactNode }) {
  const { isConnected } = useRealtimeConnection();

  useEffect(() => {
    if (isConnected) {
      void drainPendingEventQueue();
    }
  }, [isConnected]);

  useEffect(() => {
    const handleOnline = () => void drainPendingEventQueue();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return <>{children}</>;
}
