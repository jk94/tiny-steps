import { join } from 'path';
import type { AddressInfo } from 'net';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { io, Socket as ClientSocket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../src/auth/guards/csrf.guard';
import { EventType } from '../src/event/event-type.enum';
import { FeedingType } from '../src/feeding/feeding-type.enum';
import { PrismaService } from '../src/prisma/prisma.service';

const fixture = (name: string) => join(__dirname, '__fixtures__', name);

/** Extracts just `name=value` pairs from a response's Set-Cookie header, dropping attributes. */
function cookieHeaderFrom(setCookie: string[] | undefined): string[] {
  return (setCookie ?? []).map((raw) => raw.split(';')[0]);
}

/** Finds one cookie's `name=value` pair (with attributes) from a Set-Cookie header array. */
function findSetCookie(setCookie: string[] | undefined, name: string): string | undefined {
  return (setCookie ?? []).find((raw) => raw.startsWith(`${name}=`));
}

function cookieValue(setCookie: string | undefined): string | undefined {
  return setCookie?.split(';')[0]?.split('=')[1];
}

interface AuthenticatedTestUser {
  userId: string;
  email: string;
  cookies: string[];
  csrfToken: string;
}

/** Waits for a socket event exactly once, rejecting if it doesn't fire within `timeoutMs`. */
function waitForEvent<T>(socket: ClientSocket, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeoutMs);

    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function waitForConnect(socket: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', (err: Error) => reject(err));
  });
}

