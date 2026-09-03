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

interface HealthRecordBody {
  id: string;
  childId: string;
  userId: string;
  kind: string;
  name: string;
  administeredAt: string | null;
  dueAt: string | null;
  doseAmount: number | null;
  doseUnit: string | null;
  vaccineBatch: string | null;
  note: string | null;
  reminderEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const BIRTH_DATE = '2025-01-20T00:00:00.000Z';
const ADMINISTERED_AT = '2025-08-20T14:30:00.000Z';
const DUE_AT = '2025-09-15';

/**
 * Real-SQLite coverage for the pieces the mocked unit tests cannot reach: that
 * the migration actually applied (columns, cascade), that the structured error
 * codes survive the global `ValidationPipe` plus the route filter, and that the
 * kind/status query filters work against real rows.
 */
describe('Health records (e2e)', () => {
  const originalEnv = {
    CONFIG_PATH: process.env.CONFIG_PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  };

  // Distinct domain so this suite's cleanup can't touch rows created by the
  // other e2e suites (mirrors milestone.e2e-spec.ts).
  const E2E_EMAIL_DOMAIN = '@health-record.e2e.test';
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

    // Health records cascade on their child, but are deleted explicitly here
    // so the cascade assertion below cannot be satisfied by the cleanup.
    await prisma.healthRecord.deleteMany({
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
      .send({ name: 'Health Household' })
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

  function recordUrl(householdId: string, childId: string, suffix = ''): string {
    return `/api/households/${householdId}/children/${childId}/health-records${suffix}`;
  }

  function post(user: AuthenticatedTestUser, householdId: string, childId: string) {
    return request(app.getHttpServer())
      .post(recordUrl(householdId, childId))
      .set('Cookie', user.cookies)
      .set(CSRF_HEADER_NAME, user.csrfToken);
  }

  function patch(
    user: AuthenticatedTestUser,
    householdId: string,
    childId: string,
    recordId: string,
  ) {
    return request(app.getHttpServer())
      .patch(recordUrl(householdId, childId, `/${recordId}`))
      .set('Cookie', user.cookies)
      .set(CSRF_HEADER_NAME, user.csrfToken);
  }

  it('stores a medication and a vaccination with their kind-specific fields', async () => {
    const owner = await registerUser('kinds');
    const { householdId, childId } = await createHouseholdWithChild(owner);

    const medication = await post(owner, householdId, childId)
      .send({
        kind: 'MEDICATION',
        name: 'Paracetamol',
        administeredAt: ADMINISTERED_AT,
        doseAmount: 5,
        doseUnit: 'ml',
      })
      .expect(201);
    expect(medication.body as HealthRecordBody).toMatchObject({
      kind: 'MEDICATION',
      doseAmount: 5,
      doseUnit: 'ml',
      vaccineBatch: null,
      userId: owner.userId,
    });
    // Internal scheduler bookkeeping stays server-side (MED-9).
    expect(medication.body).not.toHaveProperty('reminderLastSentAt');

    const vaccination = await post(owner, householdId, childId)
      .send({
        kind: 'VACCINATION',
        name: '6-fach-Impfung',
        dueAt: DUE_AT,
        vaccineBatch: 'AB1234',
        reminderEnabled: true,
      })
      .expect(201);
    expect(vaccination.body as HealthRecordBody).toMatchObject({
      kind: 'VACCINATION',
      vaccineBatch: 'AB1234',
      reminderEnabled: true,
      administeredAt: null,
    });
  });

  it('rejects the cross-column rules with machine-readable codes (MED-2/MED-3)', async () => {
    const owner = await registerUser('rules');
    const { householdId, childId } = await createHouseholdWithChild(owner);

    const noDate = await post(owner, householdId, childId)
      .send({ kind: 'MEDICATION', name: 'Paracetamol' })
      .expect(400);
    expect(noDate.body).toMatchObject({ code: 'HEALTH_RECORD_MISSING_DATE' });

    const doseWithoutUnit = await post(owner, householdId, childId)
      .send({
        kind: 'MEDICATION',
        name: 'Vitamin D',
        administeredAt: ADMINISTERED_AT,
        doseAmount: 1,
      })
      .expect(400);
    expect(doseWithoutUnit.body).toMatchObject({ code: 'HEALTH_RECORD_DOSE_UNIT_REQUIRED' });

    const batchOnMedication = await post(owner, householdId, childId)
      .send({
        kind: 'MEDICATION',
        name: 'Ibuprofen',
        administeredAt: ADMINISTERED_AT,
        vaccineBatch: 'AB1234',
      })
      .expect(400);
    expect(batchOnMedication.body).toMatchObject({
      code: 'HEALTH_RECORD_FIELD_NOT_ALLOWED_FOR_KIND',
    });

    // A full day before the birth day, so it is rejected no matter which
    // timezone the entry could plausibly have come from (MED-6).
    const beforeBirth = await post(owner, householdId, childId)
      .send({ kind: 'MEDICATION', name: 'Zu früh', administeredAt: '2025-01-19T00:00:00.000Z' })
      .expect(400);
    expect(beforeBirth.body).toMatchObject({
      code: 'HEALTH_RECORD_ADMINISTERED_AT_BEFORE_BIRTH',
    });
  });

  it('marks a planned entry as done and lets the timestamp be corrected afterwards (MED-5)', async () => {
    const owner = await registerUser('markdone');
    const { householdId, childId } = await createHouseholdWithChild(owner);

    const planned = await post(owner, householdId, childId)
      .send({ kind: 'VACCINATION', name: 'Rotavirus', dueAt: DUE_AT, reminderEnabled: true })
      .expect(201);
    const recordId = (planned.body as HealthRecordBody).id;

    const done = await patch(owner, householdId, childId, recordId)
      .send({ administeredAt: ADMINISTERED_AT })
      .expect(200);
    expect(done.body as HealthRecordBody).toMatchObject({
      administeredAt: ADMINISTERED_AT,
      // The plan it fulfilled survives, so the entry keeps its history.
      dueAt: new Date(DUE_AT).toISOString(),
    });

    const corrected = await patch(owner, householdId, childId, recordId)
      .send({ administeredAt: '2025-08-19T09:00:00.000Z' })
      .expect(200);
    expect((corrected.body as HealthRecordBody).administeredAt).toBe('2025-08-19T09:00:00.000Z');
  });

  it('clears the reminder stamp when the due date is moved', async () => {
    const owner = await registerUser('rearm');
    const { householdId, childId } = await createHouseholdWithChild(owner);

    const created = await post(owner, householdId, childId)
      .send({ kind: 'VACCINATION', name: 'Masern', dueAt: DUE_AT, reminderEnabled: true })
      .expect(201);
    const recordId = (created.body as HealthRecordBody).id;

    // Simulate a reminder that already went out for the ORIGINAL due date.
    await prisma.healthRecord.update({
      where: { id: recordId },
      data: { reminderLastSentAt: new Date('2025-09-12T08:00:00.000Z') },
    });

    await patch(owner, householdId, childId, recordId).send({ dueAt: '2025-10-20' }).expect(200);

    const stored = await prisma.healthRecord.findUnique({ where: { id: recordId } });
    expect(stored?.reminderLastSentAt).toBeNull();
  });

  it('filters by kind and by derived status (MED-12)', async () => {
    const owner = await registerUser('filters');
    const { householdId, childId } = await createHouseholdWithChild(owner);

    await post(owner, householdId, childId)
      .send({ kind: 'MEDICATION', name: 'Paracetamol', administeredAt: ADMINISTERED_AT })
      .expect(201);
    await post(owner, householdId, childId)
      .send({ kind: 'VACCINATION', name: 'Masern', dueAt: DUE_AT })
      .expect(201);

    const get = (query: string) =>
      request(app.getHttpServer())
        .get(recordUrl(householdId, childId, query))
        .set('Cookie', owner.cookies)
        .expect(200);

    expect((await get('')).body).toHaveLength(2);
    expect(((await get('?kind=MEDICATION')).body as HealthRecordBody[]).map((r) => r.name)).toEqual(
      ['Paracetamol'],
    );
    expect(((await get('?status=planned')).body as HealthRecordBody[]).map((r) => r.name)).toEqual([
      'Masern',
    ]);
    expect(((await get('?status=done')).body as HealthRecordBody[]).map((r) => r.name)).toEqual([
      'Paracetamol',
    ]);
  });

  // Against real SQLite, because that is where the ordering used to be wrong:
  // a bare `dueAt: 'asc'` sorts NULLs FIRST there, which put the history above
  // the planned entries — the opposite of the MED-12 layout, and the opposite
  // of what the same query does on PostgreSQL.
  it('lists planned entries by due date before the history (MED-12)', async () => {
    const owner = await registerUser('ordering');
    const { householdId, childId } = await createHouseholdWithChild(owner);

    await post(owner, householdId, childId)
      .send({ kind: 'MEDICATION', name: 'Paracetamol', administeredAt: ADMINISTERED_AT })
      .expect(201);
    await post(owner, householdId, childId)
      .send({ kind: 'VACCINATION', name: 'Später', dueAt: '2026-12-01' })
      .expect(201);
    await post(owner, householdId, childId)
      .send({ kind: 'VACCINATION', name: 'Zuerst', dueAt: '2026-01-15' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(recordUrl(householdId, childId))
      .set('Cookie', owner.cookies)
      .expect(200);

    expect((response.body as HealthRecordBody[]).map((record) => record.name)).toEqual([
      'Zuerst',
      'Später',
      'Paracetamol',
    ]);
  });

  it("hides another household's records behind a 404", async () => {
    const owner = await registerUser('owner');
    const outsider = await registerUser('outsider');
    const { householdId, childId } = await createHouseholdWithChild(owner);
    const created = await post(owner, householdId, childId)
      .send({ kind: 'MEDICATION', name: 'Paracetamol', administeredAt: ADMINISTERED_AT })
      .expect(201);

    await request(app.getHttpServer())
      .get(recordUrl(householdId, childId, `/${(created.body as HealthRecordBody).id}`))
      .set('Cookie', outsider.cookies)
      .expect(404);
  });

  it('deletes a record on request and drops the rest with the child (FK cascade)', async () => {
    const owner = await registerUser('cascade');
    const { householdId, childId } = await createHouseholdWithChild(owner);

    const first = await post(owner, householdId, childId)
      .send({ kind: 'MEDICATION', name: 'Paracetamol', administeredAt: ADMINISTERED_AT })
      .expect(201);
    await post(owner, householdId, childId)
      .send({ kind: 'VACCINATION', name: 'Masern', dueAt: DUE_AT })
      .expect(201);

    await request(app.getHttpServer())
      .delete(recordUrl(householdId, childId, `/${(first.body as HealthRecordBody).id}`))
      .set('Cookie', owner.cookies)
      .set(CSRF_HEADER_NAME, owner.csrfToken)
      .expect(204);
    expect(await prisma.healthRecord.findMany({ where: { childId } })).toHaveLength(1);

    // Smoke-tests the migration's `onDelete: Cascade` on the child relation:
    // deleting a child profile must not be blocked by an FK constraint.
    await request(app.getHttpServer())
      .delete(`/api/households/${householdId}/children/${childId}`)
      .set('Cookie', owner.cookies)
      .set(CSRF_HEADER_NAME, owner.csrfToken)
      .expect(204);
    expect(await prisma.healthRecord.findMany({ where: { childId } })).toHaveLength(0);
  });
});
