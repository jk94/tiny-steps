import { join } from 'path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../src/auth/guards/csrf.guard';
import { HouseholdRole } from '../src/household/household-role.enum';
import { hashInviteToken } from '../src/household/invite-token.util';
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

describe('Household & Invites (e2e)', () => {
  const originalEnv = {
    CONFIG_PATH: process.env.CONFIG_PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  };

  // Distinct domain (not just `@e2e.test`, which auth.e2e-spec.ts also uses)
  // so this suite's afterEach cleanup can't race with/delete rows created by
  // other e2e spec files running concurrently in a different Jest worker.
  const E2E_EMAIL_DOMAIN = '@household.e2e.test';
  const testEmail = (label: string) =>
    `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}${E2E_EMAIL_DOMAIN}`;

  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.CONFIG_PATH = fixture('e2e.config.yml');
    // Reuses the real dev SQLite DB (already migrated), like auth.e2e-spec —
    // rows created here are cleaned up in afterEach.
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
    await app.init();
    // Binds a real ephemeral port instead of relying on supertest's implicit
    // per-request listener — see docs/known-issues.md's flaky e2e-tests
    // entry (mirrors realtime.e2e-spec.ts's rationale, which needs this for
    // its socket.io-client connection).
    await app.listen(0);

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
    const testUsers = await prisma.user.findMany({
      where: { email: { endsWith: E2E_EMAIL_DOMAIN } },
    });
    const userIds = testUsers.map((user) => user.id);

    const memberships = await prisma.membership.findMany({
      where: { userId: { in: userIds } },
    });
    const householdIds = [...new Set(memberships.map((membership) => membership.householdId))];

    // FK order: Invite/Membership -> Household, RefreshToken -> User.
    await prisma.invite.deleteMany({ where: { householdId: { in: householdIds } } });
    await prisma.membership.deleteMany({ where: { householdId: { in: householdIds } } });
    await prisma.household.deleteMany({ where: { id: { in: householdIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  async function registerUser(label: string): Promise<AuthenticatedTestUser> {
    const email = testEmail(label);
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'correct-pass1', name: 'E2E Tester' })
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

  it('creates a household with the creator as OWNER, and lists it for that user', async () => {
    const owner = await registerUser('create-owner');

    const household = await createHousehold(owner, 'Owner Household');
    expect(household).toEqual({
      id: expect.any(String),
      name: 'Owner Household',
      role: 'OWNER',
      createdAt: expect.any(String),
    });

    const listResponse = await request(app.getHttpServer())
      .get('/api/households')
      .set('Cookie', owner.cookies)
      .expect(200);

    expect(listResponse.body).toEqual([
      { id: household.id, name: 'Owner Household', role: 'OWNER', createdAt: household.createdAt },
    ]);
  });

  describe('creating an invite', () => {
    it('returns a token for the household owner with a matching CSRF header', async () => {
      const owner = await registerUser('invite-owner');
      const household = await createHousehold(owner, 'Invite Household');

      const invite = await createInvite(owner, household.id);

      expect(invite.token).toEqual(expect.any(String));
      expect(new Date(invite.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('rejects a missing/mismatched CSRF header with 403', async () => {
      const owner = await registerUser('invite-csrf');
      const household = await createHousehold(owner, 'CSRF Household');

      await request(app.getHttpServer())
        .post(`/api/households/${household.id}/invites`)
        .set('Cookie', owner.cookies)
        .expect(403);

      await request(app.getHttpServer())
        .post(`/api/households/${household.id}/invites`)
        .set('Cookie', owner.cookies)
        .set(CSRF_HEADER_NAME, 'not-the-real-csrf-token')
        .expect(403);
    });

    it('rejects a missing/invalid session with 401', async () => {
      const owner = await registerUser('invite-session');
      const household = await createHousehold(owner, 'Session Household');

      await request(app.getHttpServer())
        .post(`/api/households/${household.id}/invites`)
        .expect(401);
    });
  });

  it('previews a fresh invite token as valid, with the household name, when unauthenticated', async () => {
    const owner = await registerUser('preview-owner');
    const household = await createHousehold(owner, 'Preview Household');
    const invite = await createInvite(owner, household.id);

    const response = await request(app.getHttpServer())
      .get(`/api/invites/${invite.token}`)
      .expect(200);

    expect(response.body).toEqual({
      status: 'valid',
      householdName: 'Preview Household',
      expiresAt: invite.expiresAt,
    });
  });

  it('lets a second user accept an invite and become CO_PARENT, visible via list/get', async () => {
    const owner = await registerUser('accept-owner');
    const household = await createHousehold(owner, 'Accept Household');
    const invite = await createInvite(owner, household.id);

    const invitee = await registerUser('accept-invitee');

    const acceptResponse = await request(app.getHttpServer())
      .post(`/api/invites/${invite.token}/accept`)
      .set('Cookie', invitee.cookies)
      .set(CSRF_HEADER_NAME, invitee.csrfToken)
      .expect(200);

    expect(acceptResponse.body).toEqual({
      household: { id: household.id, name: 'Accept Household' },
      role: HouseholdRole.CO_PARENT,
    });

    const listResponse = await request(app.getHttpServer())
      .get('/api/households')
      .set('Cookie', invitee.cookies)
      .expect(200);
    expect(listResponse.body).toEqual([
      expect.objectContaining({ id: household.id, role: HouseholdRole.CO_PARENT }),
    ]);

    await request(app.getHttpServer())
      .get(`/api/households/${household.id}`)
      .set('Cookie', invitee.cookies)
      .expect(200);
  });

  it('forbids a CO_PARENT from creating invites', async () => {
    const owner = await registerUser('co-parent-owner');
    const household = await createHousehold(owner, 'Co-Parent Household');
    const invite = await createInvite(owner, household.id);

    const coParent = await registerUser('co-parent-invitee');
    await request(app.getHttpServer())
      .post(`/api/invites/${invite.token}/accept`)
      .set('Cookie', coParent.cookies)
      .set(CSRF_HEADER_NAME, coParent.csrfToken)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/households/${household.id}/invites`)
      .set('Cookie', coParent.cookies)
      .set(CSRF_HEADER_NAME, coParent.csrfToken)
      .expect(403);
  });

  it('returns 404 for a non-member on both GET :householdId and POST :householdId/invites', async () => {
    const owner = await registerUser('unrelated-owner');
    const household = await createHousehold(owner, 'Unrelated Household');

    const outsider = await registerUser('unrelated-outsider');

    await request(app.getHttpServer())
      .get(`/api/households/${household.id}`)
      .set('Cookie', outsider.cookies)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/households/${household.id}/invites`)
      .set('Cookie', outsider.cookies)
      .set(CSRF_HEADER_NAME, outsider.csrfToken)
      .expect(404);
  });

  it('rejects re-accepting an already-used token with 404', async () => {
    const owner = await registerUser('reuse-owner');
    const household = await createHousehold(owner, 'Reuse Household');
    const invite = await createInvite(owner, household.id);

    const invitee = await registerUser('reuse-invitee');
    await request(app.getHttpServer())
      .post(`/api/invites/${invite.token}/accept`)
      .set('Cookie', invitee.cookies)
      .set(CSRF_HEADER_NAME, invitee.csrfToken)
      .expect(200);

    // Same user, same (now-used) token.
    await request(app.getHttpServer())
      .post(`/api/invites/${invite.token}/accept`)
      .set('Cookie', invitee.cookies)
      .set(CSRF_HEADER_NAME, invitee.csrfToken)
      .expect(404);

    // A different user, same used token.
    const anotherUser = await registerUser('reuse-another');
    await request(app.getHttpServer())
      .post(`/api/invites/${invite.token}/accept`)
      .set('Cookie', anotherUser.cookies)
      .set(CSRF_HEADER_NAME, anotherUser.csrfToken)
      .expect(404);
  });

  it('reports an expired invite as expired on preview, and 404s on accept', async () => {
    const owner = await registerUser('expired-owner');
    const household = await createHousehold(owner, 'Expired Household');

    const rawToken = 'e2e-expired-token-fixture';
    await prisma.invite.create({
      data: {
        tokenHash: hashInviteToken(rawToken),
        householdId: household.id,
        createdByUserId: owner.userId,
        role: HouseholdRole.CO_PARENT,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const previewResponse = await request(app.getHttpServer())
      .get(`/api/invites/${rawToken}`)
      .expect(200);
    expect(previewResponse.body).toEqual({ status: 'expired' });

    const invitee = await registerUser('expired-invitee');
    await request(app.getHttpServer())
      .post(`/api/invites/${rawToken}/accept`)
      .set('Cookie', invitee.cookies)
      .set(CSRF_HEADER_NAME, invitee.csrfToken)
      .expect(404);
  });

  it('reports a nonexistent token as invalid on preview, and 404s on accept', async () => {
    const previewResponse = await request(app.getHttpServer())
      .get('/api/invites/this-token-does-not-exist')
      .expect(200);
    expect(previewResponse.body).toEqual({ status: 'invalid' });

    const invitee = await registerUser('garbage-token-invitee');
    await request(app.getHttpServer())
      .post('/api/invites/this-token-does-not-exist/accept')
      .set('Cookie', invitee.cookies)
      .set(CSRF_HEADER_NAME, invitee.csrfToken)
      .expect(404);
  });

  it('accepting an invite idempotently when already a member does not create a duplicate Membership', async () => {
    const owner = await registerUser('idempotent-owner');
    const household = await createHousehold(owner, 'Idempotent Household');
    const firstInvite = await createInvite(owner, household.id);

    const member = await registerUser('idempotent-member');
    await request(app.getHttpServer())
      .post(`/api/invites/${firstInvite.token}/accept`)
      .set('Cookie', member.cookies)
      .set(CSRF_HEADER_NAME, member.csrfToken)
      .expect(200);

    // Owner re-invites the same (already-member) user with a fresh token.
    const secondInvite = await createInvite(owner, household.id);
    await request(app.getHttpServer())
      .post(`/api/invites/${secondInvite.token}/accept`)
      .set('Cookie', member.cookies)
      .set(CSRF_HEADER_NAME, member.csrfToken)
      .expect(200);

    const membershipCount = await prisma.membership.count({
      where: { userId: member.userId, householdId: household.id },
    });
    expect(membershipCount).toBe(1);
  });

  it('supports a user belonging to two independent households with CO_PARENT in each', async () => {
    const firstOwner = await registerUser('multi-owner-1');
    const secondOwner = await registerUser('multi-owner-2');
    const firstHousehold = await createHousehold(firstOwner, 'First Household');
    const secondHousehold = await createHousehold(secondOwner, 'Second Household');

    const sharedInvitee = await registerUser('multi-invitee');

    const inviteToFirst = await createInvite(firstOwner, firstHousehold.id);
    const inviteToSecond = await createInvite(secondOwner, secondHousehold.id);

    await request(app.getHttpServer())
      .post(`/api/invites/${inviteToFirst.token}/accept`)
      .set('Cookie', sharedInvitee.cookies)
      .set(CSRF_HEADER_NAME, sharedInvitee.csrfToken)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/invites/${inviteToSecond.token}/accept`)
      .set('Cookie', sharedInvitee.cookies)
      .set(CSRF_HEADER_NAME, sharedInvitee.csrfToken)
      .expect(200);

    const listResponse = await request(app.getHttpServer())
      .get('/api/households')
      .set('Cookie', sharedInvitee.cookies)
      .expect(200);

    expect(listResponse.body).toHaveLength(2);
    expect(listResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: firstHousehold.id, role: HouseholdRole.CO_PARENT }),
        expect.objectContaining({ id: secondHousehold.id, role: HouseholdRole.CO_PARENT }),
      ]),
    );

    // The two households/memberships are independently scoped, not cross-linked.
    const firstHouseholdMemberships = await prisma.membership.findMany({
      where: { householdId: firstHousehold.id },
    });
    const secondHouseholdMemberships = await prisma.membership.findMany({
      where: { householdId: secondHousehold.id },
    });
    expect(firstHouseholdMemberships.map((m) => m.userId).sort()).toEqual(
      [firstOwner.userId, sharedInvitee.userId].sort(),
    );
    expect(secondHouseholdMemberships.map((m) => m.userId).sort()).toEqual(
      [secondOwner.userId, sharedInvitee.userId].sort(),
    );
  });
});