describe('Realtime sync (e2e)', () => {
  const originalEnv = {
    CONFIG_PATH: process.env.CONFIG_PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  };

  // Distinct domain so this suite's afterEach cleanup can't race with/delete
  // rows created by other e2e spec files running concurrently (mirrors
  // household.e2e-spec.ts/child.e2e-spec.ts).
  const E2E_EMAIL_DOMAIN = '@realtime.e2e.test';
  const testEmail = (label: string) =>
    `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}${E2E_EMAIL_DOMAIN}`;

  let app: INestApplication<App>;
  let prisma: PrismaService;
  let baseUrl: string;
  const openSockets: ClientSocket[] = [];

  beforeAll(async () => {
    process.env.CONFIG_PATH = fixture('e2e.config.yml');
    // Reuses the real dev SQLite DB (already migrated), like the other e2e
    // suites — rows created here are cleaned up in afterEach.
    process.env.DATABASE_URL = 'file:./prisma/dev.db';
    process.env.JWT_ACCESS_SECRET = 'e2e-test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'e2e-test-refresh-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    // Unlike every other e2e suite here, a real socket.io-client connection
    // needs a reachable TCP port — `supertest`'s in-process request calls
    // don't require one, but Socket.IO's handshake does. `listen(0)` picks
    // a free ephemeral port; `request(app.getHttpServer())` below still
    // works unchanged against the same now-listening server.
    await app.init();
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
    process.env.CONFIG_PATH = originalEnv.CONFIG_PATH;
    process.env.DATABASE_URL = originalEnv.DATABASE_URL;
    process.env.JWT_ACCESS_SECRET = originalEnv.JWT_ACCESS_SECRET;
    process.env.JWT_REFRESH_SECRET = originalEnv.JWT_REFRESH_SECRET;
  });

  afterEach(async () => {
    for (const socket of openSockets.splice(0)) {
      socket.disconnect();
    }

    const testUsers = await prisma.user.findMany({
      where: { email: { endsWith: E2E_EMAIL_DOMAIN } },
    });
    const userIds = testUsers.map((user) => user.id);

    const memberships = await prisma.membership.findMany({
      where: { userId: { in: userIds } },
    });
    const householdIds = [...new Set(memberships.map((membership) => membership.householdId))];

    const children = await prisma.child.findMany({ where: { householdId: { in: householdIds } } });
    const childIds = children.map((child) => child.id);

    // FK order: FeedingDetail/DiaperDetail cascade off Event -> Event ->
    // Child/Invite -> Household -> Membership -> Household, RefreshToken ->
    // User.
    await prisma.event.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.invite.deleteMany({ where: { householdId: { in: householdIds } } });
    await prisma.child.deleteMany({ where: { householdId: { in: householdIds } } });
    await prisma.membership.deleteMany({ where: { householdId: { in: householdIds } } });
    await prisma.household.deleteMany({ where: { id: { in: householdIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  async function createHousehold(owner: AuthenticatedTestUser, name: string) {
    const response = await request(app.getHttpServer())
      .post('/api/households')
      .set('Cookie', owner.cookies)
      .set(CSRF_HEADER_NAME, owner.csrfToken)
      .send({ name })
      .expect(201);
    return response.body as { id: string; name: string; role: string; createdAt: string };
  }

  async function createInvite(owner: AuthenticatedTestUser, householdId: string) {
    const response = await request(app.getHttpServer())
      .post(`/api/households/${householdId}/invites`)
      .set('Cookie', owner.cookies)
      .set(CSRF_HEADER_NAME, owner.csrfToken)
      .expect(201);
    return response.body as { token: string; expiresAt: string };
  }

  async function acceptInvite(user: AuthenticatedTestUser, token: string) {
    await request(app.getHttpServer())
      .post(`/api/invites/${token}/accept`)
      .set('Cookie', user.cookies)
      .set(CSRF_HEADER_NAME, user.csrfToken)
      .expect(200);
  }

  async function createChild(owner: AuthenticatedTestUser, householdId: string, name: string) {
    const response = await request(app.getHttpServer())
      .post(`/api/households/${householdId}/children`)
      .set('Cookie', owner.cookies)
      .set(CSRF_HEADER_NAME, owner.csrfToken)
      .field('name', name)
      .field('birthDate', '2024-01-01T00:00:00.000Z')
      .expect(201);
    return response.body as { id: string };
  }

  /** Opens an authenticated Socket.IO connection, carrying `user`'s session cookies on the handshake. */
  async function connectSocket(user: AuthenticatedTestUser): Promise<ClientSocket> {
    const socket = io(baseUrl, {
      transports: ['websocket'],
      forceNew: true,
      extraHeaders: { Cookie: user.cookies.join('; ') },
    });
    openSockets.push(socket);
    await waitForConnect(socket);
    return socket;
  }

  async function registerUser(label: string): Promise<AuthenticatedTestUser> {
    const email = testEmail(label);
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'correct-pass1' })
      .expect(201);

    const setCookie = response.headers['set-cookie'] as unknown as string[];
    const csrfCookieRaw = findSetCookie(setCookie, CSRF_COOKIE_NAME)!;

    return {
      userId: response.body.user.id,
      email,
      cookies: cookieHeaderFrom(setCookie),
      csrfToken: cookieValue(csrfCookieRaw)!,
    };
  }

  it('broadcasts a newly created Feeding event to another connected household member (PRD section 6 acceptance criterion)', async () => {
    const owner = await registerUser('owner');
    const coParent = await registerUser('co-parent');

    const household = await createHousehold(owner, 'Realtime Household');
    const invite = await createInvite(owner, household.id);
    await acceptInvite(coParent, invite.token);
    const child = await createChild(owner, household.id, 'Alex');

    const ownerSocket = await connectSocket(owner);
    const coParentSocket = await connectSocket(coParent);

    // Both connected household members join the household's room — mirrors
    // useHouseholdRoom on the frontend (joined per-active-route, not at
    // connection time).
    ownerSocket.emit('joinHousehold', { householdId: household.id });
    coParentSocket.emit('joinHousehold', { householdId: household.id });
    // No ack protocol on joinHousehold (see RealtimeGateway's doc comment) —
    // give the fire-and-forget join a moment to be processed server-side
    // before the event that should land in that room is created.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const eventChangedPromise = waitForEvent<{
      type: string;
      action: string;
      eventId: string;
      childId: string;
      householdId: string;
    }>(coParentSocket, 'event:changed');

    const createResponse = await request(app.getHttpServer())
      .post(`/api/households/${household.id}/children/${child.id}/feeding-events`)
      .set('Cookie', owner.cookies)
      .set(CSRF_HEADER_NAME, owner.csrfToken)
      .send({ feedingType: FeedingType.SOLID })
      .expect(201);

    const payload = await eventChangedPromise;

    expect(payload).toEqual({
      type: EventType.FEEDING,
      action: 'created',
      eventId: createResponse.body.id,
      childId: child.id,
      householdId: household.id,
    });
  });

  it('does not deliver event:changed to a socket that never joined the household room', async () => {
    const owner = await registerUser('owner-solo');
    const household = await createHousehold(owner, 'Solo Household');
    const child = await createChild(owner, household.id, 'Sam');

    const ownerSocket = await connectSocket(owner);
    // Deliberately does not emit `joinHousehold`.

    let received = false;
    ownerSocket.on('event:changed', () => {
      received = true;
    });

    await request(app.getHttpServer())
      .post(`/api/households/${household.id}/children/${child.id}/feeding-events`)
      .set('Cookie', owner.cookies)
      .set(CSRF_HEADER_NAME, owner.csrfToken)
      .send({ feedingType: FeedingType.SOLID })
      .expect(201);

    // No ack/event to await here by design (this asserts an ABSENCE) — a
    // short grace period is the only way to assert "nothing arrived".
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(received).toBe(false);
  });

  it('rejects a socket handshake with no valid access_token cookie', async () => {
    const socket = io(baseUrl, {
      transports: ['websocket'],
      forceNew: true,
    });
    openSockets.push(socket);

    await expect(waitForEvent(socket, 'disconnect')).resolves.toBeDefined();
  });
});
