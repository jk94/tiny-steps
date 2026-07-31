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
 * Discovers and caches each configured OIDC provider's `openid-client`
 * `Configuration` at application startup.
 *
 * Discovery failures fail the whole app's bootstrap (see `onModuleInit`),
 * consistent with this app's existing config posture (`loadConfiguration()`,
 * `resolveJwtSecrets()`) — a misconfigured OIDC provider should stop the app
 * from starting, not silently produce a broken login button discovered only
 * at a user's login attempt.
 */
@Injectable()
export class OidcProviderRegistry implements OnModuleInit {
  private readonly logger = new Logger(OidcProviderRegistry.name);
  private readonly providers = new Map<string, OidcProviderEntry>();

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async onModuleInit(): Promise<void> {
    const providerConfigs = this.configService.get('auth.oidc.providers', { infer: true });

    for (const providerConfig of providerConfigs) {
      const oidcConfig = await client
        .discovery(
          new URL(providerConfig.issuer),
          providerConfig.clientId,
          providerConfig.clientSecret,
        )
        .catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(
            `OIDC discovery failed for provider "${providerConfig.id}" (issuer "${providerConfig.issuer}"): ${reason}`,
            { cause: error },
          );
        });

      this.providers.set(providerConfig.id, { config: providerConfig, oidcConfig });
      this.logger.log(`Discovered OIDC provider "${providerConfig.id}"`);
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
