# ADR-0007: WebSocket real-time sync via Socket.IO, room-per-route, thin broadcast payload

## Status

Accepted

## Context

[Phase 3 roadmap](../roadmap/phase-3-sync-uebersicht.md) requires that a new entry logged by one
household member appears for every other connected member without a manual reload (PRD section
4.1, "Multiuser-Echtzeitsicht"; PRD 5.2 names WebSockets explicitly). This was in fact already the
deciding argument for choosing NestJS over Next.js in the first place (PRD 5.3: "native long-lived
Node process for WebSockets (`@nestjs/websockets`)") — this sub-step is where that architectural
bet gets cashed in. Scope for this sub-step ("Slice 1") is deliberately narrowed to the sync
infrastructure itself, not the day-timeline or statistics features that are also part of the Phase
3 roadmap file; those stay unimplemented.

Constraints already established by earlier decisions that shaped this one:

- Local auth is JWT access/refresh tokens in httpOnly, `SameSite=Lax` cookies, single-origin, no
  CORS (see [ADR-0001](0001-jwt-httponly-cookie-session-handling.md); the no-CORS posture is also
  documented at the point it's applied in `apps/backend/src/main.ts`). ADR-0001 already anticipated
  that "the same token/cookie infrastructure is designed to be reused as-is by ... WebSocket auth in
  Phase 3."
- The frontend has no global "current household" state anywhere — household/child ids are only
  ever read from route params (`useParams()`), never from a store.
- The roadmap's Definition of Done for this slice is "an entry appears for other members in
  real time without a reload," not "every event is replayed in guaranteed order after a
  disconnect."

Several design questions needed deciding:

1. Which WebSocket library/transport?
2. How does the WS handshake authenticate, given the existing auth design was built for HTTP
   requests, not a long-lived connection?
3. Does the handshake need the same CSRF protection HTTP mutations already have?
4. How are sockets scoped to a household so broadcasts don't leak across households — and when
   does that scoping happen?
5. What goes into a broadcast, and how does a client catch up after a dropped connection?
6. What happens to an already-open, already-joined socket if the user's access to a household
   changes while connected?

## Decision

### a) Socket.IO, not raw `ws`

Chose Socket.IO (`@nestjs/platform-socket.io` + `socket.io` on the backend, `socket.io-client` on
the frontend) over `@nestjs/platform-ws` (raw `ws`). Both are officially supported NestJS WebSocket
adapters, so this was a genuine choice, not a default:

- **Rooms are exactly the scoping primitive this feature needs.** `socket.join(room)` /
  `socket.leave(room)` / `server.to(room).emit(...)` map directly onto "broadcast a change to every
  connected member of one household" — the `ws` adapter has no equivalent and would require
  hand-rolling the same bookkeeping (tracking which raw socket belongs to which household) that
  Socket.IO already provides.
- **Built-in client-side reconnection/backoff** removes the need to hand-roll retry logic to
  satisfy the roadmap's "Reconnect-Handling" requirement — see decision (e) below for how the
  reconnect *strategy* (not just the reconnect mechanics) was designed around this.
- Consistent with the decorator-based style (`@WebSocketGateway`, `@SubscribeMessage`,
  `@ConnectedSocket`) NestJS's Socket.IO adapter provides, matching this codebase's existing
  Nest conventions (guards, decorators) elsewhere.

Tradeoff accepted: Socket.IO's handshake/protocol framing is a heavier wire format than a raw
WebSocket frame, and requires clients to speak Socket.IO's protocol specifically (a generic WS
client can't connect to it) — not a concern at this app's connection scale (household-sized, not
public-internet-sized).

### b) Shared JWT verification, not a duplicated check

`RealtimeGateway.handleConnection` authenticates the handshake using a **newly extracted
`AccessTokenVerifierService`** (`apps/backend/src/auth/access-token-verifier.service.ts`), pulled
out of `JwtStrategy.validate()` (`apps/backend/src/auth/strategies/jwt.strategy.ts`). Both the HTTP
path (Passport's `JwtStrategy`) and the WS path now call the exact same implementation of: verify
signature/expiry, reject a token carrying a `purpose` claim (an OIDC transaction token minted by
the flow in [ADR-0004](0004-oidc-authentication.md), signed with the same secret and therefore not
distinguishable by signature alone), reject a non-string `sub`, and re-fetch the user from the DB on
every call so a deleted/disabled user is rejected even while their access token is still
cryptographically valid.

This was a deliberate decision, not an incidental refactor: a WebSocket connection has no Passport
strategy running (there is no HTTP request/response cycle to hook a strategy into), so *some* new
code had to read and verify the `access_token` cookie for the WS path regardless. Extracting a
shared service instead of writing a second, WS-local implementation is what prevents the two auth
paths from silently drifting apart on a security-sensitive check over time — e.g. a future change
to the `purpose`-claim rejection landing in one path and not the other.

Practically, `socket.handshake.headers.cookie` is parsed manually with the `cookie` package,
because Express's `cookie-parser` middleware (used for the HTTP path) is only wired into the HTTP
request pipeline and never runs for the WS upgrade request.

### c) No CSRF token at the WS handshake

HTTP mutations (`refresh`, `logout`, and by extension every state-changing route protected by
`CsrfGuard`) require a double-submit `csrf_token`/`X-CSRF-Token` pair as defense-in-depth on top of
`SameSite=Lax` (see ADR-0001). The WS handshake deliberately requires no equivalent token.

Reasoning: a cross-origin page has no way to make a browser attach the `access_token` cookie to a
socket handshake in the first place. Every auth cookie is `SameSite=Lax`, and — like every other
route in this app — the Socket.IO gateway never enables CORS (no `cors` option is passed to
`@WebSocketGateway()`; see the no-CORS doc comment already established in `main.ts`, which this
mirrors). With no cross-origin caller able to reach the handshake with the cookie attached at all,
there is nothing left for a CSRF token to add specifically at that step. This is the same posture
`main.ts` already documents for skipping `app.enableCors()` app-wide, applied to a second transport
rather than a new argument.

### d) Rooms joined per-active-route, not all at connect

Considered and rejected: auto-joining every household a user belongs to as soon as the socket
connects. Instead, the gateway exposes explicit `joinHousehold`/`leaveHousehold` message handlers
(`RealtimeGateway.handleJoinHousehold`/`handleLeaveHousehold`), and the frontend's
`useHouseholdRoom(householdId)` hook (`apps/frontend/src/realtime/useHouseholdRoom.ts`) emits them
on mount, on `householdId` change, on unmount, and again on every socket `connect` event (a room
joined before a disconnect does not survive Socket.IO's reconnection, since the server sees a fresh
connection). It is wired into all 12 page components that read a `householdId` route param — not
just the tracking-type home pages, but also child-profile and backfill/edit pages.

The deciding reason is the constraint noted above: this app has no global "current household"
state anywhere in the frontend. Auto-joining every household at connect time would either require
inventing that global state just to know what to join, or would join rooms the user isn't currently
looking at (harmless correctness-wise, but pointless broadcast traffic for households whose UI
isn't even mounted). Joining per-active-route reuses the pattern the rest of the frontend already
follows — household/child ids come from the route, not a store.

Each join/leave re-checks the caller's membership server-side via the existing
`HouseholdAccessService.findMembershipOrThrow` (`apps/backend/src/household/household-access.service.ts`)
— the same lookup `HouseholdMembershipGuard` uses on the HTTP side — rather than trusting the
client-supplied `householdId`. A non-member's join request silently no-ops instead of erroring,
mirroring the "look like it doesn't exist" posture `HouseholdAccessService` already uses for its
HTTP-side 404 (see [ADR-0002](0002-application-level-household-roles-and-invites.md)).

### e) Thin broadcast payload, client-side refetch-on-connect as the reconnect strategy

`RealtimeService.broadcastEventChange(householdId, payload)` (`apps/backend/src/realtime/realtime.service.ts`)
emits a payload carrying only `{ type, action, eventId, childId, householdId }` — never a full
event body — to the `household:${householdId}` room under the event name `event:changed`. It's
wired into `FeedingService`/`SleepService`/`DiaperService`'s `create`/`update`/`remove`/`stop`
methods (`stop()` collapses into the generic `'updated'` action). The frontend's `RealtimeProvider`
(`apps/frontend/src/realtime/RealtimeProvider.tsx`) reacts to `event:changed` by invalidating the
matching React Query key family, so the relevant list/timer refetches — the socket message is a
"something changed, go refetch" signal, not a payload to hydrate state from directly.

For reconnects specifically, no server-side event replay/outbox log was built. This was considered
and rejected as scope beyond this slice's Definition of Done, which only requires "no manual
reload," not "every missed event replayed in order." Instead, `RealtimeProvider` invalidates a
broad `['households']` React Query key on every `connect` event — which fires identically on the
very first connect and on every automatic reconnect — making whatever screen is currently mounted
eventually-consistent after any drop. `invalidateQueries` only refetches currently-mounted/observed
queries, so this stays cheap even though the key is broad. Socket.IO's own client handles the
reconnection/backoff mechanics; this decision only concerns what happens once a (re)connection is
established.

### f) Known accepted gap: no re-validation on an already-open socket

Membership is checked once at handshake time and once per `joinHousehold` call, but never
re-checked on an already-open, already-joined socket. If a user's household membership were
revoked while their socket is still connected and joined, they would keep receiving that
household's broadcasts until the socket drops for an unrelated reason (page reload, network loss,
...).

This is accepted as a real but currently *unreachable* gap: there is no membership-removal or
leave-household backend endpoint anywhere in this codebase yet (confirmed absent; already tracked
as absent in the [Phase 1 roadmap](../roadmap/phase-1-auth-multiuser.md)'s checklist). A reusable
fix primitive already exists and is tested regardless of that: `RealtimeService.evictFromHousehold(userId, householdId)`
removes a user's currently-connected sockets from a household's room (without disconnecting the
socket itself, since it may be legitimately connected for other households) — see its doc comment
and `apps/backend/src/realtime/realtime.service.spec.ts`. The Phase 1 roadmap file already carries
a "Follow-up bei Umsetzung" note next to the household-management checklist item, saying that
whenever a membership-removal endpoint is eventually built, it must call `evictFromHousehold` right
after deleting the `Membership` row. That note is the source of truth for this follow-up and isn't
duplicated here.

## Consequences

**Positive:**

- HTTP and WebSocket auth share one implementation (`AccessTokenVerifierService`), so a future
  change to access-token validation rules (e.g. tightening the `purpose`-claim check) can't land in
  one transport and be forgotten in the other.
- No new global frontend state was needed to support real-time sync — household/child ids continue
  to come from route params everywhere, matching the rest of the app.
- The thin-payload design means a broadcast's shape is stable regardless of how much a given event
  type's own fields grow (e.g. if `DiaperDetail` gains a field later, `EventChangePayload` doesn't
  need to change).
- `evictFromHousehold` closes decision (f)'s gap the moment it's needed, without requiring any
  further design work on the realtime module itself when the membership-removal endpoint is built.

**Negative / tradeoffs:**

- Socket.IO's protocol is not plain WebSocket — any future non-browser client (e.g. a native
  wrapper built with something other than a WebView, or an external integration) must use a
  Socket.IO-compatible client, not an arbitrary WS library. Accepted given the native wrapper (Phase
  5, still Capacitor-vs-Tauri undecided) is expected to embed a WebView, which `socket.io-client`
  runs in the same as a normal browser.
- The reconnect strategy (broad `['households']` invalidation on every `connect`) can cause more
  refetching than strictly necessary right after a reconnect, compared to a precise replay log —
  accepted because `invalidateQueries` only refetches what's actually mounted, and precision here
  wasn't required by this slice's Definition of Done.
- Decision (f)'s gap is real, not hypothetical, even though currently unreachable — it must be
  remembered (via the Phase 1 roadmap note) when the membership-removal endpoint is eventually
  built, or a removed member could keep receiving that household's live updates for the remainder
  of their session.
- Household-room membership must be re-established after every reconnect (see `useHouseholdRoom`'s
  `connect`-event re-join) — a small amount of client-side bookkeeping that a server-side
  "remember what this session had joined" design would avoid, judged not worth the added server
  state for this slice.

## Addendum: handshake moved under `/api` — the `access_token` cookie's path scope excluded `/socket.io`

After this slice merged, real browser connections (not `apps/backend/test/realtime.e2e-spec.ts`'s
socket, which manually sets its own `Cookie` header via `extraHeaders` and so never exercised
browser path-matching) failed every handshake with `RealtimeGateway` logging "no access_token
cookie on handshake" — `handleConnection` correctly saw no cookie, because the browser never sent
one.

Root cause: `AuthCookieService` scopes the `access_token` cookie to `path: '/api'` (see its doc
comment — deliberately narrower than the SPA's own routes). Socket.IO's default handshake path is
`/socket.io`, which is not a sub-path of `/api`. Per RFC 6265 cookie path-matching, a browser only
attaches a cookie to a request whose path is under (or equal to) the cookie's own path — so a
handshake at `/socket.io` was structurally never eligible to carry the cookie, regardless of
`SameSite`/`secure`/same-origin. This is the same path-matching rule the `csrf_token` cookie's own
doc comment already describes (in the opposite direction — that cookie was widened to `path: '/'`
for exactly this reason), which this ADR's original decision (b) missed applying to the WS
handshake itself.

Fix: `RealtimeGateway` now sets `path: '/api/socket.io'` on `@WebSocketGateway()`, and the frontend's
`createSocket()` (`apps/frontend/src/realtime/socket-client.ts`) passes the matching `path` to
`io()`. The dev-only Vite proxy (`apps/frontend/vite.config.ts`) no longer needs a separate
`/socket.io` proxy entry — the existing `/api` entry now carries `ws: true` and forwards the
handshake like any other `/api` request. `AuthCookieService`'s cookie scoping itself did not need to
change; narrowing the handshake's own path to match it was the more targeted fix, consistent with
every other authenticated endpoint already living under `/api`.

## Related

- [Phase 3 roadmap](../roadmap/phase-3-sync-uebersicht.md) — "Echtzeit-Sync (Backend)" and
  "Echtzeit-Sync (Frontend)" are the sub-steps this decision was made for; day-timeline and
  statistics remain unimplemented follow-up sub-steps of the same phase.
- [ADR-0001](0001-jwt-httponly-cookie-session-handling.md) — the JWT/cookie/CSRF design this
  sub-step reuses and extends to a second transport; already anticipated this reuse.
- [ADR-0004](0004-oidc-authentication.md) — origin of the `purpose`-claim / `oidc_txn` transaction
  token that `AccessTokenVerifierService` structurally rejects.
- [ADR-0002](0002-application-level-household-roles-and-invites.md) — origin of the
  `HouseholdAccessService.findMembershipOrThrow` lookup and its "look like it doesn't exist"
  posture, reused here for `joinHousehold`/`leaveHousehold`.
- [Phase 1 roadmap](../roadmap/phase-1-auth-multiuser.md) — carries the "Follow-up bei Umsetzung"
  note tying a future membership-removal endpoint to `RealtimeService.evictFromHousehold`.
- `apps/backend/src/realtime/` — implementation (`realtime.gateway.ts`, `realtime.service.ts`,
  `realtime.module.ts`, `household-room.util.ts`).
- `apps/backend/src/auth/access-token-verifier.service.ts` — shared access-token verification.
- `apps/frontend/src/realtime/` — implementation (`socket-client.ts`, `RealtimeProvider.tsx`,
  `RealtimeContext.ts`, `useRealtimeConnection.ts`, `useHouseholdRoom.ts`).
- `apps/backend/test/realtime.e2e-spec.ts` — end-to-end coverage of the PRD section 6 acceptance
  criterion (two real `socket.io-client` connections in the same household; an HTTP-created event
  is received by the other).
