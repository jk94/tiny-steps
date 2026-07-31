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
