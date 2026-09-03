import { join } from 'path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { parse } from 'csv-parse/sync';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../src/auth/guards/csrf.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { EventType } from '../src/event/event-type.enum';
import { ChildSex } from '../src/child/child-sex.enum';
import {
  GROWTH_EXPORT_TYPE,
  HEALTH_RECORD_EXPORT_TYPE,
  RECORD_KIND_EVENT,
  RECORD_KIND_GROWTH_MEASUREMENT,
  RECORD_KIND_HEALTH_RECORD,
} from '../src/export/export.service';
import { HealthRecordKind } from '../src/health-record/health-record-kind.enum';
import { FeedingType } from '../src/feeding/feeding-type.enum';
import { FeedingSide } from '../src/feeding/feeding-side.enum';
import { DiaperType } from '../src/diaper/diaper-type.enum';

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

// Free-text note deliberately carrying a comma, a double quote, and a
// newline, to prove the CSV export survives an HTTP round-trip with correct
// RFC-4180 quoting (not just the unit-level csv.serializer.spec.ts).
const TRICKY_NOTE = 'spat up, a "lot"\nthen slept';

describe('Data export (e2e)', () => {
  const originalEnv = {
    CONFIG_PATH: process.env.CONFIG_PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  };

  const E2E_EMAIL_DOMAIN = '@export.e2e.test';
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

    const memberships = await prisma.membership.findMany({ where: { userId: { in: userIds } } });
    const householdIds = [...new Set(memberships.map((membership) => membership.householdId))];

    const children = await prisma.child.findMany({ where: { householdId: { in: householdIds } } });
    const childIds = children.map((child) => child.id);

    // FK order: detail rows -> Event -> Child, then household graph, then user.
    await prisma.event.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.growthMeasurement.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.healthRecord.deleteMany({ where: { childId: { in: childIds } } });
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
    return response.body as { id: string; name: string };
  }

  async function createChild(householdId: string): Promise<string> {
    const child = await prisma.child.create({
      data: {
        householdId,
        name: 'Mia',
        birthDate: new Date('2024-01-01T00:00:00.000Z'),
        // A known sex, so the export's percentile columns are actually filled
        // rather than blank for the W-10 reason.
        sex: ChildSex.FEMALE,
      },
    });
    return child.id;
  }

  /** Seeds one growth measurement, sorting between the diaper and the feeding. */
  async function seedGrowthMeasurement(childId: string, userId: string): Promise<string> {
    const measurement = await prisma.growthMeasurement.create({
      data: {
        childId,
        userId,
        measuredAt: new Date('2026-01-01T07:30:00.000Z'),
        weightGrams: 12000,
        lengthMillimeters: 870,
        headCircumferenceMillimeters: 480,
        note: 'U7 check-up',
      },
    });
    return measurement.id;
  }

  /** An administered medication, dated between the seeded diaper and feeding. */
  async function seedHealthRecord(childId: string, userId: string): Promise<string> {
    const record = await prisma.healthRecord.create({
      data: {
        childId,
        userId,
        kind: HealthRecordKind.MEDICATION,
        name: 'Paracetamol',
        administeredAt: new Date('2026-01-01T07:45:00.000Z'),
        doseAmount: 5,
        doseUnit: 'ml',
        note: 'Bei Fieber',
      },
    });
    return record.id;
  }

  /** Seeds one of each event type for the child, returning their ids. */
  async function seedOneOfEachEvent(childId: string, userId: string) {
    const feeding = await prisma.event.create({
      data: {
        childId,
        userId,
        type: EventType.FEEDING,
        occurredAt: new Date('2026-01-01T08:00:00.000Z'),
        startedAt: new Date('2026-01-01T08:00:00.000Z'),
        endedAt: new Date('2026-01-01T08:15:00.000Z'),
        feedingDetail: {
          create: { feedingType: FeedingType.BREAST, side: FeedingSide.LEFT, note: TRICKY_NOTE },
        },
      },
    });
    const sleep = await prisma.event.create({
      data: {
        childId,
        userId,
        type: EventType.SLEEP,
        occurredAt: new Date('2026-01-01T09:00:00.000Z'),
        startedAt: new Date('2026-01-01T09:00:00.000Z'),
        endedAt: new Date('2026-01-01T10:00:00.000Z'),
      },
    });
    const diaper = await prisma.event.create({
      data: {
        childId,
        userId,
        type: EventType.DIAPER,
        occurredAt: new Date('2026-01-01T07:00:00.000Z'),
        diaperDetail: { create: { diaperType: DiaperType.BOTH, note: 'soft' } },
      },
    });
    return { feedingId: feeding.id, sleepId: sleep.id, diaperId: diaper.id };
  }

  it('exports all three event types as JSON, ascending by occurredAt', async () => {
    const owner = await registerUser('json-owner');
    const household = await createHousehold(owner, 'JSON Household');
    const childId = await createChild(household.id);
    const { feedingId, sleepId, diaperId } = await seedOneOfEachEvent(childId, owner.userId);

    const response = await request(app.getHttpServer())
      .get(`/api/households/${household.id}/children/${childId}/export/json`)
      .set('Cookie', owner.cookies)
      .expect(200);

    expect(response.headers['content-type']).toContain('application/json');
    expect(response.headers['content-disposition']).toBe(
      `attachment; filename="export-${childId}.json"`,
    );

    const rows = JSON.parse(response.text) as Array<Record<string, unknown>>;
    expect(rows.map((row) => row.id)).toEqual([diaperId, feedingId, sleepId]);

    const feedingRow = rows.find((row) => row.id === feedingId)!;
    expect(feedingRow).toMatchObject({
      type: EventType.FEEDING,
      feedingType: FeedingType.BREAST,
      side: FeedingSide.LEFT,
      durationSeconds: 900,
      note: TRICKY_NOTE,
      diaperType: null,
    });
    expect(rows.find((row) => row.id === sleepId)).toMatchObject({
      type: EventType.SLEEP,
      durationSeconds: 3600,
      feedingType: null,
      diaperType: null,
    });
    expect(rows.find((row) => row.id === diaperId)).toMatchObject({
      type: EventType.DIAPER,
      diaperType: DiaperType.BOTH,
      note: 'soft',
      durationSeconds: null,
    });
  });

  it('exports the same data as CSV, round-tripping the tricky note field', async () => {
    const owner = await registerUser('csv-owner');
    const household = await createHousehold(owner, 'CSV Household');
    const childId = await createChild(household.id);
    const { feedingId } = await seedOneOfEachEvent(childId, owner.userId);

    const response = await request(app.getHttpServer())
      .get(`/api/households/${household.id}/children/${childId}/export/csv`)
      .set('Cookie', owner.cookies)
      .expect(200);

    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toBe(
      `attachment; filename="export-${childId}.csv"`,
    );

    const records = parse(response.text, { columns: true }) as Record<string, string>[];
    expect(records).toHaveLength(3);
    const feedingRecord = records.find((record) => record.id === feedingId)!;
    expect(feedingRecord.note).toBe(TRICKY_NOTE);
    expect(feedingRecord.durationSeconds).toBe('900');
    expect(feedingRecord.side).toBe(FeedingSide.LEFT);
  });

  it('honours the optional [from, to) date filter', async () => {
    const owner = await registerUser('filter-owner');
    const household = await createHousehold(owner, 'Filter Household');
    const childId = await createChild(household.id);
    const { feedingId, sleepId } = await seedOneOfEachEvent(childId, owner.userId);

    // Diaper is at 07:00, feeding 08:00, sleep 09:00 — this window keeps only
    // feeding and sleep.
    const response = await request(app.getHttpServer())
      .get(`/api/households/${household.id}/children/${childId}/export/json`)
      .query({ from: '2026-01-01T07:30:00.000Z', to: '2026-01-01T09:30:00.000Z' })
      .set('Cookie', owner.cookies)
      .expect(200);

    const rows = JSON.parse(response.text) as Array<Record<string, unknown>>;
    expect(rows.map((row) => row.id)).toEqual([feedingId, sleepId]);
  });

  it('returns 404 for a user with no membership in the household', async () => {
    const owner = await registerUser('nomember-owner');
    const household = await createHousehold(owner, 'No Member Household');
    const childId = await createChild(household.id);
    await seedOneOfEachEvent(childId, owner.userId);

    const outsider = await registerUser('nomember-outsider');

    await request(app.getHttpServer())
      .get(`/api/households/${household.id}/children/${childId}/export/json`)
      .set('Cookie', outsider.cookies)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/households/${household.id}/children/${childId}/export/csv`)
      .set('Cookie', outsider.cookies)
      .expect(404);
  });

  it('does not allow exporting a child from household A via household B', async () => {
    const ownerA = await registerUser('crosshh-owner-a');
    const householdA = await createHousehold(ownerA, 'Household A');
    const childId = await createChild(householdA.id);
    await seedOneOfEachEvent(childId, ownerA.userId);

    const ownerB = await registerUser('crosshh-owner-b');
    const householdB = await createHousehold(ownerB, 'Household B');

    await request(app.getHttpServer())
      .get(`/api/households/${householdB.id}/children/${childId}/export/json`)
      .set('Cookie', ownerB.cookies)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/households/${householdB.id}/children/${childId}/export/csv`)
      .set('Cookie', ownerB.cookies)
      .expect(404);
  });

  describe('growth measurements in the raw-data export', () => {
    it('includes the measurement in the JSON export, merged chronologically', async () => {
      const owner = await registerUser('growth-json-owner');
      const household = await createHousehold(owner, 'Growth JSON Household');
      const childId = await createChild(household.id);
      const { feedingId, sleepId, diaperId } = await seedOneOfEachEvent(childId, owner.userId);
      const growthId = await seedGrowthMeasurement(childId, owner.userId);

      const response = await request(app.getHttpServer())
        .get(`/api/households/${household.id}/children/${childId}/export/json`)
        .set('Cookie', owner.cookies)
        .expect(200);

      const rows = JSON.parse(response.text) as Array<Record<string, unknown>>;
      // Diaper 07:00, growth 07:30, feeding 08:00, sleep 09:00.
      expect(rows.map((row) => row.id)).toEqual([diaperId, growthId, feedingId, sleepId]);

      const growthRow = rows.find((row) => row.id === growthId)!;
      expect(growthRow).toMatchObject({
        recordKind: RECORD_KIND_GROWTH_MEASUREMENT,
        type: GROWTH_EXPORT_TYPE,
        occurredAt: '2026-01-01T07:30:00.000Z',
        weightGrams: 12000,
        lengthMillimeters: 870,
        headCircumferenceMillimeters: 480,
        note: 'U7 check-up',
        feedingType: null,
        diaperType: null,
        durationSeconds: null,
      });
      expect(typeof growthRow.weightPercentile).toBe('number');

      // Existing event rows keep working and are labelled as events.
      expect(rows.find((row) => row.id === feedingId)).toMatchObject({
        recordKind: RECORD_KIND_EVENT,
        weightGrams: null,
        weightPercentile: null,
      });
    });

    it('includes the measurement in the CSV export with the new columns filled', async () => {
      const owner = await registerUser('growth-csv-owner');
      const household = await createHousehold(owner, 'Growth CSV Household');
      const childId = await createChild(household.id);
      await seedOneOfEachEvent(childId, owner.userId);
      const growthId = await seedGrowthMeasurement(childId, owner.userId);

      const response = await request(app.getHttpServer())
        .get(`/api/households/${household.id}/children/${childId}/export/csv`)
        .set('Cookie', owner.cookies)
        .expect(200);

      const records = parse(response.text, { columns: true }) as Record<string, string>[];
      expect(records).toHaveLength(4);

      const growthRecord = records.find((record) => record.id === growthId)!;
      expect(growthRecord.recordKind).toBe(RECORD_KIND_GROWTH_MEASUREMENT);
      expect(growthRecord.type).toBe(GROWTH_EXPORT_TYPE);
      expect(growthRecord.weightGrams).toBe('12000');
      expect(growthRecord.lengthMillimeters).toBe('870');
      expect(Number(growthRecord.weightPercentile)).toBeGreaterThan(0);
      expect(growthRecord.feedingType).toBe('');
    });

    it('applies the date filter to measurements as well', async () => {
      const owner = await registerUser('growth-filter-owner');
      const household = await createHousehold(owner, 'Growth Filter Household');
      const childId = await createChild(household.id);
      await seedGrowthMeasurement(childId, owner.userId);

      const response = await request(app.getHttpServer())
        .get(`/api/households/${household.id}/children/${childId}/export/json`)
        .query({ from: '2026-01-01T08:00:00.000Z', to: '2026-01-02T00:00:00.000Z' })
        .set('Cookie', owner.cookies)
        .expect(200);

      expect(JSON.parse(response.text)).toEqual([]);
    });
  });

  describe('health records in the raw-data export', () => {
    it('includes the record in the JSON export, merged chronologically', async () => {
      const owner = await registerUser('health-json-owner');
      const household = await createHousehold(owner, 'Health JSON Household');
      const childId = await createChild(household.id);
      const { feedingId, sleepId, diaperId } = await seedOneOfEachEvent(childId, owner.userId);
      const recordId = await seedHealthRecord(childId, owner.userId);

      const response = await request(app.getHttpServer())
        .get(`/api/households/${household.id}/children/${childId}/export/json`)
        .set('Cookie', owner.cookies)
        .expect(200);

      const rows = JSON.parse(response.text) as Array<Record<string, unknown>>;
      // Diaper 07:00, health 07:45, feeding 08:00, sleep 09:00.
      expect(rows.map((row) => row.id)).toEqual([diaperId, recordId, feedingId, sleepId]);

      expect(rows.find((row) => row.id === recordId)).toMatchObject({
        recordKind: RECORD_KIND_HEALTH_RECORD,
        type: HEALTH_RECORD_EXPORT_TYPE,
        occurredAt: '2026-01-01T07:45:00.000Z',
        healthRecordKind: HealthRecordKind.MEDICATION,
        healthRecordName: 'Paracetamol',
        healthRecordDoseAmount: 5,
        healthRecordDoseUnit: 'ml',
        healthRecordDueAt: null,
        // The free-text note reuses the shared column.
        note: 'Bei Fieber',
        feedingType: null,
        weightGrams: null,
        milestoneTitle: null,
      });

      // Existing event rows keep working and carry blank health columns.
      expect(rows.find((row) => row.id === feedingId)).toMatchObject({
        recordKind: RECORD_KIND_EVENT,
        healthRecordKind: null,
        healthRecordName: null,
      });
    });

    it('appends the new columns at the very end of the CSV header', async () => {
      const owner = await registerUser('health-csv-owner');
      const household = await createHousehold(owner, 'Health CSV Household');
      const childId = await createChild(household.id);
      await seedOneOfEachEvent(childId, owner.userId);
      const recordId = await seedHealthRecord(childId, owner.userId);

      const response = await request(app.getHttpServer())
        .get(`/api/households/${household.id}/children/${childId}/export/csv`)
        .set('Cookie', owner.cookies)
        .expect(200);

      // Positional stability: a consumer reading the pre-7.3 columns by index
      // is unaffected, because the seven new ones sit strictly last.
      const header = response.text.split('\n')[0].trim().split(',');
      expect(header.slice(-7)).toEqual([
        'healthRecordKind',
        'healthRecordName',
        'healthRecordAdministeredAt',
        'healthRecordDueAt',
        'healthRecordDoseAmount',
        'healthRecordDoseUnit',
        'healthRecordVaccineBatch',
      ]);

      const records = parse(response.text, { columns: true }) as Record<string, string>[];
      expect(records).toHaveLength(4);
      const healthRecord = records.find((record) => record.id === recordId)!;
      expect(healthRecord.recordKind).toBe(RECORD_KIND_HEALTH_RECORD);
      expect(healthRecord.healthRecordName).toBe('Paracetamol');
      expect(healthRecord.healthRecordDoseAmount).toBe('5');
      expect(healthRecord.healthRecordVaccineBatch).toBe('');
    });

    it('windows a purely planned entry by its due date', async () => {
      const owner = await registerUser('health-filter-owner');
      const household = await createHousehold(owner, 'Health Filter Household');
      const childId = await createChild(household.id);
      const planned = await prisma.healthRecord.create({
        data: {
          childId,
          userId: owner.userId,
          kind: HealthRecordKind.VACCINATION,
          name: '6-fach-Impfung',
          dueAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      });

      const inside = await request(app.getHttpServer())
        .get(`/api/households/${household.id}/children/${childId}/export/json`)
        .query({ from: '2026-01-01T00:00:00.000Z', to: '2026-01-02T00:00:00.000Z' })
        .set('Cookie', owner.cookies)
        .expect(200);
      expect((JSON.parse(inside.text) as { id: string }[]).map((row) => row.id)).toEqual([
        planned.id,
      ]);

      const outside = await request(app.getHttpServer())
        .get(`/api/households/${household.id}/children/${childId}/export/json`)
        .query({ from: '2026-01-02T00:00:00.000Z' })
        .set('Cookie', owner.cookies)
        .expect(200);
      expect(JSON.parse(outside.text)).toEqual([]);
    });
  });

  describe('PDF report', () => {
    const PERIOD = { from: '2026-01-01T00:00:00.000Z', to: '2026-02-01T00:00:00.000Z' };

    it('returns a downloadable PDF containing the seeded data', async () => {
      const owner = await registerUser('report-owner');
      const household = await createHousehold(owner, 'Report Household');
      const childId = await createChild(household.id);
      await seedOneOfEachEvent(childId, owner.userId);
      await seedGrowthMeasurement(childId, owner.userId);
      await seedHealthRecord(childId, owner.userId);

      const response = await request(app.getHttpServer())
        .get(`/api/households/${household.id}/children/${childId}/export/report.pdf`)
        .query({ ...PERIOD, locale: 'de' })
        .set('Cookie', owner.cookies)
        .buffer()
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toBe(
        `attachment; filename="report-${childId}.pdf"`,
      );
      const body = response.body as Buffer;
      expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      // A real report with a chart and three tables is comfortably past this;
      // a header-only stub would not be.
      expect(body.length).toBeGreaterThan(10_000);
    });

    it('renders an English report as readily as a German one', async () => {
      const owner = await registerUser('report-en-owner');
      const household = await createHousehold(owner, 'Report EN Household');
      const childId = await createChild(household.id);
      await seedOneOfEachEvent(childId, owner.userId);

      await request(app.getHttpServer())
        .get(`/api/households/${household.id}/children/${childId}/export/report.pdf`)
        .query({ ...PERIOD, locale: 'en', sections: 'CORE,TRACKING' })
        .set('Cookie', owner.cookies)
        .expect(200)
        .expect('Content-Type', /application\/pdf/);
    });

    it('answers 422 REPORT_EMPTY_PERIOD rather than shipping an empty document', async () => {
      const owner = await registerUser('report-empty-owner');
      const household = await createHousehold(owner, 'Report Empty Household');
      const childId = await createChild(household.id);

      const response = await request(app.getHttpServer())
        .get(`/api/households/${household.id}/children/${childId}/export/report.pdf`)
        .query({ ...PERIOD, locale: 'de' })
        .set('Cookie', owner.cookies)
        .expect(422);

      expect(response.body.code).toBe('REPORT_EMPTY_PERIOD');
    });

    it('rejects a missing locale, a missing period and an over-long period', async () => {
      const owner = await registerUser('report-validation-owner');
      const household = await createHousehold(owner, 'Report Validation Household');
      const childId = await createChild(household.id);
      const url = `/api/households/${household.id}/children/${childId}/export/report.pdf`;

      await request(app.getHttpServer())
        .get(url)
        .query(PERIOD)
        .set('Cookie', owner.cookies)
        .expect(400);
      await request(app.getHttpServer())
        .get(url)
        .query({ locale: 'de' })
        .set('Cookie', owner.cookies)
        .expect(400);
      await request(app.getHttpServer())
        .get(url)
        .query({ from: '2020-01-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z', locale: 'de' })
        .set('Cookie', owner.cookies)
        .expect(400);
    });

    it('returns 404 for a user with no membership in the household (EXP-14)', async () => {
      const owner = await registerUser('report-nomember-owner');
      const household = await createHousehold(owner, 'Report No Member Household');
      const childId = await createChild(household.id);
      const outsider = await registerUser('report-nomember-outsider');

      await request(app.getHttpServer())
        .get(`/api/households/${household.id}/children/${childId}/export/report.pdf`)
        .query({ ...PERIOD, locale: 'de' })
        .set('Cookie', outsider.cookies)
        .expect(404);
    });
  });
});
