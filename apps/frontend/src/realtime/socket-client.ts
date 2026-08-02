import { io, type Socket } from 'socket.io-client';

/**
 * Thin factory around `socket.io-client`'s `io()` — kept as a factory
 * (rather than a module-level singleton/side effect) so tests can
 * `vi.mock('socket.io-client')` and assert on how `RealtimeProvider` uses
 * the returned socket, without ever attempting a real network connection.
 *
 * No explicit `url`/`path` option: defaults to the current origin's default
 * Socket.IO path (`/socket.io`), matching `RealtimeGateway`'s own defaults
 * on the backend (see its doc comment) and the dev-proxy entry in
 * `vite.config.ts`. Same-origin, so the httpOnly `access_token` cookie is
 * attached to the handshake automatically — no `withCredentials` needed.
 *
 * `autoConnect: false` — `RealtimeProvider` constructs this instance once
 * (regardless of auth state) and explicitly calls `.connect()`/
 * `.disconnect()` on it as the user logs in/out, rather than ever
 * constructing a second instance (see its own doc comment for why).
 */
export function createSocket(): Socket {
  return io({ autoConnect: false });
}
