import { join } from 'path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../src/auth/guards/csrf.guard';
import { HouseholdRole } from '../src/household/household-role.enum';
import { PrismaService } from '../src/prisma/prisma.service';

const fixture = (name: string) => join(__dirname, '__fixtures__', name);

const BIRTH_DATE = '2025-01-20';
const ACHIEVED_AT = '2025-08-20';
const MEASURED_AT = '2025-08-20';
const ADMINISTERED_AT = '2025-08-20T14:30:00.000Z';

/** `GET .../events/daily` takes a mandatory `[from, to)` pair of instants. */
const DAY_RANGE = '?from=2025-08-20T00:00:00.000Z&to=2025-08-21T00:00:00.000Z';

/** A full, valid notification-settings body (the endpoint has PUT semantics). */
const NOTIFICATION_SETTINGS = {
  feedingReminderEnabled: true,
  feedingReminderThresholdHours: 4,
  dailySummaryEnabled: true,
  dailySummaryHourLocal: 20,
  medicalReminderEnabled: true,
  medicalReminderLeadDays: 3,
};

function cookieHeaderFrom(setCookie: string[] | undefined): string[] {
  return (setCookie ?? []).map((raw) => raw.split(';')[0]);
}

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

/**
 * Phase 7.5 — the permission matrix exercised end to end, one request per
 * cell.
 *
 * The distinction that matters throughout: a **member with the wrong role gets
 * 403**, a **non-member gets 404** (ROL-4). The latter is not a rounding error
 * — `HouseholdMembershipGuard` resolves membership *before* any role check, so
 * an outsider can never even learn whether a household exists.
 */
