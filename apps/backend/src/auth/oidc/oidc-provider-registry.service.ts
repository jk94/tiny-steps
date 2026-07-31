import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as client from 'openid-client';
import { AppConfig } from '../../config/configuration';
import { OidcProviderConfig } from '../../config/oidc-provider.config';

export interface OidcProviderEntry {
  config: OidcProviderConfig;
  /** The discovered `openid-client` `Configuration`, cached for the app's lifetime. */
  oidcConfig: client.Configuration;
}

/** Shape exposed to unauthenticated clients via `GET /api/auth/oidc/providers` — never leaks secrets. */
export interface PublicOidcProvider {
  id: string;
  displayName: string;
}

/**
 * Bound on `client.discovery()`'s network round trip (in seconds, per
 * `openid-client`'s `DiscoveryRequestOptions.timeout`), so a
 * hanging/slow-to-start IdP can't stall app boot indefinitely — see
 * ADR-0004. Well above what a healthy IdP needs, short enough that boot
 * doesn't hang for minutes on a genuinely unreachable one.
 */
const DISCOVERY_TIMEOUT_SECONDS = 10;

/**
 * Discovers and caches each configured OIDC provider's `openid-client`
 * `Configuration` at application startup.
 *
 * A discovery failure for one provider (network I/O, not a static config
 * error — see ADR-0004) is logged and that provider is simply omitted from
 * the registry, rather than failing the whole app's bootstrap. This keeps a
 * transiently-unreachable or misconfigured IdP from taking down local auth
 * and every other, unrelated feature along with it.
 */
@Injectable()
export class OidcProviderRegistry implements OnModuleInit {
  private readonly logger = new Logger(OidcProviderRegistry.name);
  private readonly providers = new Map<string, OidcProviderEntry>();

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async onModuleInit(): Promise<void> {
    const providerConfigs = this.configService.get('auth.oidc.providers', { infer: true });

    for (const providerConfig of providerConfigs) {
      try {
        const oidcConfig = await client.discovery(
          new URL(providerConfig.issuer),
          providerConfig.clientId,
          providerConfig.clientSecret,
          undefined,
          { timeout: DISCOVERY_TIMEOUT_SECONDS },
        );

        this.providers.set(providerConfig.id, { config: providerConfig, oidcConfig });
        this.logger.log(`Discovered OIDC provider "${providerConfig.id}"`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        // Deliberately not rethrown — see the class doc comment and
        // ADR-0004. This provider is simply absent from `this.providers`,
        // which `get()`/`list()` already treat identically to "never
        // configured" (a 404 on its login/callback routes).
        this.logger.error(
          `OIDC discovery failed for provider "${providerConfig.id}" (issuer "${providerConfig.issuer}"), ` +
            `omitting it from the registry: ${reason}`,
        );
      }
    }
  }

  get(providerId: string): OidcProviderEntry | undefined {
    return this.providers.get(providerId);
  }

  /** Never includes `clientId`/`clientSecret`/`issuer` — safe for the public, unauthenticated route. */
  list(): PublicOidcProvider[] {
    return [...this.providers.values()].map(({ config }) => ({
      id: config.id,
      displayName: config.displayName,
    }));
  }
}
