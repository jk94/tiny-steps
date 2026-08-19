import { join } from 'path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from '../src/auth/auth.controller';
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

describe('Auth (e2e)', () => {
  const originalEnv = {
    CONFIG_PATH: process.env.CONFIG_PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  };

  const testEmail = (label: string) =>
    `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@e2e.test`;

  describe('with auth.local.enabled: true', () => {
    let app: INestApplication<App>;
    let prisma: PrismaService;

    beforeAll(async () => {
      process.env.CONFIG_PATH = fixture('e2e.config.yml');
      // Reuses the real dev SQLite DB (already migrated) rather than
      // `:memory:` — user/session state needs to persist across requests
      // within a test and across tests in this suite. Rows created here are
      // cleaned up in afterEach.
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
      // Binds a real ephemeral port instead of relying on supertest's
      // implicit per-request listener — see docs/known-issues.md's flaky
      // e2e-tests entry (mirrors realtime.e2e-spec.ts's rationale, which
      // needs this for its socket.io-client connection).
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
      // RefreshToken has an ON DELETE RESTRICT FK to User — must go first.
      await prisma.refreshToken.deleteMany({
        where: { user: { email: { endsWith: '@e2e.test' } } },
      });
      await prisma.user.deleteMany({ where: { email: { endsWith: '@e2e.test' } } });
    });

    it('registers a new user, sets scoped httpOnly cookies, and returns the sanitized user', async () => {
      const email = testEmail('register');

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'super-secret-1', name: 'E2E Tester' })
        .expect(201);

      expect(response.body).toEqual({
        user: {
          id: expect.any(String),
          email,
          name: 'E2E Tester',
          createdAt: expect.any(String),
        },
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');

      const setCookie = response.headers['set-cookie'] as unknown as string[];
      const accessCookie = findSetCookie(setCookie, ACCESS_TOKEN_COOKIE_NAME);
      const refreshCookie = findSetCookie(setCookie, REFRESH_TOKEN_COOKIE_NAME);
      const csrfCookie = findSetCookie(setCookie, CSRF_COOKIE_NAME);

      expect(accessCookie).toMatch(/HttpOnly/i);
      expect(accessCookie).toMatch(/Path=\/api(;|$)/i);
      expect(refreshCookie).toMatch(/HttpOnly/i);
      expect(refreshCookie).toMatch(/Path=\/api\/auth(;|$)/i);
      expect(csrfCookie).not.toMatch(/HttpOnly/i);
      // Must be scoped to `/`, not `/api` — the SPA's own pages live outside
      // `/api`, so a narrower path would make `document.cookie` unable to
      // see this cookie on any real page, breaking CSRF end-to-end (see
      // AuthCookieService for the full rationale).
      expect(csrfCookie).toMatch(/Path=\/(;|$)/i);
    });

    it('rejects registering the same email twice with 409', async () => {
      const email = testEmail('duplicate');

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'super-secret-1', name: 'E2E Tester' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'another-pass1', name: 'E2E Tester' })
        .expect(409);
    });

    it('rejects login with a wrong password using the generic invalid-credentials message', async () => {
      const email = testEmail('wrong-password');
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'correct-pass1', name: 'E2E Tester' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'wrong-password1' })
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password');
    });

    it('logs in with correct credentials and sets fresh cookies', async () => {
      const email = testEmail('login');
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'correct-pass1', name: 'E2E Tester' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'correct-pass1' })
        .expect(200);

      expect(response.body.user.email).toBe(email);
      expect(
        findSetCookie(
          response.headers['set-cookie'] as unknown as string[],
          ACCESS_TOKEN_COOKIE_NAME,
        ),
      ).toBeDefined();
    });

    it('normalizes email casing/whitespace so register and login treat it as the same account', async () => {
      const canonicalEmail = testEmail('normalize');
      const mixedCaseEmail = ` ${canonicalEmail.toUpperCase()} `;

      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: mixedCaseEmail, password: 'correct-pass1', name: 'E2E Tester' })
        .expect(201);

      expect(registerResponse.body.user.email).toBe(canonicalEmail);

      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: canonicalEmail, password: 'correct-pass1' })
        .expect(200);

      expect(loginResponse.body.user.email).toBe(canonicalEmail);

      // Registering the same email again with different casing must still
      // hit the unique-email conflict, not create a second account.
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: mixedCaseEmail, password: 'another-pass1', name: 'E2E Tester' })
        .expect(409);
    });

    it('rejects GET /api/auth/me without an access token cookie', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('returns the current user for GET /api/auth/me with a valid access token cookie', async () => {
      const email = testEmail('me');
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'correct-pass1', name: 'E2E Tester' })
        .expect(201);

      const cookies = cookieHeaderFrom(
        registerResponse.headers['set-cookie'] as unknown as string[],
      );

      const meResponse = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', cookies)
        .expect(200);

      expect(meResponse.body).toEqual({
        id: registerResponse.body.user.id,
        email,
        name: 'E2E Tester',
        createdAt: registerResponse.body.user.createdAt,
      });
    });

    it.each([
      ['a missing name', { password: 'correct-pass1' }],
      ['an empty name', { password: 'correct-pass1', name: '' }],
      ['a whitespace-only name', { password: 'correct-pass1', name: '   ' }],
      ['an over-long name', { password: 'correct-pass1', name: 'B'.repeat(121) }],
    ])('rejects registering with %s', async (_label, body) => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: testEmail('bad-name'), ...body })
        .expect(400);
    });

    describe('PATCH /api/auth/me', () => {
      /** Registers a user and returns everything needed for a CSRF-protected call. */
      const registerForPatch = async (label: string) => {
        const registerResponse = await request(app.getHttpServer())
          .post('/api/auth/register')
          .send({ email: testEmail(label), password: 'correct-pass1', name: 'E2E Tester' })
          .expect(201);

        const setCookie = registerResponse.headers['set-cookie'] as unknown as string[];
        const csrfCookieRaw = findSetCookie(setCookie, CSRF_COOKIE_NAME)!;
        return {
          userId: registerResponse.body.user.id as string,
          cookies: cookieHeaderFrom(setCookie),
          csrfToken: cookieValue(csrfCookieRaw)!,
        };
      };

      it('updates the name and makes GET /me return it', async () => {
        const { userId, cookies, csrfToken } = await registerForPatch('patch-me');

        const patchResponse = await request(app.getHttpServer())
          .patch('/api/auth/me')
          .set('Cookie', cookies)
          .set(CSRF_HEADER_NAME, csrfToken)
          .send({ name: 'Renamed Parent' })
          .expect(200);

        expect(patchResponse.body).toEqual({
          id: userId,
          email: expect.any(String),
          name: 'Renamed Parent',
          createdAt: expect.any(String),
        });

        const meResponse = await request(app.getHttpServer())
          .get('/api/auth/me')
          .set('Cookie', cookies)
          .expect(200);
        expect(meResponse.body.name).toBe('Renamed Parent');
      });

      it('rejects an unauthenticated call with 401', async () => {
        await request(app.getHttpServer())
          .patch('/api/auth/me')
          .send({ name: 'Nobody' })
          .expect(401);
      });

      it('rejects a call without a matching X-CSRF-Token header with 403', async () => {
        const { cookies } = await registerForPatch('patch-me-no-csrf');

        await request(app.getHttpServer())
          .patch('/api/auth/me')
          .set('Cookie', cookies)
          .send({ name: 'Renamed Parent' })
          .expect(403);
      });

      it.each([
        ['a missing name', {}],
        ['an empty name', { name: '' }],
        ['a whitespace-only name', { name: '   ' }],
        ['an over-long name', { name: 'B'.repeat(121) }],
      ])('rejects %s with 400', async (_label, body) => {
        const { cookies, csrfToken } = await registerForPatch('patch-me-invalid');

        await request(app.getHttpServer())
          .patch('/api/auth/me')
          .set('Cookie', cookies)
          .set(CSRF_HEADER_NAME, csrfToken)
          .send(body)
          .expect(400);
      });
    });

    it('rotates the refresh token on /refresh, and rejects reuse of the old one', async () => {
      const email = testEmail('refresh');
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'correct-pass1', name: 'E2E Tester' })
        .expect(201);

      const setCookie = registerResponse.headers['set-cookie'] as unknown as string[];
      const oldRefreshCookie = findSetCookie(setCookie, REFRESH_TOKEN_COOKIE_NAME)!.split(';')[0];
      const csrfCookieRaw = findSetCookie(setCookie, CSRF_COOKIE_NAME)!;
      const csrfCookie = csrfCookieRaw.split(';')[0];
      const csrfToken = cookieValue(csrfCookieRaw)!;

      const refreshResponse = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [oldRefreshCookie, csrfCookie])
        .set(CSRF_HEADER_NAME, csrfToken)
        .expect(200);

      const newRefreshCookie = findSetCookie(
        refreshResponse.headers['set-cookie'] as unknown as string[],
        REFRESH_TOKEN_COOKIE_NAME,
      )!;
      expect(cookieValue(newRefreshCookie)).not.toBe(cookieValue(oldRefreshCookie));

      // Reusing the now-rotated-out refresh token is a theft signal —
      // rejected, and revokes the whole session family.
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [oldRefreshCookie, csrfCookie])
        .set(CSRF_HEADER_NAME, csrfToken)
        .expect(401);
    });

    it('rejects refresh without a matching X-CSRF-Token header', async () => {
      const email = testEmail('refresh-no-csrf');
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'correct-pass1', name: 'E2E Tester' })
        .expect(201);

      const setCookie = registerResponse.headers['set-cookie'] as unknown as string[];
      const refreshCookie = findSetCookie(setCookie, REFRESH_TOKEN_COOKIE_NAME)!.split(';')[0];

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(403);
    });

    it('logs out (revoking the session) and clears cookies; the revoked refresh token then fails', async () => {
      const email = testEmail('logout');
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'correct-pass1', name: 'E2E Tester' })
        .expect(201);

      const setCookie = registerResponse.headers['set-cookie'] as unknown as string[];
      const accessCookie = findSetCookie(setCookie, ACCESS_TOKEN_COOKIE_NAME)!.split(';')[0];
      const refreshCookie = findSetCookie(setCookie, REFRESH_TOKEN_COOKIE_NAME)!.split(';')[0];
      const csrfCookieRaw = findSetCookie(setCookie, CSRF_COOKIE_NAME)!;
      const csrfCookie = csrfCookieRaw.split(';')[0];
      const csrfToken = cookieValue(csrfCookieRaw)!;

      const logoutResponse = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', [accessCookie, refreshCookie, csrfCookie])
        .set(CSRF_HEADER_NAME, csrfToken)
        .expect(204);

      const clearedSetCookie = logoutResponse.headers['set-cookie'] as unknown as string[];
      expect(findSetCookie(clearedSetCookie, ACCESS_TOKEN_COOKIE_NAME)).toMatch(/=;/);
      expect(findSetCookie(clearedSetCookie, REFRESH_TOKEN_COOKIE_NAME)).toMatch(/=;/);
      expect(findSetCookie(clearedSetCookie, CSRF_COOKIE_NAME)).toMatch(/=;/);

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [refreshCookie, csrfCookie])
        .set(CSRF_HEADER_NAME, csrfToken)
        .expect(401);
    });

    it('rejects logout without a matching X-CSRF-Token header', async () => {
      const email = testEmail('logout-no-csrf');
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'correct-pass1', name: 'E2E Tester' })
        .expect(201);

      const setCookie = registerResponse.headers['set-cookie'] as unknown as string[];
      const accessCookie = findSetCookie(setCookie, ACCESS_TOKEN_COOKIE_NAME)!.split(';')[0];

      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', [accessCookie])
        .expect(403);
    });
  });

  describe('with auth.local.enabled: false', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      process.env.CONFIG_PATH = fixture('auth-disabled.config.yml');
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
      // Binds a real ephemeral port instead of relying on supertest's
      // implicit per-request listener — see docs/known-issues.md's flaky
      // e2e-tests entry (mirrors realtime.e2e-spec.ts's rationale, which
      // needs this for its socket.io-client connection).
      await app.listen(0);
    });

    afterAll(async () => {
      await app.close();
      process.env.CONFIG_PATH = originalEnv.CONFIG_PATH;
      process.env.DATABASE_URL = originalEnv.DATABASE_URL;
      process.env.JWT_ACCESS_SECRET = originalEnv.JWT_ACCESS_SECRET;
      process.env.JWT_REFRESH_SECRET = originalEnv.JWT_REFRESH_SECRET;
    });

    it('hides register behind a 404', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: testEmail('disabled'), password: 'super-secret-1', name: 'E2E Tester' })
        .expect(404);
    });

    it('hides login behind a 404', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail('disabled'), password: 'super-secret-1' })
        .expect(404);
    });

    it('keeps /api/auth/me reachable (401, not 404, without a session)', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('keeps /api/auth/refresh reachable (401, not 404, without a refresh cookie)', async () => {
      // A matching (arbitrary) CSRF cookie/header pair is enough to satisfy
      // CsrfGuard — it only checks the pair matches, not that it came from a
      // real session — so this still exercises the route's own "missing
      // refresh cookie" 401, not a CSRF 403.
      const csrfToken = 'e2e-arbitrary-csrf-token';
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [`${CSRF_COOKIE_NAME}=${csrfToken}`])
        .set(CSRF_HEADER_NAME, csrfToken)
        .expect(401);
    });

    it('keeps /api/auth/logout reachable (401, not 404, without a session)', async () => {
      await request(app.getHttpServer()).post('/api/auth/logout').expect(401);
    });
  });
});
