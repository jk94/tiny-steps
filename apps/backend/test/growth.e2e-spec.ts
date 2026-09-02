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

interface GrowthMeasurementBody {
  id: string;
  childId: string;
  userId: string;
  measuredAt: string;
  ageInDaysAtMeasurement: number;
  weightGrams: number | null;
  lengthMillimeters: number | null;
  headCircumferenceMillimeters: number | null;
  lengthMeasurementPosition: 'LYING' | 'STANDING' | null;
  effectiveLengthMeasurementPosition: 'LYING' | 'STANDING' | null;
  lengthOrHeightReferenceUsed: 'LENGTH' | 'HEIGHT' | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  percentiles: {
    weight: Record<string, unknown> | null;
    length: Record<string, unknown> | null;
    headCircumference: Record<string, unknown> | null;
  };
}

const BIRTH_DATE = '2025-01-01T00:00:00.000Z';
// 90 completed days after the birth date.
const MEASURED_AT = '2025-04-01T09:00:00.000Z';

describe('Growth measurements (e2e)', () => {
  const originalEnv = {
    CONFIG_PATH: process.env.CONFIG_PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  };

  // Distinct domain so this suite's cleanup can't touch rows created by the
  // other e2e suites (mirrors child.e2e-spec.ts).
  const E2E_EMAIL_DOMAIN = '@growth.e2e.test';
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

    // GrowthMeasurement cascades on its child, but is deleted explicitly here
    // so the assertion in the delete test cannot be satisfied by the cleanup.
    await prisma.growthMeasurement.deleteMany({
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
    options: { sex?: 'FEMALE' | 'MALE' } = {},
  ): Promise<{ householdId: string; childId: string }> {
    const household = await request(app.getHttpServer())
      .post('/api/households')
      .set('Cookie', user.cookies)
      .set(CSRF_HEADER_NAME, user.csrfToken)
      .send({ name: 'Growth Household' })
      .expect(201);

    let childRequest = request(app.getHttpServer())
      .post(`/api/households/${household.body.id}/children`)
      .set('Cookie', user.cookies)
      .set(CSRF_HEADER_NAME, user.csrfToken)
      .field('name', 'Mia')
      .field('birthDate', BIRTH_DATE);
    if (options.sex) {
      childRequest = childRequest.field('sex', options.sex);
    }
    const child = await childRequest.expect(201);

    return { householdId: household.body.id, childId: child.body.id };
  }

  function growthUrl(householdId: string, childId: string, suffix = ''): string {
    return `/api/households/${householdId}/children/${childId}/growth${suffix}`;
  }

  function post(user: AuthenticatedTestUser, householdId: string, childId: string) {
    return request(app.getHttpServer())
      .post(growthUrl(householdId, childId))
      .set('Cookie', user.cookies)
      .set(CSRF_HEADER_NAME, user.csrfToken);
  }

  it('creates, reads back and lists a measurement with computed percentiles', async () => {
    const owner = await registerUser('create');
    const { householdId, childId } = await createHouseholdWithChild(owner, { sex: 'MALE' });

    const created = await post(owner, householdId, childId)
      .send({
        measuredAt: MEASURED_AT,
        weightGrams: 6400,
        lengthMillimeters: 615,
        headCircumferenceMillimeters: 405,
        note: 'U4 check-up',
      })
      .expect(201);

    const measurement = created.body as GrowthMeasurementBody;
    expect(measurement).toMatchObject({
      childId,
      userId: owner.userId,
      ageInDaysAtMeasurement: 90,
      weightGrams: 6400,
      lengthMillimeters: 615,
      headCircumferenceMillimeters: 405,
      lengthMeasurementPosition: null,
      effectiveLengthMeasurementPosition: 'LYING',
      lengthOrHeightReferenceUsed: 'LENGTH',
      note: 'U4 check-up',
    });
    expect(measurement.percentiles.weight).toMatchObject({ status: 'COMPUTED' });

    const single = await request(app.getHttpServer())
      .get(growthUrl(householdId, childId, `/${measurement.id}`))
      .set('Cookie', owner.cookies)
      .expect(200);
    expect(single.body.id).toBe(measurement.id);

    const listed = await request(app.getHttpServer())
      .get(growthUrl(householdId, childId))
      .set('Cookie', owner.cookies)
      .expect(200);
    expect(listed.body).toHaveLength(1);
  });

  it('lists several same-day measurements chronologically (W-6)', async () => {
    const owner = await registerUser('same-day');
    const { householdId, childId } = await createHouseholdWithChild(owner, { sex: 'FEMALE' });

    await post(owner, householdId, childId)
      .send({ measuredAt: '2025-04-01T18:00:00.000Z', weightGrams: 6450 })
      .expect(201);
    await post(owner, householdId, childId)
      .send({ measuredAt: '2025-04-01T09:00:00.000Z', weightGrams: 6400 })
      .expect(201);

    const listed = await request(app.getHttpServer())
      .get(growthUrl(householdId, childId))
      .set('Cookie', owner.cookies)
      .expect(200);

    const body = listed.body as GrowthMeasurementBody[];
    expect(body.map((entry) => entry.weightGrams)).toEqual([6400, 6450]);
  });

  it('windows the list by from/to', async () => {
    const owner = await registerUser('range');
    const { householdId, childId } = await createHouseholdWithChild(owner, { sex: 'FEMALE' });

    await post(owner, householdId, childId)
      .send({ measuredAt: '2025-02-01T09:00:00.000Z', weightGrams: 5000 })
      .expect(201);
    await post(owner, householdId, childId)
      .send({ measuredAt: '2025-06-01T09:00:00.000Z', weightGrams: 7000 })
      .expect(201);

    const listed = await request(app.getHttpServer())
      .get(growthUrl(householdId, childId))
      .query({ from: '2025-05-01T00:00:00.000Z', to: '2025-07-01T00:00:00.000Z' })
      .set('Cookie', owner.cookies)
      .expect(200);

    const body = listed.body as GrowthMeasurementBody[];
    expect(body).toHaveLength(1);
    expect(body[0].weightGrams).toBe(7000);
  });

  it('rejects a body without any measurement value (W-1)', async () => {
    const owner = await registerUser('no-value');
    const { householdId, childId } = await createHouseholdWithChild(owner);

    await post(owner, householdId, childId).send({ measuredAt: MEASURED_AT }).expect(400);
  });

  it('rejects an implausible weight (W-4)', async () => {
    const owner = await registerUser('range-limit');
    const { householdId, childId } = await createHouseholdWithChild(owner);

    await post(owner, householdId, childId)
      .send({ measuredAt: MEASURED_AT, weightGrams: 100 })
      .expect(400);
  });

  it('rejects a measurement taken before the child was born (W-5)', async () => {
    const owner = await registerUser('before-birth');
    const { householdId, childId } = await createHouseholdWithChild(owner);

    await post(owner, householdId, childId)
      .send({ measuredAt: '2024-11-01T09:00:00.000Z', weightGrams: 3200 })
      .expect(400);
  });

  it('withholds percentiles but keeps the values when the child has no sex (W-10)', async () => {
    const owner = await registerUser('no-sex');
    const { householdId, childId } = await createHouseholdWithChild(owner);

    const created = await post(owner, householdId, childId)
      .send({ measuredAt: MEASURED_AT, weightGrams: 6400 })
      .expect(201);

    const measurement = created.body as GrowthMeasurementBody;
    expect(measurement.weightGrams).toBe(6400);
    expect(measurement.percentiles.weight).toEqual({
      status: 'UNAVAILABLE',
      reason: 'CHILD_SEX_NOT_SET',
    });
  });

  it('updates a measurement and can clear a single value', async () => {
    const owner = await registerUser('update');
    const { householdId, childId } = await createHouseholdWithChild(owner, { sex: 'MALE' });

    const created = await post(owner, householdId, childId)
      .send({ measuredAt: MEASURED_AT, weightGrams: 6400, headCircumferenceMillimeters: 405 })
      .expect(201);
    const measurementId = (created.body as GrowthMeasurementBody).id;

    const updated = await request(app.getHttpServer())
      .patch(growthUrl(householdId, childId, `/${measurementId}`))
      .set('Cookie', owner.cookies)
      .set(CSRF_HEADER_NAME, owner.csrfToken)
      .send({ weightGrams: 6600, headCircumferenceMillimeters: null })
      .expect(200);

    const body = updated.body as GrowthMeasurementBody;
    expect(body.weightGrams).toBe(6600);
    expect(body.headCircumferenceMillimeters).toBeNull();
    // Prisma's `@updatedAt` applies normally here, since this is a direct
    // growthMeasurement.update() rather than the nested detail-only
    // event.update() that ADR-0011 had to work around.
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThan(
      new Date((created.body as GrowthMeasurementBody).updatedAt).getTime(),
    );
  });

  it('rejects an update that would leave the measurement without any value (W-1)', async () => {
    const owner = await registerUser('update-empty');
    const { householdId, childId } = await createHouseholdWithChild(owner, { sex: 'MALE' });

    const created = await post(owner, householdId, childId)
      .send({ measuredAt: MEASURED_AT, weightGrams: 6400 })
      .expect(201);

    await request(app.getHttpServer())
      .patch(growthUrl(householdId, childId, `/${(created.body as GrowthMeasurementBody).id}`))
      .set('Cookie', owner.cookies)
      .set(CSRF_HEADER_NAME, owner.csrfToken)
      .send({ weightGrams: null })
      .expect(400);
  });

  it('hard-deletes a measurement and answers 204 (W-8)', async () => {
    const owner = await registerUser('delete');
    const { householdId, childId } = await createHouseholdWithChild(owner, { sex: 'MALE' });

    const created = await post(owner, householdId, childId)
      .send({ measuredAt: MEASURED_AT, weightGrams: 6400 })
      .expect(201);
    const measurementId = (created.body as GrowthMeasurementBody).id;

    await request(app.getHttpServer())
      .delete(growthUrl(householdId, childId, `/${measurementId}`))
      .set('Cookie', owner.cookies)
      .set(CSRF_HEADER_NAME, owner.csrfToken)
      .expect(204);

    expect(await prisma.growthMeasurement.findUnique({ where: { id: measurementId } })).toBeNull();
  });

  it('returns the WHO reference bands for a child with a known sex (W-12)', async () => {
    const owner = await registerUser('reference');
    const { householdId, childId } = await createHouseholdWithChild(owner, { sex: 'MALE' });

    const response = await request(app.getHttpServer())
      .get(growthUrl(householdId, childId, '/reference'))
      .query({ indicator: 'WEIGHT_FOR_AGE' })
      .set('Cookie', owner.cookies)
      .expect(200);

    expect(response.headers['cache-control']).toBe('private, max-age=86400');
    expect(response.body.available).toBe(true);
    expect(response.body.curves).toHaveLength(5);
    expect(response.body.curves.map((curve: { percentile: number }) => curve.percentile)).toEqual([
      3, 15, 50, 85, 97,
    ]);
    expect(response.body.lengthToHeightBoundaryDays).toBe(731);
  });

  it('reports the missing sex on the reference endpoint instead of guessing (W-10)', async () => {
    const owner = await registerUser('reference-no-sex');
    const { householdId, childId } = await createHouseholdWithChild(owner);

    const response = await request(app.getHttpServer())
      .get(growthUrl(householdId, childId, '/reference'))
      .query({ indicator: 'LENGTH_OR_HEIGHT_FOR_AGE' })
      .set('Cookie', owner.cookies)
      .expect(200);

    expect(response.body).toEqual({
      indicator: 'LENGTH_OR_HEIGHT_FOR_AGE',
      sex: null,
      available: false,
      reason: 'CHILD_SEX_NOT_SET',
    });
  });

  it('rejects an unknown reference indicator', async () => {
    const owner = await registerUser('reference-bad');
    const { householdId, childId } = await createHouseholdWithChild(owner, { sex: 'MALE' });

    await request(app.getHttpServer())
      .get(growthUrl(householdId, childId, '/reference'))
      .query({ indicator: 'BMI_FOR_AGE' })
      .set('Cookie', owner.cookies)
      .expect(400);
  });

  it('hides another household measurements behind a 404', async () => {
    const owner = await registerUser('owner-a');
    const outsider = await registerUser('owner-b');
    const { householdId, childId } = await createHouseholdWithChild(owner, { sex: 'MALE' });

    await request(app.getHttpServer())
      .get(growthUrl(householdId, childId))
      .set('Cookie', outsider.cookies)
      .expect(404);
  });

  it('rejects a write without the CSRF header', async () => {
    const owner = await registerUser('csrf');
    const { householdId, childId } = await createHouseholdWithChild(owner, { sex: 'MALE' });

    await request(app.getHttpServer())
      .post(growthUrl(householdId, childId))
      .set('Cookie', owner.cookies)
      .send({ measuredAt: MEASURED_AT, weightGrams: 6400 })
      .expect(403);
  });
});
