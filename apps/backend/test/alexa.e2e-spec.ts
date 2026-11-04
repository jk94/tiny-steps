import { createHash } from 'crypto';
import { join } from 'path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AlexaRequestVerifier } from '../src/alexa/skill/alexa-request-verifier';
import { AppModule } from '../src/app.module';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../src/auth/guards/csrf.guard';
import { HouseholdRole } from '../src/household/household-role.enum';
import { PrismaService } from '../src/prisma/prisma.service';

const fixture = (name: string) => join(__dirname, '__fixtures__', name);

const CLIENT_ID = 'tinysteps-alexa-e2e';
const CLIENT_SECRET = 'e2e-client-secret-0123456789abcdefghij';
const REDIRECT_URI = 'https://pitangui.amazon.com/api/skill/link/ME2ETEST';
const SKILL_ID = 'amzn1.ask.skill.e2e-test-skill';
const BASIC_AUTH = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`;

function cookieHeaderFrom(setCookie: string[] | undefined): string[] {
  return (setCookie ?? []).map((raw) => raw.split(';')[0]);
}

function csrfFrom(setCookie: string[] | undefined): string {
  const raw = (setCookie ?? []).find((cookie) => cookie.startsWith(`${CSRF_COOKIE_NAME}=`));
  return raw!.split(';')[0].split('=')[1];
}

interface TestUser {
  userId: string;
  cookies: string[];
  csrfToken: string;
}

/**
 * Phase 8 end to end against the real SQLite database: the OAuth account
 * linking round trip, a voice request turning into a real event, the
 * refresh grant, revocation, and the 404 posture when Alexa is off.
 *
 * Amazon's request *signature* is the one thing replaced — it is covered by
 * `alexa-request-verifier.spec.ts` with a test CA; here the verifier is a stub
 * so the test can speak for "Amazon".
 */
describe('Alexa (e2e)', () => {
  const originalEnv = {
    CONFIG_PATH: process.env.CONFIG_PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  };
  const E2E_EMAIL_DOMAIN = '@alexa.e2e.test';

  let app: INestApplication<App>;
  let prisma: PrismaService;
  const verifier = { verify: jest.fn() };

  async function createApp(configFile: string): Promise<INestApplication<App>> {
    process.env.CONFIG_PATH = fixture(configFile);
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AlexaRequestVerifier)
      .useValue(verifier)
      .compile();

    const instance = moduleFixture.createNestApplication<INestApplication<App>>({ rawBody: true });
    instance.setGlobalPrefix('api', { exclude: ['health'] });
    instance.use(cookieParser());
    instance.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await instance.init();
    await instance.listen(0);
    return instance;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = 'file:./prisma/dev.db';
    process.env.JWT_ACCESS_SECRET = 'e2e-test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'e2e-test-refresh-secret';
    app = await createApp('alexa.config.yml');
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
    Object.assign(process.env, originalEnv);
  });

  beforeEach(() => {
    verifier.verify.mockReset().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    const users = await prisma.user.findMany({ where: { email: { endsWith: E2E_EMAIL_DOMAIN } } });
    const userIds = users.map((user) => user.id);
    const memberships = await prisma.membership.findMany({ where: { userId: { in: userIds } } });
    const householdIds = [...new Set(memberships.map((membership) => membership.householdId))];
    const children = await prisma.child.findMany({ where: { householdId: { in: householdIds } } });
    const childIds = children.map((child) => child.id);

    await prisma.alexaAccountLink.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.alexaAuthorizationCode.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.event.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.child.deleteMany({ where: { householdId: { in: householdIds } } });
    await prisma.membership.deleteMany({ where: { householdId: { in: householdIds } } });
    await prisma.household.deleteMany({ where: { id: { in: householdIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  async function registerUser(label: string): Promise<TestUser> {
    const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}${E2E_EMAIL_DOMAIN}`;
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'correct-pass1', name: 'Alexa Tester' })
      .expect(201);
    const setCookie = response.headers['set-cookie'] as unknown as string[];
    return {
      userId: response.body.user.id,
      cookies: cookieHeaderFrom(setCookie),
      csrfToken: csrfFrom(setCookie),
    };
  }

  async function seedChild(owner: TestUser, name = 'Emma') {
    const household = await request(app.getHttpServer())
      .post('/api/households')
      .set('Cookie', owner.cookies)
      .set(CSRF_HEADER_NAME, owner.csrfToken)
      .send({ name: 'Alexa Household' })
      .expect(201);
    const child = await request(app.getHttpServer())
      .post(`/api/households/${household.body.id}/children`)
      .set('Cookie', owner.cookies)
      .set(CSRF_HEADER_NAME, owner.csrfToken)
      .field('name', name)
      .field('birthDate', '2026-05-01')
      .expect(201);
    return { householdId: household.body.id as string, childId: child.body.id as string };
  }

  const authorizeQuery = {
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    state: 'state-from-alexa',
    scope: 'tracking',
  };

  async function approve(user: TestUser, extra: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer())
      .post('/api/alexa/oauth/authorize')
      .set('Cookie', user.cookies)
      .set(CSRF_HEADER_NAME, user.csrfToken)
      .send({ ...authorizeQuery, approve: true, ...extra })
      .expect(200);
    const redirect = new URL(response.body.redirectTo as string);
    return { redirect, code: redirect.searchParams.get('code')! };
  }

  function tokenRequest(form: Record<string, string>, auth: string | null = BASIC_AUTH) {
    const req = request(app.getHttpServer()).post('/api/alexa/oauth/token').type('form');
    return (auth ? req.set('Authorization', auth) : req).send(form);
  }

  async function link(user: TestUser, extra: Record<string, unknown> = {}) {
    const { code } = await approve(user, extra);
    const response = await tokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }).expect(200);
    return response.body as { access_token: string; refresh_token: string; expires_in: number };
  }

  function skillRequest(accessToken: string | undefined, intentName: string, slots = {}) {
    return request(app.getHttpServer())
      .post('/api/alexa/skill')
      .set('Content-Type', 'application/json')
      .send({
        version: '1.0',
        context: {
          System: {
            application: { applicationId: SKILL_ID },
            user: { userId: 'amzn1.ask.account.e2e', accessToken },
            device: { deviceId: 'amzn1.ask.device.E2E' },
          },
        },
        request: {
          type: 'IntentRequest',
          requestId: 'req-e2e',
          timestamp: new Date().toISOString(),
          locale: 'de-DE',
          intent: { name: intentName, confirmationStatus: 'NONE', slots },
        },
      });
  }

  const diaperSlots = {
    diaperType: {
      name: 'diaperType',
      value: 'nass',
      resolutions: {
        resolutionsPerAuthority: [
          {
            authority: 'amzn1.er-authority.e2e',
            status: { code: 'ER_SUCCESS_MATCH' },
            values: [{ value: { name: 'nass', id: 'PEE' } }],
          },
        ],
      },
    },
  };

  describe('consent page API', () => {
    it('lists the children the user can pick as default', async () => {
      const owner = await registerUser('consent');
      const { childId } = await seedChild(owner);

      const response = await request(app.getHttpServer())
        .get('/api/alexa/oauth/authorize')
        .query(authorizeQuery)
        .set('Cookie', owner.cookies)
        .expect(200);

      expect(response.body.children).toEqual([
        { id: childId, name: 'Emma', householdName: 'Alexa Household' },
      ]);
    });

    it.each([
      ['an unknown client', { client_id: 'someone-else' }, 'INVALID_CLIENT'],
      [
        'an unregistered redirect URI',
        { redirect_uri: 'https://evil.example/cb' },
        'INVALID_REDIRECT_URI',
      ],
      ['a token response type', { response_type: 'token' }, 'UNSUPPORTED_RESPONSE_TYPE'],
      [
        'a plain PKCE challenge',
        { code_challenge: 'abc', code_challenge_method: 'plain' },
        'INVALID_PKCE',
      ],
    ])('rejects %s without redirecting', async (_label, override, code) => {
      const owner = await registerUser('consent-invalid');
      const response = await request(app.getHttpServer())
        .get('/api/alexa/oauth/authorize')
        .query({ ...authorizeQuery, ...override })
        .set('Cookie', owner.cookies)
        .expect(400);
      expect(response.body.code).toBe(code);
    });

    it('requires a session and the CSRF header', async () => {
      await request(app.getHttpServer())
        .get('/api/alexa/oauth/authorize')
        .query(authorizeQuery)
        .expect(401);

      const owner = await registerUser('consent-csrf');
      await request(app.getHttpServer())
        .post('/api/alexa/oauth/authorize')
        .set('Cookie', owner.cookies)
        .send({ ...authorizeQuery, approve: true })
        .expect(403);
    });

    it('sends a denial back to Alexa with access_denied and the state', async () => {
      const owner = await registerUser('consent-deny');
      const response = await request(app.getHttpServer())
        .post('/api/alexa/oauth/authorize')
        .set('Cookie', owner.cookies)
        .set(CSRF_HEADER_NAME, owner.csrfToken)
        .send({ ...authorizeQuery, approve: false })
        .expect(200);

      const redirect = new URL(response.body.redirectTo);
      expect(redirect.origin + redirect.pathname).toBe(REDIRECT_URI);
      expect(redirect.searchParams.get('error')).toBe('access_denied');
      expect(redirect.searchParams.get('state')).toBe('state-from-alexa');
    });

    it('refuses a default child from someone else’s household', async () => {
      const owner = await registerUser('consent-own');
      const stranger = await registerUser('consent-stranger');
      const { childId } = await seedChild(stranger);

      const response = await request(app.getHttpServer())
        .post('/api/alexa/oauth/authorize')
        .set('Cookie', owner.cookies)
        .set(CSRF_HEADER_NAME, owner.csrfToken)
        .send({ ...authorizeQuery, approve: true, default_child_id: childId })
        .expect(400);
      expect(response.body.code).toBe('CHILD_NOT_ACCESSIBLE');
    });
  });

  describe('token endpoint', () => {
    it('exchanges a code for tokens once and stores only hashes', async () => {
      const owner = await registerUser('token');
      const { redirect, code } = await approve(owner);
      expect(redirect.searchParams.get('state')).toBe('state-from-alexa');

      const response = await tokenRequest({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }).expect(200);

      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toMatchObject({ token_type: 'Bearer', expires_in: 3600 });
      const link = await prisma.alexaAccountLink.findFirstOrThrow({
        where: { userId: owner.userId },
      });
      expect(link.refreshTokenHash).toBe(
        createHash('sha256').update(response.body.refresh_token).digest('hex'),
      );
    });

    it('revokes the link when a code is replayed', async () => {
      const owner = await registerUser('token-replay');
      const { code } = await approve(owner);
      const form = { grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI };

      const first = await tokenRequest(form).expect(200);
      const replay = await tokenRequest(form).expect(400);

      expect(replay.body).toEqual({ error: 'invalid_grant' });
      const link = await prisma.alexaAccountLink.findFirstOrThrow({
        where: { userId: owner.userId },
      });
      expect(link.revokedAt).not.toBeNull();
      const skill = await skillRequest(
        first.body.access_token,
        'LogDiaperIntent',
        diaperSlots,
      ).expect(200);
      expect(skill.body.response.card).toEqual({ type: 'LinkAccount' });
    });

    it('rejects a wrong client secret with 401 and a challenge', async () => {
      const owner = await registerUser('token-client');
      const { code } = await approve(owner);
      const wrong = `Basic ${Buffer.from(`${CLIENT_ID}:wrong`).toString('base64')}`;

      const response = await tokenRequest(
        { grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI },
        wrong,
      ).expect(401);

      expect(response.body).toEqual({ error: 'invalid_client' });
      expect(response.headers['www-authenticate']).toContain('Basic');
    });

    it('accepts client credentials in the body', async () => {
      const owner = await registerUser('token-body');
      const { code } = await approve(owner);
      await tokenRequest(
        {
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        },
        null,
      ).expect(200);
    });

    it('rejects a redirect URI that differs from the authorization request', async () => {
      const owner = await registerUser('token-redirect');
      const { code } = await approve(owner);
      await tokenRequest({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://layla.amazon.com/api/skill/link/ME2ETEST',
      }).expect(400);
    });

    it('verifies a PKCE code_verifier when a challenge was sent', async () => {
      const owner = await registerUser('token-pkce');
      const verifierString = 'v'.repeat(43);
      const challenge = createHash('sha256').update(verifierString).digest('base64url');
      const { code } = await approve(owner, {
        code_challenge: challenge,
        code_challenge_method: 'S256',
      });
      const form = { grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI };

      await tokenRequest({ ...form, code_verifier: 'w'.repeat(43) }).expect(400);
      // The failed attempt consumed the code — PKCE failures are not retryable.
      await tokenRequest({ ...form, code_verifier: verifierString }).expect(400);
    });

    it('refreshes without rotating the refresh token', async () => {
      const owner = await registerUser('token-refresh');
      const tokens = await link(owner);

      const refreshed = await tokenRequest({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
      }).expect(200);

      expect(refreshed.body.access_token).not.toBe(tokens.access_token);
      expect(refreshed.body.refresh_token).toBeUndefined();
      // Both access tokens stay valid until they expire.
      for (const token of [tokens.access_token, refreshed.body.access_token]) {
        const response = await skillRequest(token, 'StartSleepIntent').expect(200);
        expect(response.body.response.card).toBeUndefined();
      }
    });

    it('rejects unsupported grant types', async () => {
      const response = await tokenRequest({ grant_type: 'password' }).expect(400);
      expect(response.body).toEqual({ error: 'unsupported_grant_type' });
    });
  });

  describe('skill endpoint', () => {
    it('records a voice entry as a real event attributed to the linked user', async () => {
      const owner = await registerUser('skill');
      const { childId } = await seedChild(owner);
      const tokens = await link(owner);

      const response = await skillRequest(
        tokens.access_token,
        'LogDiaperIntent',
        diaperSlots,
      ).expect(200);

      expect(response.body.response.outputSpeech.text).toBe(
        'Okay, nasse Windel für Emma eingetragen.',
      );
      const event = await prisma.event.findFirstOrThrow({
        where: { childId },
        include: { diaperDetail: true },
      });
      expect(event.userId).toBe(owner.userId);
      expect(event.diaperDetail?.diaperType).toBe('PEE');
      expect(verifier.verify).toHaveBeenCalled();
    });

    it('answers an observer with a fallback and writes nothing', async () => {
      const owner = await registerUser('skill-owner');
      const observer = await registerUser('skill-observer');
      const { householdId, childId } = await seedChild(owner);
      await prisma.membership.create({
        data: { userId: observer.userId, householdId, role: HouseholdRole.OBSERVER },
      });
      const tokens = await link(observer);

      const response = await skillRequest(
        tokens.access_token,
        'LogDiaperIntent',
        diaperSlots,
      ).expect(200);

      expect(response.body.response.outputSpeech.text).toContain('Als Beobachter');
      expect(await prisma.event.count({ where: { childId } })).toBe(0);
    });

    it('uses the default child picked on the consent page', async () => {
      const owner = await registerUser('skill-default');
      await seedChild(owner, 'Emma');
      const paul = await seedChild(owner, 'Paul');
      const tokens = await link(owner, { default_child_id: paul.childId });

      await skillRequest(tokens.access_token, 'LogDiaperIntent', diaperSlots).expect(200);

      expect(await prisma.event.count({ where: { childId: paul.childId } })).toBe(1);
    });

    it('applies response overrides from config.yml', async () => {
      const owner = await registerUser('skill-override');
      const tokens = await link(owner);
      const response = await skillRequest(tokens.access_token, 'AMAZON.StopIntent').expect(200);
      expect(response.body.response.outputSpeech.text).toBe('Tschüss aus dem e2e-Test!');
    });

    it('rejects a request that fails verification with a bare 400', async () => {
      const { AlexaVerificationError } = await import('../src/alexa/skill/alexa-request-verifier');
      verifier.verify.mockRejectedValue(new AlexaVerificationError('bad signature'));
      await skillRequest(undefined, 'AMAZON.HelpIntent').expect(400);
    });

    it('rejects a body that is not an Alexa request', async () => {
      await request(app.getHttpServer())
        .post('/api/alexa/skill')
        .send({ hello: 'world' })
        .expect(400);
      expect(verifier.verify).not.toHaveBeenCalled();
    });
  });

  describe('link management', () => {
    it('lists, updates and revokes the user’s own links', async () => {
      const owner = await registerUser('links');
      const { childId } = await seedChild(owner);
      const tokens = await link(owner);
      const other = await registerUser('links-other');

      const overview = await request(app.getHttpServer())
        .get('/api/alexa/links')
        .set('Cookie', owner.cookies)
        .expect(200);
      expect(overview.body.enabled).toBe(true);
      expect(overview.body.links).toHaveLength(1);
      const linkId = overview.body.links[0].id as string;

      await request(app.getHttpServer())
        .patch(`/api/alexa/links/${linkId}`)
        .set('Cookie', owner.cookies)
        .set(CSRF_HEADER_NAME, owner.csrfToken)
        .send({ defaultChildId: childId })
        .expect(200);

      // Someone else's link is indistinguishable from a missing one.
      await request(app.getHttpServer())
        .delete(`/api/alexa/links/${linkId}`)
        .set('Cookie', other.cookies)
        .set(CSRF_HEADER_NAME, other.csrfToken)
        .expect(404);

      await request(app.getHttpServer())
        .delete(`/api/alexa/links/${linkId}`)
        .set('Cookie', owner.cookies)
        .set(CSRF_HEADER_NAME, owner.csrfToken)
        .expect(204);

      const afterRevoke = await skillRequest(
        tokens.access_token,
        'LogDiaperIntent',
        diaperSlots,
      ).expect(200);
      expect(afterRevoke.body.response.card).toEqual({ type: 'LinkAccount' });
      await tokenRequest({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
      }).expect(400);
    });
  });

  describe('with Alexa disabled', () => {
    let disabledApp: INestApplication<App>;

    beforeAll(async () => {
      disabledApp = await createApp('e2e.config.yml');
    });

    afterAll(async () => {
      await disabledApp.close();
    });

    it('hides every Alexa route', async () => {
      await request(disabledApp.getHttpServer()).post('/api/alexa/skill').send({}).expect(404);
      await request(disabledApp.getHttpServer())
        .post('/api/alexa/oauth/token')
        .type('form')
        .send({ grant_type: 'refresh_token' })
        .expect(404);
    });

    it('reports the integration as disabled to the profile page', async () => {
      const email = `disabled-${Date.now()}${E2E_EMAIL_DOMAIN}`;
      const registered = await request(disabledApp.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'correct-pass1', name: 'Alexa Tester' })
        .expect(201);
      const cookies = cookieHeaderFrom(registered.headers['set-cookie'] as unknown as string[]);

      const response = await request(disabledApp.getHttpServer())
        .get('/api/alexa/links')
        .set('Cookie', cookies)
        .expect(200);
      expect(response.body).toEqual({ enabled: false, links: [], children: [] });
    });
  });
});
