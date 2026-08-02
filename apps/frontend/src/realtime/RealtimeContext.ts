import { createContext } from 'react';
import type { Socket } from 'socket.io-client';

export interface RealtimeContextValue {
  /**
   * The app's single Socket.IO client instance. `RealtimeProvider`
   * constructs it once, with `autoConnect: false`, and connects/disconnects
   * it as auth state changes (see its own doc comment) — so in practice
   * this is non-null for the entire lifetime of a mounted `RealtimeProvider`
   * (i.e. always, once the app has rendered at all); it stays nullable here
   * defensively/for testability rather than because callers realistically
   * need to branch on it.
   */
  socket: Socket | null;
  /** Whether `socket` currently has a live connection — see `RealtimeProvider`'s `connect`/`disconnect`/`connect_error` handling. */
  isConnected: boolean;
}

// Split into its own file (rather than living in RealtimeProvider.tsx) so
// that file only exports the `RealtimeProvider` component — keeps React
// Fast Refresh happy (see `react-refresh/only-export-components`), same
// rationale as `AuthContext.ts`.
export const RealtimeContext = createContext<RealtimeContextValue | undefined>(undefined);
