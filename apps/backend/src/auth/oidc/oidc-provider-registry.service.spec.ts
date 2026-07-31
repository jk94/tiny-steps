import { ConfigService } from '@nestjs/config';
import * as client from 'openid-client';
import { AppConfig } from '../../config/configuration';
import { OidcProviderConfig } from '../../config/oidc-provider.config';
import { OidcProviderRegistry } from './oidc-provider-registry.service';

jest.mock('openid-client', () => ({
  discovery: jest.fn(),
}));

const mockedDiscovery = client.discovery as jest.Mock;

const buildProviderConfig = (overrides: Partial<OidcProviderConfig> = {}): OidcProviderConfig => ({
  id: 'keycloak',
  displayName: 'Keycloak',
  issuer: 'https://keycloak.example.com/realms/family',
  clientId: 'baby-tracker',
  clientSecret: 'secret',
  scopes: ['openid', 'profile', 'email'],
  ...overrides,
});

const buildConfigService = (providers: OidcProviderConfig[]): ConfigService<AppConfig, true> =>
  ({
    get: jest.fn().mockReturnValue(providers),
  }) as unknown as ConfigService<AppConfig, true>;

describe('OidcProviderRegistry', () => {
  beforeEach(() => {
    mockedDiscovery.mockReset();
  });

  it('discovers each configured provider once and caches its openid-client Configuration', async () => {
    const providerA = buildProviderConfig({ id: 'keycloak' });
    const providerB = buildProviderConfig({ id: 'google', issuer: 'https://accounts.google.com' });
    const oidcConfigA = { name: 'oidc-config-a' };
    const oidcConfigB = { name: 'oidc-config-b' };
    mockedDiscovery.mockResolvedValueOnce(oidcConfigA).mockResolvedValueOnce(oidcConfigB);

    const registry = new OidcProviderRegistry(buildConfigService([providerA, providerB]));
    await registry.onModuleInit();

    expect(mockedDiscovery).toHaveBeenCalledTimes(2);
    expect(mockedDiscovery).toHaveBeenCalledWith(
      new URL(providerA.issuer),
      providerA.clientId,
      providerA.clientSecret,
      undefined,
      { timeout: 10 },
    );
    expect(mockedDiscovery).toHaveBeenCalledWith(
      new URL(providerB.issuer),
      providerB.clientId,
      providerB.clientSecret,
      undefined,
      { timeout: 10 },
    );

    expect(registry.get('keycloak')).toEqual({ config: providerA, oidcConfig: oidcConfigA });
    expect(registry.get('google')).toEqual({ config: providerB, oidcConfig: oidcConfigB });
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('list() never includes clientId/clientSecret/issuer', async () => {
    const provider = buildProviderConfig();
    mockedDiscovery.mockResolvedValueOnce({ name: 'oidc-config' });

    const registry = new OidcProviderRegistry(buildConfigService([provider]));
    await registry.onModuleInit();

    expect(registry.list()).toEqual([{ id: provider.id, displayName: provider.displayName }]);
    const serialized = JSON.stringify(registry.list());
    expect(serialized).not.toContain(provider.clientSecret);
    expect(serialized).not.toContain(provider.clientId);
    expect(serialized).not.toContain(provider.issuer);
  });

  it('does not throw from onModuleInit when one provider fails discovery, and still registers a second, successful one', async () => {
    const brokenProvider = buildProviderConfig({
      id: 'broken',
      issuer: 'https://broken.example.com',
    });
    const workingProvider = buildProviderConfig({
      id: 'keycloak',
      issuer: 'https://keycloak.example.com/realms/family',
    });
    const oidcConfig = { name: 'oidc-config' };
    mockedDiscovery
      .mockRejectedValueOnce(new Error('issuer unreachable'))
      .mockResolvedValueOnce(oidcConfig);

    const registry = new OidcProviderRegistry(
      buildConfigService([brokenProvider, workingProvider]),
    );

    await expect(registry.onModuleInit()).resolves.toBeUndefined();

    // list() only includes the provider that discovered successfully.
    expect(registry.list()).toEqual([
      { id: workingProvider.id, displayName: workingProvider.displayName },
    ]);
    expect(registry.get(workingProvider.id)).toEqual({
      config: workingProvider,
      oidcConfig,
    });
    // get() for the failed provider's id behaves identically to a
    // never-configured provider id: undefined.
    expect(registry.get(brokenProvider.id)).toBeUndefined();
  });

  it('bounds a hanging/slow discovery() call so onModuleInit still resolves promptly, not indefinitely', async () => {
    // `discovery()` is fully mocked in this suite, so it can't exercise
    // `openid-client`'s own internal timeout enforcement — instead this
    // simulates what that enforcement looks like from the registry's
    // perspective (a delayed rejection) and asserts `onModuleInit()` still
    // resolves promptly rather than hanging on it, plus that the registry
    // *did* ask `discovery()` for a bounded timeout in the first place.
    const provider = buildProviderConfig();
    mockedDiscovery.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('discovery request timed out')), 20);
        }),
    );

    const registry = new OidcProviderRegistry(buildConfigService([provider]));

    const start = Date.now();
    await expect(registry.onModuleInit()).resolves.toBeUndefined();
    // Comfortably below the 10s DISCOVERY_TIMEOUT_SECONDS bound, proving
    // this didn't hang waiting on anything unbounded.
    expect(Date.now() - start).toBeLessThan(2000);

    expect(registry.list()).toEqual([]);
    expect(registry.get(provider.id)).toBeUndefined();
    expect(mockedDiscovery).toHaveBeenCalledWith(
      new URL(provider.issuer),
      provider.clientId,
      provider.clientSecret,
      undefined,
      { timeout: expect.any(Number) as number },
    );
  });

  it('does nothing when no providers are configured', async () => {
    const registry = new OidcProviderRegistry(buildConfigService([]));
    await registry.onModuleInit();

    expect(mockedDiscovery).not.toHaveBeenCalled();
    expect(registry.list()).toEqual([]);
  });
});