describe('Household roles (e2e)', () => {
  const originalEnv = {
    CONFIG_PATH: process.env.CONFIG_PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  };

  const E2E_EMAIL_DOMAIN = '@roles.e2e.test';
  const testEmail = (label: string) =>
    `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}${E2E_EMAIL_DOMAIN}`;

  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.CONFIG_PATH = fixture('e2e.config.yml');
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
    const memberships = await prisma.membership.findMany({ where: { userId: { in: userIds } } });
    const householdIds = [...new Set(memberships.map((membership) => membership.householdId))];
    const children = await prisma.child.findMany({ where: { householdId: { in: householdIds } } });
    const childIds = children.map((child) => child.id);

    await prisma.notificationSettings.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.healthRecord.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.milestone.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.growthMeasurement.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.event.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.invite.deleteMany({ where: { householdId: { in: householdIds } } });
    await prisma.child.deleteMany({ where: { householdId: { in: householdIds } } });
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
    return {
      userId: response.body.user.id,
      email,
      cookies: cookieHeaderFrom(setCookie),
      csrfToken: cookieValue(findSetCookie(setCookie, CSRF_COOKIE_NAME))!,
    };
  }

  /** Authenticated request builders — every write also needs the CSRF header. */
  const get = (user: AuthenticatedTestUser, url: string) =>
    request(app.getHttpServer()).get(url).set('Cookie', user.cookies);
  const post = (user: AuthenticatedTestUser, url: string) =>
    request(app.getHttpServer())
      .post(url)
      .set('Cookie', user.cookies)
      .set(CSRF_HEADER_NAME, user.csrfToken);
  const patch = (user: AuthenticatedTestUser, url: string) =>
    request(app.getHttpServer())
      .patch(url)
      .set('Cookie', user.cookies)
      .set(CSRF_HEADER_NAME, user.csrfToken);
  const put = (user: AuthenticatedTestUser, url: string) =>
    request(app.getHttpServer())
      .put(url)
      .set('Cookie', user.cookies)
      .set(CSRF_HEADER_NAME, user.csrfToken);
  const del = (user: AuthenticatedTestUser, url: string) =>
    request(app.getHttpServer())
      .delete(url)
      .set('Cookie', user.cookies)
      .set(CSRF_HEADER_NAME, user.csrfToken);

  interface Fixture {
    householdId: string;
    childId: string;
    owner: AuthenticatedTestUser;
    coParent: AuthenticatedTestUser;
    caregiver: AuthenticatedTestUser;
    observer: AuthenticatedTestUser;
    outsider: AuthenticatedTestUser;
  }

  /**
   * One household + child owned by `owner`, with one member per role and one
   * unrelated user. The three non-owner memberships are seeded straight
   * through Prisma: going via an invite would work too, but would make every
   * test depend on the invite flow staying green.
   */
  async function seedHousehold(label: string): Promise<Fixture> {
    const owner = await registerUser(`${label}-owner`);

    const household = await post(owner, '/api/households')
      .send({ name: 'Roles Household' })
      .expect(201);
    const householdId = household.body.id as string;

    const child = await post(owner, `/api/households/${householdId}/children`)
      .field('name', 'Mia')
      .field('birthDate', BIRTH_DATE)
      .expect(201);

    const [coParent, caregiver, observer, outsider] = await Promise.all([
      registerUser(`${label}-co-parent`),
      registerUser(`${label}-caregiver`),
      registerUser(`${label}-observer`),
      registerUser(`${label}-outsider`),
    ]);

    await prisma.membership.createMany({
      data: [
        { userId: coParent.userId, householdId, role: HouseholdRole.CO_PARENT },
        { userId: caregiver.userId, householdId, role: HouseholdRole.CAREGIVER },
        { userId: observer.userId, householdId, role: HouseholdRole.OBSERVER },
      ],
    });

    return {
      householdId,
      childId: child.body.id as string,
      owner,
      coParent,
      caregiver,
      observer,
      outsider,
    };
  }

  const childScope = (f: Fixture) => `/api/households/${f.householdId}/children/${f.childId}`;

  /** Creates a feeding event as `author` and returns its id. */
  async function createFeedingEvent(f: Fixture, author: AuthenticatedTestUser): Promise<string> {
    const response = await post(author, `${childScope(f)}/feeding-events`)
      .send({ feedingType: 'SOLID' })
      .expect(201);
    return response.body.id as string;
  }

  describe('reading data', () => {
    it('is open to every role, and hidden from non-members (ROL-4)', async () => {
      const f = await seedHousehold('read');

      for (const member of [f.owner, f.coParent, f.caregiver, f.observer]) {
        await get(member, `/api/households/${f.householdId}/children`).expect(200);
        await get(member, `${childScope(f)}/events/daily${DAY_RANGE}`).expect(200);
      }

      // A non-member cannot even distinguish "forbidden" from "does not exist".
      await get(f.outsider, `/api/households/${f.householdId}/children`).expect(404);
      await get(f.outsider, `${childScope(f)}/events/daily${DAY_RANGE}`).expect(404);
    });
  });

  describe('recording entries', () => {
    it.each([
      ['feeding-events', { feedingType: 'SOLID' }],
      // Backfilled rather than a running timer: only one sleep timer may run
      // per child, so three open-ended creates would collide with a 409.
      [
        'sleep-events',
        { startedAt: '2025-08-20T20:00:00.000Z', endedAt: '2025-08-21T06:00:00.000Z' },
      ],
      ['diaper-events', { diaperType: 'PEE' }],
      ['growth', { measuredAt: MEASURED_AT, weightGrams: 6400 }],
      ['milestones', { title: 'Erste Zugfahrt', achievedAt: ACHIEVED_AT }],
      [
        'health-records',
        { kind: 'MEDICATION', name: 'Vitamin D', administeredAt: ADMINISTERED_AT },
      ],
    ])('lets OWNER, CO_PARENT and CAREGIVER create %s', async (segment, body) => {
      const f = await seedHousehold(`create-${segment}`);

      for (const member of [f.owner, f.coParent, f.caregiver]) {
        await post(member, `${childScope(f)}/${segment}`)
          .send(body)
          .expect(201);
      }

      await post(f.observer, `${childScope(f)}/${segment}`)
        .send(body)
        .expect(403);
      await post(f.outsider, `${childScope(f)}/${segment}`)
        .send(body)
        .expect(404);
    });
  });

  describe('editing entries', () => {
    it('lets a CAREGIVER edit their own entry', async () => {
      const f = await seedHousehold('edit-own');
      const eventId = await createFeedingEvent(f, f.caregiver);

      await patch(f.caregiver, `${childScope(f)}/feeding-events/${eventId}`)
        .send({ note: 'mine' })
        .expect(200);
    });

    it("refuses a CAREGIVER editing another member's entry, while OWNER/CO_PARENT may", async () => {
      const f = await seedHousehold('edit-foreign');
      const eventId = await createFeedingEvent(f, f.owner);

      await patch(f.caregiver, `${childScope(f)}/feeding-events/${eventId}`)
        .send({ note: 'not mine' })
        .expect(403);
      await patch(f.observer, `${childScope(f)}/feeding-events/${eventId}`)
        .send({ note: 'read only' })
        .expect(403);
      await patch(f.outsider, `${childScope(f)}/feeding-events/${eventId}`)
        .send({ note: 'stranger' })
        .expect(404);

      await patch(f.coParent, `${childScope(f)}/feeding-events/${eventId}`)
        .send({ note: 'allowed' })
        .expect(200);
      await patch(f.owner, `${childScope(f)}/feeding-events/${eventId}`)
        .send({ note: 'also allowed' })
        .expect(200);
    });

    it('reports an ownership refusal as NOT_ENTRY_OWNER', async () => {
      const f = await seedHousehold('edit-code');
      const eventId = await createFeedingEvent(f, f.owner);

      const response = await patch(f.caregiver, `${childScope(f)}/feeding-events/${eventId}`)
        .send({ note: 'not mine' })
        .expect(403);

      expect(response.body).toMatchObject({ code: 'NOT_ENTRY_OWNER' });
    });

    it("lets a CAREGIVER stop another member's sleep timer (shift hand-off)", async () => {
      const f = await seedHousehold('stop-timer');
      const started = await post(f.owner, `${childScope(f)}/sleep-events`)
        .send({})
        .expect(201);

      // Stopping counts as recording, not as editing a foreign entry: leaving
      // the timer running until whoever started it returns would corrupt the
      // recorded duration.
      // 201, not 200: `/stop` is a POST and carries no explicit `@HttpCode`.
      await post(f.caregiver, `${childScope(f)}/sleep-events/${started.body.id}/stop`)
        .send({})
        .expect(201);
    });

    it('still refuses an OBSERVER stopping a timer', async () => {
      const f = await seedHousehold('stop-timer-observer');
      const started = await post(f.owner, `${childScope(f)}/sleep-events`)
        .send({})
        .expect(201);

      await post(f.observer, `${childScope(f)}/sleep-events/${started.body.id}/stop`)
        .send({})
        .expect(403);
      await post(f.outsider, `${childScope(f)}/sleep-events/${started.body.id}/stop`)
        .send({})
        .expect(404);
    });
  });

  describe('marking a planned health record as done (MED-5)', () => {
    /** A planned vaccination recorded by the owner, awaiting administration. */
    async function planVaccination(f: Fixture): Promise<string> {
      const planned = await post(f.owner, `${childScope(f)}/health-records`)
        .send({ kind: 'VACCINATION', name: '6-fach-Impfung', dueAt: '2025-09-01' })
        .expect(201);
      return planned.body.id as string;
    }

    it("lets a CAREGIVER tick off another member's planned entry", async () => {
      const f = await seedHousehold('mark-done');
      const recordId = await planVaccination(f);

      await patch(f.caregiver, `${childScope(f)}/health-records/${recordId}`)
        .send({ administeredAt: ADMINISTERED_AT })
        .expect(200);
    });

    it("refuses a CAREGIVER changing any other field of another member's entry", async () => {
      const f = await seedHousehold('mark-done-scope');
      const recordId = await planVaccination(f);

      await patch(f.caregiver, `${childScope(f)}/health-records/${recordId}`)
        .send({ name: 'Renamed' })
        .expect(403);
      // Not even piggybacked onto the mark-as-done itself.
      await patch(f.caregiver, `${childScope(f)}/health-records/${recordId}`)
        .send({ administeredAt: ADMINISTERED_AT, note: 'sneaky' })
        .expect(403);
    });

    it('still refuses an OBSERVER', async () => {
      const f = await seedHousehold('mark-done-observer');
      const recordId = await planVaccination(f);

      await patch(f.observer, `${childScope(f)}/health-records/${recordId}`)
        .send({ administeredAt: ADMINISTERED_AT })
        .expect(403);
    });
  });

  describe('deleting entries', () => {
    it('is limited to OWNER and CO_PARENT, even for the caregiver’s own entry', async () => {
      const f = await seedHousehold('delete');
      const ownEventId = await createFeedingEvent(f, f.caregiver);

      // Deliberately strict: a caregiver may correct their own mistake by
      // editing, but never make a record disappear.
      await del(f.caregiver, `${childScope(f)}/feeding-events/${ownEventId}`).expect(403);
      await del(f.observer, `${childScope(f)}/feeding-events/${ownEventId}`).expect(403);
      await del(f.outsider, `${childScope(f)}/feeding-events/${ownEventId}`).expect(404);

      await del(f.coParent, `${childScope(f)}/feeding-events/${ownEventId}`).expect(204);

      const otherEventId = await createFeedingEvent(f, f.owner);
      await del(f.owner, `${childScope(f)}/feeding-events/${otherEventId}`).expect(204);
    });

    it('limits milestone photo deletion to OWNER and CO_PARENT', async () => {
      const f = await seedHousehold('delete-photo');
      const milestone = await post(f.caregiver, `${childScope(f)}/milestones`)
        .send({ title: 'Erste Zugfahrt', achievedAt: ACHIEVED_AT })
        .expect(201);

      // No photo needs to exist: the role check runs in the guard, before the
      // handler ever looks the photo up.
      await del(
        f.caregiver,
        `${childScope(f)}/milestones/${milestone.body.id}/photos/does-not-exist`,
      ).expect(403);
      await del(
        f.outsider,
        `${childScope(f)}/milestones/${milestone.body.id}/photos/does-not-exist`,
      ).expect(404);
      // Past the role check, so it fails on the missing photo rather than 403.
      await del(
        f.coParent,
        `${childScope(f)}/milestones/${milestone.body.id}/photos/does-not-exist`,
      ).expect(404);
    });
  });

  describe('managing child profiles', () => {
    it('is limited to OWNER and CO_PARENT', async () => {
      const f = await seedHousehold('children');

      for (const member of [f.caregiver, f.observer]) {
        await post(member, `/api/households/${f.householdId}/children`)
          .field('name', 'Nope')
          .field('birthDate', BIRTH_DATE)
          .expect(403);
        await patch(member, childScope(f)).field('name', 'Renamed').expect(403);
        await del(member, childScope(f)).expect(403);
      }

      await post(f.outsider, `/api/households/${f.householdId}/children`)
        .field('name', 'Nope')
        .field('birthDate', BIRTH_DATE)
        .expect(404);

      // CO_PARENT may now create/delete children too, which was OWNER-only
      // before Phase 7.5 (see the child controller's doc comment).
      await patch(f.coParent, childScope(f)).field('name', 'Renamed').expect(200);
      const created = await post(f.coParent, `/api/households/${f.householdId}/children`)
        .field('name', 'Sibling')
        .field('birthDate', BIRTH_DATE)
        .expect(201);
      await del(f.coParent, `/api/households/${f.householdId}/children/${created.body.id}`).expect(
        204,
      );
    });
  });

  describe('exporting', () => {
    it('is open to OWNER, CO_PARENT and CAREGIVER but not OBSERVER', async () => {
      const f = await seedHousehold('export');

      for (const member of [f.owner, f.coParent, f.caregiver]) {
        await get(member, `${childScope(f)}/export/csv`).expect(200);
        await get(member, `${childScope(f)}/export/json`).expect(200);
      }

      // The one read that is role-scoped: an export bundles a child's whole
      // history into a file the observer has no business carrying off.
      await get(f.observer, `${childScope(f)}/export/csv`).expect(403);
      await get(f.outsider, `${childScope(f)}/export/csv`).expect(404);
    });
  });

  describe('own notification settings', () => {
    it('are writable by every role, including OBSERVER', async () => {
      const f = await seedHousehold('notifications');

      for (const member of [f.owner, f.coParent, f.caregiver, f.observer]) {
        await put(member, `${childScope(f)}/notification-settings`)
          .send(NOTIFICATION_SETTINGS)
          .expect(200);
      }

      await put(f.outsider, `${childScope(f)}/notification-settings`)
        .send(NOTIFICATION_SETTINGS)
        .expect(404);
    });

    it('stay per-user: writing one member’s settings never touches another’s', async () => {
      const f = await seedHousehold('notifications-scope');

      await put(f.observer, `${childScope(f)}/notification-settings`)
        .send({ ...NOTIFICATION_SETTINGS, dailySummaryEnabled: false })
        .expect(200);

      const ownerSettings = await get(f.owner, `${childScope(f)}/notification-settings`).expect(
        200,
      );
      expect(ownerSettings.body.dailySummaryEnabled).toBe(true);
    });
  });

  describe('household administration', () => {
    it('is limited to OWNER', async () => {
      const f = await seedHousehold('admin');

      for (const member of [f.coParent, f.caregiver, f.observer]) {
        await post(member, `/api/households/${f.householdId}/invites`).send({}).expect(403);
        await patch(member, `/api/households/${f.householdId}/members/${f.observer.userId}`)
          .send({ role: HouseholdRole.CO_PARENT })
          .expect(403);
        await del(member, `/api/households/${f.householdId}/members/${f.observer.userId}`).expect(
          403,
        );
      }

      await post(f.outsider, `/api/households/${f.householdId}/invites`).send({}).expect(404);
    });

    it('lets an OWNER invite with an explicit role, and rejects inviting an OWNER (ROL-8)', async () => {
      const f = await seedHousehold('invite-role');

      await post(f.owner, `/api/households/${f.householdId}/invites`)
        .send({ role: HouseholdRole.CAREGIVER })
        .expect(201);
      // Body-less invites still work and still mean CO_PARENT.
      await post(f.owner, `/api/households/${f.householdId}/invites`).send({}).expect(201);

      await post(f.owner, `/api/households/${f.householdId}/invites`)
        .send({ role: HouseholdRole.OWNER })
        .expect(400);
    });

    it('lists members with name, role and joining date (ROL-9)', async () => {
      const f = await seedHousehold('members-list');

      const response = await get(f.observer, `/api/households/${f.householdId}/members`).expect(
        200,
      );

      expect(response.body).toHaveLength(4);
      expect(response.body).toContainEqual({
        userId: f.caregiver.userId,
        email: f.caregiver.email,
        name: 'E2E Tester',
        role: HouseholdRole.CAREGIVER,
        joinedAt: expect.any(String),
      });
    });
  });

  describe('changing a member’s role', () => {
    it('takes effect on the very next request, with no re-login (ROL-5)', async () => {
      const f = await seedHousehold('role-change');

      await post(f.caregiver, `${childScope(f)}/feeding-events`)
        .send({ feedingType: 'SOLID' })
        .expect(201);

      await patch(f.owner, `/api/households/${f.householdId}/members/${f.caregiver.userId}`)
        .send({ role: HouseholdRole.OBSERVER })
        .expect(200);

      // Same cookies, same access token — the role is read from the DB on
      // every request, never cached in the session.
      await post(f.caregiver, `${childScope(f)}/feeding-events`)
        .send({ feedingType: 'SOLID' })
        .expect(403);
    });

    it('refuses to change or remove the caller’s own membership (ROL-7)', async () => {
      const f = await seedHousehold('self');

      const roleChange = await patch(
        f.owner,
        `/api/households/${f.householdId}/members/${f.owner.userId}`,
      )
        .send({ role: HouseholdRole.CO_PARENT })
        .expect(403);
      expect(roleChange.body).toMatchObject({ code: 'CANNOT_CHANGE_OWN_ROLE' });

      const removal = await del(
        f.owner,
        `/api/households/${f.householdId}/members/${f.owner.userId}`,
      ).expect(403);
      expect(removal.body).toMatchObject({ code: 'CANNOT_REMOVE_SELF' });
    });

    it('404s for a user who is not a member of this household', async () => {
      const f = await seedHousehold('unknown-member');

      await patch(f.owner, `/api/households/${f.householdId}/members/${f.outsider.userId}`)
        .send({ role: HouseholdRole.OBSERVER })
        .expect(404);
      await del(f.owner, `/api/households/${f.householdId}/members/${f.outsider.userId}`).expect(
        404,
      );
    });

    /**
     * ROL-6 — "the last owner can be neither demoted nor removed" is enforced
     * by `assertLastOwnerSurvives`, which re-counts owners *inside* the same
     * transaction as the demotion/removal it guards. That is what makes it
     * hold under concurrency: two owners demoting each other simultaneously
     * would otherwise both read two owners and both commit.
     *
     * Reaching the resulting 409 over HTTP takes a race these sequential tests
     * cannot stage — the transactional guard is covered directly in
     * `household.service.spec.ts` (including the count-before-write ordering).
     * What the tests below assert is the user-visible guarantee: ownership
     * survives every legal single-request sequence, and a sole owner has no
     * route to strip the household of its last one.
     */
    it('always leaves the household with at least one owner (ROL-6)', async () => {
      const f = await seedHousehold('last-owner');

      // Sharing ownership, then handing it over entirely.
      await patch(f.owner, `/api/households/${f.householdId}/members/${f.coParent.userId}`)
        .send({ role: HouseholdRole.OWNER })
        .expect(200);
      await patch(f.coParent, `/api/households/${f.householdId}/members/${f.owner.userId}`)
        .send({ role: HouseholdRole.CO_PARENT })
        .expect(200);

      const members = await get(f.coParent, `/api/households/${f.householdId}/members`).expect(200);
      const owners = (members.body as { role: string }[]).filter(
        (member) => member.role === HouseholdRole.OWNER,
      );
      expect(owners).toHaveLength(1);
    });

    it('leaves the sole owner with no way to demote or remove themselves', async () => {
      const f = await seedHousehold('sole-owner');

      // The former owner is now an ordinary member and cannot administer.
      await patch(f.owner, `/api/households/${f.householdId}/members/${f.coParent.userId}`)
        .send({ role: HouseholdRole.OWNER })
        .expect(200);
      await patch(f.coParent, `/api/households/${f.householdId}/members/${f.owner.userId}`)
        .send({ role: HouseholdRole.CO_PARENT })
        .expect(200);

      // `f.coParent` is the sole owner: it may not target itself (ROL-7)...
      await patch(f.coParent, `/api/households/${f.householdId}/members/${f.coParent.userId}`)
        .send({ role: HouseholdRole.CO_PARENT })
        .expect(403);
      await del(f.coParent, `/api/households/${f.householdId}/members/${f.coParent.userId}`).expect(
        403,
      );

      // ...and nobody else has the role needed to target it.
      await patch(f.owner, `/api/households/${f.householdId}/members/${f.coParent.userId}`)
        .send({ role: HouseholdRole.CO_PARENT })
        .expect(403);
      await del(f.owner, `/api/households/${f.householdId}/members/${f.coParent.userId}`).expect(
        403,
      );
    });
  });

  describe('removing a member', () => {
    it('drops their access immediately', async () => {
      const f = await seedHousehold('remove-member');

      await get(f.caregiver, `/api/households/${f.householdId}/children`).expect(200);

      await del(f.owner, `/api/households/${f.householdId}/members/${f.caregiver.userId}`).expect(
        204,
      );

      // Back to being an outsider: 404, not 403.
      await get(f.caregiver, `/api/households/${f.householdId}/children`).expect(404);
    });
  });
});
