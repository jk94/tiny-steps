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

interface MilestoneBody {
  id: string;
  childId: string;
  userId: string;
  templateKey: string | null;
  title: string;
  category: string | null;
  achievedAt: string;
  ageInDaysAtMilestone: number;
  ageInMonthsAtMilestone: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  photos: { id: string; sortIndex: number; mimeType: string }[];
}

const BIRTH_DATE = '2025-01-20T00:00:00.000Z';
// A bare calendar day, like `Child.birthDate` — 7 months after birth.
const ACHIEVED_AT = '2025-08-20';

describe('Milestones (e2e)', () => {
  const originalEnv = {
    CONFIG_PATH: process.env.CONFIG_PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    UPLOADS_DIR: process.env.UPLOADS_DIR,
  };

  // Distinct domain so this suite's cleanup can't touch rows created by the
  // other e2e suites (mirrors child.e2e-spec.ts).
  const E2E_EMAIL_DOMAIN = '@milestone.e2e.test';
  const testEmail = (label: string) =>
    `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}${E2E_EMAIL_DOMAIN}`;

  let app: INestApplication<App>;
  let prisma: PrismaService;
  let uploadsDir: string;
  let validPhoto: Buffer;

  beforeAll(async () => {
    process.env.CONFIG_PATH = fixture('e2e.config.yml');
    process.env.DATABASE_URL = 'file:./prisma/dev.db';
    process.env.JWT_ACCESS_SECRET = 'e2e-test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'e2e-test-refresh-secret';
    uploadsDir = await mkdtemp(join(tmpdir(), 'milestone-e2e-uploads-'));
    process.env.UPLOADS_DIR = uploadsDir;

    validPhoto = await readFile(fixture('valid-photo.png'));

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
    const memberships = await prisma.membership.findMany({ where: { userId: { in: userIds } } });
    const householdIds = [...new Set(memberships.map((membership) => membership.householdId))];
    const children = await prisma.child.findMany({ where: { householdId: { in: householdIds } } });

    // Milestones cascade on their child, but are deleted explicitly here so
    // the assertions in the delete tests cannot be satisfied by the cleanup.
    await prisma.milestone.deleteMany({
      where: { childId: { in: children.map((child) => child.id) } },
    });
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

  async function createHouseholdWithChild(
    user: AuthenticatedTestUser,
  ): Promise<{ householdId: string; childId: string }> {
    const household = await request(app.getHttpServer())
      .post('/api/households')
      .set('Cookie', user.cookies)
      .set(CSRF_HEADER_NAME, user.csrfToken)
      .send({ name: 'Milestone Household' })
      .expect(201);

    const child = await request(app.getHttpServer())
      .post(`/api/households/${household.body.id}/children`)
      .set('Cookie', user.cookies)
      .set(CSRF_HEADER_NAME, user.csrfToken)
      .field('name', 'Mia')
      .field('birthDate', BIRTH_DATE)
      .expect(201);

    return { householdId: household.body.id, childId: child.body.id };
  }

  function milestoneUrl(householdId: string, childId: string, suffix = ''): string {
    return `/api/households/${householdId}/children/${childId}/milestones${suffix}`;
  }

  function post(user: AuthenticatedTestUser, householdId: string, childId: string, suffix = '') {
    return request(app.getHttpServer())
      .post(milestoneUrl(householdId, childId, suffix))
      .set('Cookie', user.cookies)
      .set(CSRF_HEADER_NAME, user.csrfToken);
  }

  it('creates a template milestone with a server-derived category and lists it back', async () => {
    const owner = await registerUser('create');
    const { householdId, childId } = await createHouseholdWithChild(owner);

    const created = await post(owner, householdId, childId)
      .send({
        templateKey: 'SITS_UNSUPPORTED',
        title: 'Sitzt frei',
        achievedAt: ACHIEVED_AT,
        note: 'Auf der Krabbeldecke',
      })
      .expect(201);

    const milestone = created.body as MilestoneBody;
    expect(milestone).toMatchObject({
      childId,
      userId: owner.userId,
      templateKey: 'SITS_UNSUPPORTED',
      title: 'Sitzt frei',
      // Derived from the code catalog, never sent by the client.
      category: 'MOTOR',
      ageInDaysAtMilestone: 212,
      ageInMonthsAtMilestone: 7,
      note: 'Auf der Krabbeldecke',
      photos: [],
    });

    const list = await request(app.getHttpServer())
      .get(milestoneUrl(householdId, childId))
      .set('Cookie', owner.cookies)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('rejects the same template twice for one child with a machine-readable 409 (M-5)', async () => {
    const owner = await registerUser('unique');
    const { householdId, childId } = await createHouseholdWithChild(owner);

    await post(owner, householdId, childId)
      .send({ templateKey: 'FIRST_STEPS', title: 'Erste Schritte', achievedAt: ACHIEVED_AT })
      .expect(201);

    const conflict = await post(owner, householdId, childId)
      .send({ templateKey: 'FIRST_STEPS', title: 'Erste Schritte', achievedAt: ACHIEVED_AT })
      .expect(409);

    expect(conflict.body).toMatchObject({ code: 'MILESTONE_TEMPLATE_ALREADY_RECORDED' });
  });

  it('allows any number of free entries — multiple NULL template keys do not collide (M-4)', async () => {
    const owner = await registerUser('free');
    const { householdId, childId } = await createHouseholdWithChild(owner);

    await post(owner, householdId, childId)
      .send({ title: 'Erste Zugfahrt', achievedAt: ACHIEVED_AT })
      .expect(201);
    await post(owner, householdId, childId)
      .send({ title: 'Erster Zoobesuch', category: 'SOCIAL', achievedAt: ACHIEVED_AT })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(milestoneUrl(householdId, childId))
      .set('Cookie', owner.cookies)
      .expect(200);
    expect(list.body).toHaveLength(2);
  });

  it('lists milestones newest first (M-11)', async () => {
    const owner = await registerUser('order');
    const { householdId, childId } = await createHouseholdWithChild(owner);

    await post(owner, householdId, childId)
      .send({ title: 'Früher', achievedAt: '2025-03-01' })
      .expect(201);
    await post(owner, householdId, childId)
      .send({ title: 'Später', achievedAt: '2025-09-01' })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(milestoneUrl(householdId, childId))
      .set('Cookie', owner.cookies)
      .expect(200);

    expect((list.body as MilestoneBody[]).map((entry) => entry.title)).toEqual([
      'Später',
      'Früher',
    ]);
  });

  it('uploads, serves and deletes photos, keeping a stable sort index (M-7/M-10)', async () => {
    const owner = await registerUser('photos');
    const { householdId, childId } = await createHouseholdWithChild(owner);
    const created = await post(owner, householdId, childId)
      .send({ title: 'Erster Zoobesuch', achievedAt: ACHIEVED_AT })
      .expect(201);
    const milestoneId = (created.body as MilestoneBody).id;

    const first = await post(owner, householdId, childId, `/${milestoneId}/photos`)
      .attach('photo', validPhoto, { filename: 'a.png', contentType: 'image/png' })
      .expect(201);
    const second = await post(owner, householdId, childId, `/${milestoneId}/photos`)
      .attach('photo', validPhoto, { filename: 'b.png', contentType: 'image/png' })
      .expect(201);

    expect(first.body).toMatchObject({ sortIndex: 0, mimeType: 'image/png' });
    expect(second.body).toMatchObject({ sortIndex: 1 });

    const withPhotos = await request(app.getHttpServer())
      .get(milestoneUrl(householdId, childId, `/${milestoneId}`))
      .set('Cookie', owner.cookies)
      .expect(200);
    expect((withPhotos.body as MilestoneBody).photos).toHaveLength(2);
    // M-8: the stored path never leaves the server.
    expect(JSON.stringify(withPhotos.body)).not.toContain('milestones/');

    const served = await request(app.getHttpServer())
      .get(milestoneUrl(householdId, childId, `/${milestoneId}/photos/${first.body.id}`))
      .set('Cookie', owner.cookies)
      .expect(200);
    expect(served.headers['content-type']).toContain('image/png');

    await request(app.getHttpServer())
      .delete(milestoneUrl(householdId, childId, `/${milestoneId}/photos/${first.body.id}`))
      .set('Cookie', owner.cookies)
      .set(CSRF_HEADER_NAME, owner.csrfToken)
      .expect(204);

    const afterDelete = await request(app.getHttpServer())
      .get(milestoneUrl(householdId, childId, `/${milestoneId}`))
      .set('Cookie', owner.cookies)
      .expect(200);
    // The surviving photo keeps its index rather than being renumbered.
    expect((afterDelete.body as MilestoneBody).photos).toEqual([
      expect.objectContaining({ id: second.body.id, sortIndex: 1 }),
    ]);

    // A third upload continues past the highest index, never reusing 0.
    const third = await post(owner, householdId, childId, `/${milestoneId}/photos`)
      .attach('photo', validPhoto, { filename: 'c.png', contentType: 'image/png' })
      .expect(201);
    expect(third.body.sortIndex).toBe(2);
  });

  it('rejects a non-image upload with a machine-readable code', async () => {
    const owner = await registerUser('photo-type');
    const { householdId, childId } = await createHouseholdWithChild(owner);
    const created = await post(owner, householdId, childId)
      .send({ title: 'Erster Zoobesuch', achievedAt: ACHIEVED_AT })
      .expect(201);

    const rejected = await post(
      owner,
      householdId,
      childId,
      `/${(created.body as MilestoneBody).id}/photos`,
    )
      .attach('photo', Buffer.from('this is not actually an image'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      })
      .expect(400);

    expect(rejected.body).toMatchObject({ code: 'PHOTO_INVALID_TYPE' });
  });

  it('removes the photo files from disk when the milestone is deleted (M-9)', async () => {
    const owner = await registerUser('delete');
    const { householdId, childId } = await createHouseholdWithChild(owner);
    const created = await post(owner, householdId, childId)
      .send({ title: 'Erster Zoobesuch', achievedAt: ACHIEVED_AT })
      .expect(201);
    const milestoneId = (created.body as MilestoneBody).id;

    await post(owner, householdId, childId, `/${milestoneId}/photos`)
      .attach('photo', validPhoto, { filename: 'a.png', contentType: 'image/png' })
      .expect(201);

    const storedPhotos = await prisma.milestonePhoto.findMany({ where: { milestoneId } });
    expect(storedPhotos).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(milestoneUrl(householdId, childId, `/${milestoneId}`))
      .set('Cookie', owner.cookies)
      .set(CSRF_HEADER_NAME, owner.csrfToken)
      .expect(204);

    expect(await prisma.milestonePhoto.findMany({ where: { milestoneId } })).toHaveLength(0);
    await expect(readFile(join(uploadsDir, storedPhotos[0].path))).rejects.toThrow();
  });

  it("hides another household's milestones behind a 404", async () => {
    const owner = await registerUser('owner');
    const outsider = await registerUser('outsider');
    const { householdId, childId } = await createHouseholdWithChild(owner);
    const created = await post(owner, householdId, childId)
      .send({ title: 'Erster Zoobesuch', achievedAt: ACHIEVED_AT })
      .expect(201);

    await request(app.getHttpServer())
      .get(milestoneUrl(householdId, childId, `/${(created.body as MilestoneBody).id}`))
      .set('Cookie', outsider.cookies)
      .expect(404);
  });

  it('rejects a date before the birth date and one in the future (M-6)', async () => {
    const owner = await registerUser('dates');
    const { householdId, childId } = await createHouseholdWithChild(owner);

    const beforeBirth = await post(owner, householdId, childId)
      .send({ title: 'Zu früh', achievedAt: '2025-01-19' })
      .expect(400);
    // The machine-readable code survives the validation exception filter.
    expect(beforeBirth.body).toMatchObject({ code: 'ACHIEVED_AT_BEFORE_BIRTH' });

    const inTwoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await post(owner, householdId, childId)
      .send({ title: 'Zu spät', achievedAt: inTwoDays })
      .expect(400);
  });
});
