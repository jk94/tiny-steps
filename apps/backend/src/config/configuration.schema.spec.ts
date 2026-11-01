import { configValidationSchema } from './configuration.schema';

/** Minimal valid config, spread with `auth.oidc.providers` overrides per test. */
const baseConfig = {
  server: { port: 3000 },
  database: { provider: 'sqlite' as const },
  auth: { local: { enabled: true } },
};

const validProvider = {
  id: 'keycloak',
  displayName: 'Keycloak',
  issuer: 'https://keycloak.example.com/realms/family',
  clientId: 'baby-tracker',
  clientSecret: 'super-secret',
};

describe('configValidationSchema (auth.oidc.providers)', () => {
  it('accepts a config with no OIDC providers configured', () => {
    const { error, value } = configValidationSchema.validate({
      ...baseConfig,
      auth: { ...baseConfig.auth, oidc: {} },
    });

    expect(error).toBeUndefined();
    expect(value.auth.oidc.providers).toEqual([]);
  });

  it('accepts a valid provider entry and defaults scopes when omitted', () => {
    const { error, value } = configValidationSchema.validate({
      ...baseConfig,
      auth: { ...baseConfig.auth, oidc: { providers: [validProvider] } },
    });

    expect(error).toBeUndefined();
    expect(value.auth.oidc.providers).toEqual([
      { ...validProvider, scopes: ['openid', 'profile', 'email'] },
    ]);
  });

  it('keeps explicitly configured scopes instead of the default', () => {
    const { error, value } = configValidationSchema.validate({
      ...baseConfig,
      auth: {
        ...baseConfig.auth,
        oidc: { providers: [{ ...validProvider, scopes: ['openid', 'email'] }] },
      },
    });

    expect(error).toBeUndefined();
    expect(value.auth.oidc.providers[0].scopes).toEqual(['openid', 'email']);
  });

  it.each(['id', 'displayName', 'issuer', 'clientId', 'clientSecret'])(
    'rejects a provider entry missing required field %s',
    (field) => {
      const provider = { ...validProvider };
      delete (provider as Record<string, unknown>)[field];

      const { error } = configValidationSchema.validate({
        ...baseConfig,
        auth: { ...baseConfig.auth, oidc: { providers: [provider] } },
      });

      expect(error).toBeDefined();
    },
  );

  it('rejects a provider id that is not a URL-safe slug', () => {
    const { error } = configValidationSchema.validate({
      ...baseConfig,
      auth: { ...baseConfig.auth, oidc: { providers: [{ ...validProvider, id: 'Not Valid!' }] } },
    });

    expect(error).toBeDefined();
  });

  it('rejects duplicate provider ids', () => {
    const { error } = configValidationSchema.validate({
      ...baseConfig,
      auth: {
        ...baseConfig.auth,
        oidc: {
          providers: [validProvider, { ...validProvider, displayName: 'Keycloak (duplicate)' }],
        },
      },
    });

    expect(error).toBeDefined();
    expect(error?.message).toMatch(/duplicate/i);
  });

  it('rejects an invalid issuer URL', () => {
    const { error } = configValidationSchema.validate({
      ...baseConfig,
      auth: {
        ...baseConfig.auth,
        oidc: { providers: [{ ...validProvider, issuer: 'not-a-url' }] },
      },
    });

    expect(error).toBeDefined();
  });
});

describe('configValidationSchema (push)', () => {
  const baseWithOidc = {
    ...baseConfig,
    auth: { ...baseConfig.auth, oidc: {} },
  };

  it('accepts a config with no push section (push disabled)', () => {
    const { error, value } = configValidationSchema.validate(baseWithOidc);

    expect(error).toBeUndefined();
    expect(value.push).toBeUndefined();
  });

  it('accepts a push section with a Firebase service-account path', () => {
    const { error, value } = configValidationSchema.validate({
      ...baseWithOidc,
      push: { firebase: { serviceAccountPath: './firebase-service-account.json' } },
    });

    expect(error).toBeUndefined();
    expect(value.push.firebase.serviceAccountPath).toBe('./firebase-service-account.json');
  });

  it('rejects a push section without a serviceAccountPath', () => {
    const { error } = configValidationSchema.validate({
      ...baseWithOidc,
      push: { firebase: {} },
    });

    expect(error).toBeDefined();
  });
});

describe('configValidationSchema (alexa)', () => {
  const withOidc = { ...baseConfig, auth: { ...baseConfig.auth, oidc: {} } };
  const validAlexa = {
    skillId: 'amzn1.ask.skill.0a1b2c3d-0000-4000-8000-123456789abc',
    clientId: 'tinysteps-alexa',
    clientSecret: 'x'.repeat(32),
    redirectUris: [
      'https://pitangui.amazon.com/api/skill/link/M2AAAAAAAAAAAA',
      'https://layla.amazon.com/api/skill/link/M2AAAAAAAAAAAA',
    ],
  };

  it('accepts a config without an alexa section (integration disabled)', () => {
    const { error, value } = configValidationSchema.validate(withOidc);
    expect(error).toBeUndefined();
    expect(value.alexa).toBeUndefined();
  });

  it('accepts a valid alexa section and defaults responses to none', () => {
    const { error, value } = configValidationSchema.validate({ ...withOidc, alexa: validAlexa });
    expect(error).toBeUndefined();
    expect(value.alexa).toEqual({ ...validAlexa, responses: {} });
  });

  it.each([
    ['a skill ID that is not an Alexa skill ID', { skillId: 'my-skill' }],
    ['a short client secret', { clientSecret: 'too-short' }],
    ['an http redirect URI', { redirectUris: ['http://pitangui.amazon.com/api/skill/link/X'] }],
    ['no redirect URIs', { redirectUris: [] }],
    [
      'duplicate redirect URIs',
      { redirectUris: [validAlexa.redirectUris[0], validAlexa.redirectUris[0]] },
    ],
  ])('rejects %s', (_label, override) => {
    const { error } = configValidationSchema.validate({
      ...withOidc,
      alexa: { ...validAlexa, ...override },
    });
    expect(error).toBeDefined();
  });

  it('accepts response overrides using known keys and placeholders', () => {
    const { error } = configValidationSchema.validate({
      ...withOidc,
      alexa: {
        ...validAlexa,
        responses: {
          de: { solidLogged: 'Brei für {childName} notiert.' },
          en: { goodbye: 'Bye!' },
        },
      },
    });
    expect(error).toBeUndefined();
  });

  it('rejects an override for an unknown message key', () => {
    const { error } = configValidationSchema.validate({
      ...withOidc,
      alexa: { ...validAlexa, responses: { de: { notAMessage: 'x' } } },
    });
    expect(error?.message).toContain('notAMessage');
  });

  it('rejects an override using a placeholder the template does not provide', () => {
    const { error } = configValidationSchema.validate({
      ...withOidc,
      alexa: { ...validAlexa, responses: { en: { solidLogged: 'Logged for {babyName}.' } } },
    });
    expect(error?.message).toContain('{babyName}');
  });

  it('rejects overrides for a language the skill does not speak', () => {
    const { error } = configValidationSchema.validate({
      ...withOidc,
      alexa: { ...validAlexa, responses: { fr: { goodbye: 'Au revoir' } } },
    });
    expect(error).toBeDefined();
  });
});
