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
    );
    expect(mockedDiscovery).toHaveBeenCalledWith(
      new URL(providerB.issuer),
      providerB.clientId,
      providerB.clientSecret,
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

  it('fails fast (rejects onModuleInit) when discovery() rejects for any provider', async () => {
    const provider = buildProviderConfig();
    mockedDiscovery.mockRejectedValueOnce(new Error('issuer unreachable'));

    const registry = new OidcProviderRegistry(buildConfigService([provider]));

    await expect(registry.onModuleInit()).rejects.toThrow(/OIDC discovery failed/);
  });

  it('does nothing when no providers are configured', async () => {
    const registry = new OidcProviderRegistry(buildConfigService([]));
    await registry.onModuleInit();

    expect(mockedDiscovery).not.toHaveBeenCalled();
    expect(registry.list()).toEqual([]);
  });
});
