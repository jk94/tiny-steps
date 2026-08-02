import { io, type Socket } from 'socket.io-client';

/**
 * Thin factory around `socket.io-client`'s `io()` — kept as a factory
 * (rather than a module-level singleton/side effect) so tests can
 * `vi.mock('socket.io-client')` and assert on how `RealtimeProvider` uses
 * the returned socket, without ever attempting a real network connection.
 *
 * No explicit `url`: defaults to the current origin. `path: '/api/socket.io'`
 * mirrors `RealtimeGateway`'s own path (see its doc comment) — the handshake
 * must live under `/api` because that's the path the httpOnly `access_token`
 * cookie is scoped to (`AuthCookieService`); a handshake outside `/api`
 * would never carry it. Same-origin, so the cookie is attached to the
 * handshake automatically once the path matches — no `withCredentials`
 * needed. The dev-only Vite proxy (`vite.config.ts`) forwards this same
 * path with `ws: true`.
 *
 * `autoConnect: false` — `RealtimeProvider` constructs this instance once
 * (regardless of auth state) and explicitly calls `.connect()`/
 * `.disconnect()` on it as the user logs in/out, rather than ever
 * constructing a second instance (see its own doc comment for why).
 */
export function createSocket(): Socket {
  return io({ autoConnect: false, path: '/api/socket.io' });
}
