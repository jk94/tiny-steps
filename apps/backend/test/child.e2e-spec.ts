import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../src/auth/guards/csrf.guard';
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

interface ChildResponseBody {
  id: string;
  householdId: string;
  name: string;
  birthDate: string;
  hasPhoto: boolean;
  createdAt: string;
}

describe('Child profiles (e2e)', () => {
  const originalEnv = {
    CONFIG_PATH: process.env.CONFIG_PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    UPLOADS_DIR: process.env.UPLOADS_DIR,
  };

  // Distinct domain so this suite's afterEach cleanup can't race with/delete
  // rows created by other e2e spec files running concurrently (mirrors
  // household.e2e-spec.ts).
  const E2E_EMAIL_DOMAIN = '@child.e2e.test';
  const testEmail = (label: string) =>
    `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}${E2E_EMAIL_DOMAIN}`;

  let app: INestApplication<App>;
  let prisma: PrismaService;
  let uploadsDir: string;

  let validPhoto: Buffer;
  let validPhoto2: Buffer;

  beforeAll(async () => {
    process.env.CONFIG_PATH = fixture('e2e.config.yml');
    // Reuses the real dev SQLite DB (already migrated), like the other e2e
    // suites — rows created here are cleaned up in afterEach.
    process.env.DATABASE_URL = 'file:./prisma/dev.db';
    process.env.JWT_ACCESS_SECRET = 'e2e-test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'e2e-test-refresh-secret';
    // A dedicated temp directory (not the dev-server default) so this
    // suite's uploaded files never touch real dev data and can be wiped
    // wholesale in afterAll, regardless of individual test outcomes.
    uploadsDir = await mkdtemp(join(tmpdir(), 'child-e2e-uploads-'));
    process.env.UPLOADS_DIR = uploadsDir;

    validPhoto = await readFile(fixture('valid-photo.png'));
    validPhoto2 = await readFile(fixture('valid-photo-2.png'));

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
    await rm(uploadsDir, { recursive: true, force: true });
    process.env.CONFIG_PATH = originalEnv.CONFIG_PATH;
    process.env.DATABASE_URL = originalEnv.DATABASE_URL;
    process.env.JWT_ACCESS_SECRET = originalEnv.JWT_ACCESS_SECRET;
    process.env.JWT_REFRESH_SECRET = originalEnv.JWT_REFRESH_SECRET;
    process.env.UPLOADS_DIR = originalEnv.UPLOADS_DIR;
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

    // Collect photo file paths before deleting the Child rows that
    // reference them, so leftover files on disk can be swept up too
    // (best-effort — this suite's uploadsDir is wiped wholesale in
    // afterAll regardless, but this keeps state minimal between tests).
    const children = await prisma.child.findMany({ where: { householdId: { in: householdIds } } });
    await Promise.all(
      children
        .filter((child) => child.photoPath !== null)
        .map((child) => rm(join(uploadsDir, child.photoPath!), { force: true })),
    );

    // FK order: Invite/Child/Membership -> Household, RefreshToken -> User.
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

  async function addCoParent(owner: AuthenticatedTestUser, householdId: string, label: string) {
    const inviteResponse = await request(app.getHttpServer())
      .post(`/api/households/${householdId}/invites`)
      .set('Cookie', owner.cookies)
      .set(CSRF_HEADER_NAME, owner.csrfToken)
      .expect(201);
    const invite = inviteResponse.body as { token: string };

    const coParent = await registerUser(label);
    await request(app.getHttpServer())
      .post(`/api/invites/${invite.token}/accept`)
      .set('Cookie', coParent.cookies)
      .set(CSRF_HEADER_NAME, coParent.csrfToken)
      .expect(200);

    return coParent;
  }

  function createChildRequest(
    user: AuthenticatedTestUser,
    householdId: string,
    fields: { name?: string; birthDate?: string },
  ) {
    let req = request(app.getHttpServer())
      .post(`/api/households/${householdId}/children`)
      .set('Cookie', user.cookies)
      .set(CSRF_HEADER_NAME, user.csrfToken);
    if (fields.name !== undefined) req = req.field('name', fields.name);
    if (fields.birthDate !== undefined) req = req.field('birthDate', fields.birthDate);
    return req;
  }

  function updateChildRequest(
    user: AuthenticatedTestUser,
    householdId: string,
    childId: string,
    fields: { name?: string; birthDate?: string },
  ) {
    let req = request(app.getHttpServer())
      .patch(`/api/households/${householdId}/children/${childId}`)
      .set('Cookie', user.cookies)
      .set(CSRF_HEADER_NAME, user.csrfToken);
    if (fields.name !== undefined) req = req.field('name', fields.name);
    if (fields.birthDate !== undefined) req = req.field('birthDate', fields.birthDate);
    return req;
  }

  it('lets an Owner create a child with no photo, visible to a Co-Parent', async () => {
    const owner = await registerUser('create-owner');
    const household = await createHousehold(owner, 'Create Household');

    const response = await createChildRequest(owner, household.id, {
      name: 'Mia',
      birthDate: '2023-05-01T00:00:00.000Z',
    }).expect(201);

    const child = response.body as ChildResponseBody;
    expect(child).toEqual({
      id: expect.any(String),
      householdId: household.id,
      name: 'Mia',
      birthDate: '2023-05-01T00:00:00.000Z',
      hasPhoto: false,
      createdAt: expect.any(String),
    });

    const coParent = await addCoParent(owner, household.id, 'create-co-parent');
    const listResponse = await request(app.getHttpServer())
      .get(`/api/households/${household.id}/children`)
      .set('Cookie', coParent.cookies)
      .expect(200);
    expect(listResponse.body).toEqual([expect.objectContaining({ id: child.id, name: 'Mia' })]);
  });

  it('lets an Owner create a child with a valid photo, retrievable byte-for-byte via the photo endpoint', async () => {
    const owner = await registerUser('photo-owner');
    const household = await createHousehold(owner, 'Photo Household');

    const response = await createChildRequest(owner, household.id, {
      name: 'Noah',
      birthDate: '2022-03-15T00:00:00.000Z',
    })
      .attach('photo', validPhoto, { filename: 'photo.png', contentType: 'image/png' })
      .expect(201);

    const child = response.body as ChildResponseBody;
    expect(child.hasPhoto).toBe(true);

    const photoResponse = await request(app.getHttpServer())
      .get(`/api/households/${household.id}/children/${child.id}/photo`)
      .set('Cookie', owner.cookies)
      .expect(200);
    expect(photoResponse.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(photoResponse.body as Buffer, validPhoto)).toBe(0);
  });

  it('replaces an existing photo on PATCH, old file gone, new file served', async () => {
    const owner = await registerUser('replace-owner');
    const household = await createHousehold(owner, 'Replace Household');

    const createResponse = await createChildRequest(owner, household.id, {
      name: 'Ella',
      birthDate: '2021-07-20T00:00:00.000Z',
    })
      .attach('photo', validPhoto, { filename: 'photo.png', contentType: 'image/png' })
      .expect(201);
    const child = createResponse.body as ChildResponseBody;

    const oldChildRow = await prisma.child.findUniqueOrThrow({ where: { id: child.id } });
    const oldPhotoPath = oldChildRow.photoPath!;

    await updateChildRequest(owner, household.id, child.id, {})
      .attach('photo', validPhoto2, { filename: 'photo2.png', contentType: 'image/png' })
      .expect(200);

    const photoResponse = await request(app.getHttpServer())
      .get(`/api/households/${household.id}/children/${child.id}/photo`)
      .set('Cookie', owner.cookies)
      .expect(200);
    expect(Buffer.compare(photoResponse.body as Buffer, validPhoto2)).toBe(0);

    const updatedChildRow = await prisma.child.findUniqueOrThrow({ where: { id: child.id } });
    expect(updatedChildRow.photoPath).not.toBe(oldPhotoPath);

    // Best-effort check: the old file should no longer exist on disk.
    await expect(readFile(join(uploadsDir, oldPhotoPath))).rejects.toThrow();
    // The new file does exist.
    await expect(readFile(join(uploadsDir, updatedChildRow.photoPath!))).resolves.toBeInstanceOf(
      Buffer,
    );
  });

  it('PATCH with only text fields leaves an existing photo untouched', async () => {
    const owner = await registerUser('textonly-owner');
    const household = await createHousehold(owner, 'Text Only Household');

    const createResponse = await createChildRequest(owner, household.id, {
      name: 'Leo',
      birthDate: '2020-01-01T00:00:00.000Z',
    })
      .attach('photo', validPhoto, { filename: 'photo.png', contentType: 'image/png' })
      .expect(201);
    const child = createResponse.body as ChildResponseBody;
    const beforeRow = await prisma.child.findUniqueOrThrow({ where: { id: child.id } });

    const updateResponse = await updateChildRequest(owner, household.id, child.id, {
      name: 'Leo Renamed',
    }).expect(200);
    expect((updateResponse.body as ChildResponseBody).name).toBe('Leo Renamed');
    expect((updateResponse.body as ChildResponseBody).hasPhoto).toBe(true);

    const afterRow = await prisma.child.findUniqueOrThrow({ where: { id: child.id } });
    expect(afterRow.photoPath).toBe(beforeRow.photoPath);
  });

  it('Co-Parent cannot create or delete, but CAN update including replacing a photo', async () => {
    // Key reconciliation case: the roadmap checklist says "bearbeiten/löschen
    // (nur Owner)", but this phase's Definition of Done says "Co-Parent kann
    // Kind-Profile lesen/bearbeiten aber keine Nutzer verwalten" — edit is
    // allowed for Co-Parent, only create/delete are Owner-only. See ADR-0003.
    const owner = await registerUser('reconcile-owner');
    const household = await createHousehold(owner, 'Reconcile Household');
    const coParent = await addCoParent(owner, household.id, 'reconcile-co-parent');

    await createChildRequest(coParent, household.id, {
      name: 'Should Not Exist',
      birthDate: '2020-01-01T00:00:00.000Z',
    }).expect(403);

    const createResponse = await createChildRequest(owner, household.id, {
      name: 'Sam',
      birthDate: '2020-01-01T00:00:00.000Z',
    }).expect(201);
    const child = createResponse.body as ChildResponseBody;

    const updateResponse = await updateChildRequest(coParent, household.id, child.id, {
      name: 'Sam Updated',
    })
      .attach('photo', validPhoto, { filename: 'photo.png', contentType: 'image/png' })
      .expect(200);
    expect((updateResponse.body as ChildResponseBody).name).toBe('Sam Updated');
    expect((updateResponse.body as ChildResponseBody).hasPhoto).toBe(true);

    await request(app.getHttpServer())
      .delete(`/api/households/${household.id}/children/${child.id}`)
      .set('Cookie', coParent.cookies)
      .set(CSRF_HEADER_NAME, coParent.csrfToken)
      .expect(403);
  });

  it('returns 404 on all six routes for a user with no membership in the household', async () => {
    const owner = await registerUser('nomember-owner');
    const household = await createHousehold(owner, 'No Member Household');
    const createResponse = await createChildRequest(owner, household.id, {
      name: 'Kim',
      birthDate: '2020-01-01T00:00:00.000Z',
    }).expect(201);
    const child = createResponse.body as ChildResponseBody;

    const outsider = await registerUser('nomember-outsider');

    await createChildRequest(outsider, household.id, {
      name: 'X',
      birthDate: '2020-01-01T00:00:00.000Z',
    }).expect(404);
    await request(app.getHttpServer())
      .get(`/api/households/${household.id}/children`)
      .set('Cookie', outsider.cookies)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/households/${household.id}/children/${child.id}`)
      .set('Cookie', outsider.cookies)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/households/${household.id}/children/${child.id}/photo`)
      .set('Cookie', outsider.cookies)
      .expect(404);
    await updateChildRequest(outsider, household.id, child.id, { name: 'X' }).expect(404);
    await request(app.getHttpServer())
      .delete(`/api/households/${household.id}/children/${child.id}`)
      .set('Cookie', outsider.cookies)
      .set(CSRF_HEADER_NAME, outsider.csrfToken)
      .expect(404);
  });

  it('does not allow accessing/updating/deleting a child from household A via household B', async () => {
    const ownerA = await registerUser('crosshh-owner-a');
    const householdA = await createHousehold(ownerA, 'Household A');
    const createResponse = await createChildRequest(ownerA, householdA.id, {
      name: 'FromA',
      birthDate: '2020-01-01T00:00:00.000Z',
    }).expect(201);
    const child = createResponse.body as ChildResponseBody;

    const ownerB = await registerUser('crosshh-owner-b');
    const householdB = await createHousehold(ownerB, 'Household B');

    await request(app.getHttpServer())
      .get(`/api/households/${householdB.id}/children/${child.id}`)
      .set('Cookie', ownerB.cookies)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/households/${householdB.id}/children/${child.id}/photo`)
      .set('Cookie', ownerB.cookies)
      .expect(404);
    await updateChildRequest(ownerB, householdB.id, child.id, { name: 'Hijacked' }).expect(404);
    await request(app.getHttpServer())
      .delete(`/api/households/${householdB.id}/children/${child.id}`)
      .set('Cookie', ownerB.cookies)
      .set(CSRF_HEADER_NAME, ownerB.csrfToken)
      .expect(404);
  });

  it('supports multiple children (siblings) per household, correctly scoped', async () => {
    const owner = await registerUser('siblings-owner');
    const household = await createHousehold(owner, 'Siblings Household');
    const otherOwner = await registerUser('siblings-other-owner');
    const otherHousehold = await createHousehold(otherOwner, 'Other Household');

    await createChildRequest(owner, household.id, {
      name: 'Sibling One',
      birthDate: '2018-01-01T00:00:00.000Z',
    }).expect(201);
    await createChildRequest(owner, household.id, {
      name: 'Sibling Two',
      birthDate: '2020-01-01T00:00:00.000Z',
    }).expect(201);
    await createChildRequest(otherOwner, otherHousehold.id, {
      name: 'Unrelated Child',
      birthDate: '2019-01-01T00:00:00.000Z',
    }).expect(201);

    const listResponse = await request(app.getHttpServer())
      .get(`/api/households/${household.id}/children`)
      .set('Cookie', owner.cookies)
      .expect(200);

    const names = (listResponse.body as ChildResponseBody[]).map((child) => child.name).sort();
    expect(names).toEqual(['Sibling One', 'Sibling Two']);
  });

  describe('validation', () => {
    it('rejects a missing name with 400', async () => {
      const owner = await registerUser('validation-name-owner');
      const household = await createHousehold(owner, 'Validation Name Household');

      await createChildRequest(owner, household.id, {
        birthDate: '2020-01-01T00:00:00.000Z',
      }).expect(400);
    });

    it('rejects a future birthDate with 400', async () => {
      const owner = await registerUser('validation-future-owner');
      const household = await createHousehold(owner, 'Validation Future Household');
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await createChildRequest(owner, household.id, {
        name: 'Future Kid',
        birthDate: future,
      }).expect(400);
    });

    it('rejects a photo whose real content does not match its declared mime type with 400', async () => {
      const owner = await registerUser('validation-mime-owner');
      const household = await createHousehold(owner, 'Validation Mime Household');

      await createChildRequest(owner, household.id, {
        name: 'Fake Photo Kid',
        birthDate: '2020-01-01T00:00:00.000Z',
      })
        .attach('photo', Buffer.from('this is not actually an image'), {
          filename: 'fake.gif',
          contentType: 'image/gif',
        })
        .expect(400);
    });

    it('rejects an oversized photo with 400', async () => {
      const owner = await registerUser('validation-size-owner');
      const household = await createHousehold(owner, 'Validation Size Household');
      const oversized = Buffer.alloc(3 * 1024 * 1024, 1);

      await createChildRequest(owner, household.id, {
        name: 'Big Photo Kid',
        birthDate: '2020-01-01T00:00:00.000Z',
      })
        .attach('photo', oversized, { filename: 'big.png', contentType: 'image/png' })
        .expect(400);
    });
  });

  it('returns 404 for GET .../photo on a child with no photo', async () => {
    const owner = await registerUser('nophoto-owner');
    const household = await createHousehold(owner, 'No Photo Household');
    const createResponse = await createChildRequest(owner, household.id, {
      name: 'Plain Kid',
      birthDate: '2020-01-01T00:00:00.000Z',
    }).expect(201);
    const child = createResponse.body as ChildResponseBody;

    await request(app.getHttpServer())
      .get(`/api/households/${household.id}/children/${child.id}/photo`)
      .set('Cookie', owner.cookies)
      .expect(404);
  });

  describe('CSRF', () => {
    it('rejects a missing/mismatched CSRF header on create/update/delete, including multipart requests', async () => {
      const owner = await registerUser('csrf-owner');
      const household = await createHousehold(owner, 'CSRF Household');

      await request(app.getHttpServer())
        .post(`/api/households/${household.id}/children`)
        .set('Cookie', owner.cookies)
        .field('name', 'No CSRF Kid')
        .field('birthDate', '2020-01-01T00:00:00.000Z')
        .expect(403);

      const createResponse = await createChildRequest(owner, household.id, {
        name: 'CSRF Kid',
        birthDate: '2020-01-01T00:00:00.000Z',
      }).expect(201);
      const child = createResponse.body as ChildResponseBody;

      await request(app.getHttpServer())
        .patch(`/api/households/${household.id}/children/${child.id}`)
        .set('Cookie', owner.cookies)
        .set(CSRF_HEADER_NAME, 'not-the-real-csrf-token')
        .field('name', 'Renamed')
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/api/households/${household.id}/children/${child.id}`)
        .set('Cookie', owner.cookies)
        .expect(403);
    });
  });

  describe('session', () => {
    it('rejects a missing/invalid session with 401 on all state-changing routes', async () => {
      const owner = await registerUser('session-owner');
      const household = await createHousehold(owner, 'Session Household');
      const createResponse = await createChildRequest(owner, household.id, {
        name: 'Session Kid',
        birthDate: '2020-01-01T00:00:00.000Z',
      }).expect(201);
      const child = createResponse.body as ChildResponseBody;

      await request(app.getHttpServer())
        .post(`/api/households/${household.id}/children`)
        .field('name', 'X')
        .field('birthDate', '2020-01-01T00:00:00.000Z')
        .expect(401);
      await request(app.getHttpServer())
        .patch(`/api/households/${household.id}/children/${child.id}`)
        .field('name', 'X')
        .expect(401);
      await request(app.getHttpServer())
        .delete(`/api/households/${household.id}/children/${child.id}`)
        .expect(401);
    });
  });
});
