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
        .send({ email, password: 'super-secret-1' })
        .expect(201);

      expect(response.body).toEqual({
        user: { id: expect.any(String), email, createdAt: expect.any(String) },
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
    });

    it('rejects registering the same email twice with 409', async () => {
      const email = testEmail('duplicate');

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'super-secret-1' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'another-pass1' })
        .expect(409);
    });

    it('rejects login with a wrong password using the generic invalid-credentials message', async () => {
      const email = testEmail('wrong-password');
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'correct-pass1' })
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
        .send({ email, password: 'correct-pass1' })
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

    it('rejects GET /api/auth/me without an access token cookie', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('returns the current user for GET /api/auth/me with a valid access token cookie', async () => {
      const email = testEmail('me');
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'correct-pass1' })
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
        createdAt: registerResponse.body.user.createdAt,
      });
    });

    it('rotates the refresh token on /refresh, and rejects reuse of the old one', async () => {
      const email = testEmail('refresh');
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'correct-pass1' })
        .expect(201);

      const setCookie = registerResponse.headers['set-cookie'] as unknown as string[];
      const oldRefreshCookie = findSetCookie(setCookie, REFRESH_TOKEN_COOKIE_NAME)!;

      const refreshResponse = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [oldRefreshCookie.split(';')[0]])
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
        .set('Cookie', [oldRefreshCookie.split(';')[0]])
        .expect(401);
    });

    it('logs out (revoking the session) and clears cookies; the revoked refresh token then fails', async () => {
      const email = testEmail('logout');
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'correct-pass1' })
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
        .set('Cookie', [refreshCookie])
        .expect(401);
    });

    it('rejects logout without a matching X-CSRF-Token header', async () => {
      const email = testEmail('logout-no-csrf');
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'correct-pass1' })
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
        .send({ email: testEmail('disabled'), password: 'super-secret-1' })
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
      await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);
    });

    it('keeps /api/auth/logout reachable (401, not 404, without a session)', async () => {
      await request(app.getHttpServer()).post('/api/auth/logout').expect(401);
    });
  });
});
