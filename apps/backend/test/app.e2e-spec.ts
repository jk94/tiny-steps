import { join } from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppModule (e2e)', () => {
  let app: INestApplication<App>;
  const originalConfigPath = process.env.CONFIG_PATH;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalJwtAccessSecret = process.env.JWT_ACCESS_SECRET;
  const originalJwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

  beforeEach(async () => {
    // Point the loader at a minimal fixture config instead of the default
    // `./config.yml`, which doesn't exist on a clean checkout and would
    // otherwise make `ConfigModule.forRoot`'s eager `loadConfiguration` call
    // throw at module-compile time (see `src/config/configuration.ts`).
    process.env.CONFIG_PATH = join(__dirname, '__fixtures__', 'e2e.config.yml');
    // Avoid touching the filesystem / a real database file for this test —
    // PrismaService connects eagerly as part of module init (see
    // `src/prisma/prisma.module.ts`), so give it a throwaway in-memory DB.
    process.env.DATABASE_URL = ':memory:';
    // AuthModule fails to bootstrap without these (see
    // `src/config/jwt.config.ts`) — required regardless of what this test
    // actually exercises, since it boots the full AppModule.
    process.env.JWT_ACCESS_SECRET = 'e2e-test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'e2e-test-refresh-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirrors the real bootstrap in `src/main.ts`: API routes under `/api`,
    // `/health` excluded from that prefix.
    app.setGlobalPrefix('api', { exclude: ['health'] });
    await app.init();
    // Binds a real ephemeral port instead of relying on supertest's implicit
    // per-request listener — see docs/known-issues.md's flaky e2e-tests
    // entry (mirrors realtime.e2e-spec.ts's rationale, which needs this for
    // its socket.io-client connection).
    await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
    process.env.CONFIG_PATH = originalConfigPath;
    process.env.DATABASE_URL = originalDatabaseUrl;
    process.env.JWT_ACCESS_SECRET = originalJwtAccessSecret;
    process.env.JWT_REFRESH_SECRET = originalJwtRefreshSecret;
  });

  it('GET /health returns ok status outside the /api prefix', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
        expect(typeof body.uptime).toBe('number');
        expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
      });
  });

  it('GET /api reaches the placeholder AppController route under the global prefix', () => {
    return request(app.getHttpServer()).get('/api').expect(200).expect('Hello World!');
  });
});
