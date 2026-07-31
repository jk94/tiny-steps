import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { configValidationSchema } from './configuration.schema';
import { OidcProviderConfig } from './oidc-provider.config';

export interface AppConfig {
  server: {
    port: number;
  };
  database: {
    provider: 'sqlite' | 'postgresql' | 'mysql';
  };
  auth: {
    local: {
      enabled: boolean;
    };
    oidc: {
      providers: OidcProviderConfig[];
    };
  };
}

/**
 * The database provider `apps/backend/prisma/schema.prisma` is actually
 * generated for (its `datasource.provider` is a static string — see the
 * comment there). Kept as a constant here so `config.yml`'s
 * `database.provider` can be sanity-checked against it at startup: this
 * catches a homelab user pointing `config.yml` at a provider the running
 * Prisma Client was never generated for. It is NOT a runtime switch — see
 * `config.example.yml` and the root README for the full explanation.
 */
const GENERATED_DATABASE_PROVIDER: AppConfig['database']['provider'] = 'sqlite';

/**
 * Loads and validates `config.yml` (path overridable via `CONFIG_PATH`).
 *
 * Note: `@nestjs/config`'s built-in `validate`/`validationSchema` options
 * only validate `process.env`, not values returned by `load` factories like
 * this one — so validation happens here instead, and throwing here prevents
 * `ConfigModule` (and therefore the whole app) from bootstrapping with an
 * invalid config, which is what actually gives us fail-fast behaviour.
 */
export default function loadConfiguration(): AppConfig {
  const configPath = process.env.CONFIG_PATH ?? './config.yml';

  let rawConfig: unknown;
  try {
    const fileContents = readFileSync(configPath, 'utf8');
    rawConfig = yaml.load(fileContents);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read config file at "${configPath}": ${reason}`, { cause: error });
  }

  const { error, value } = configValidationSchema.validate(rawConfig, {
    abortEarly: false,
    allowUnknown: false,
  });

  if (error) {
    throw new Error(`Invalid configuration in "${configPath}": ${error.message}`);
  }

  const config = value as AppConfig;

  if (config.database.provider !== GENERATED_DATABASE_PROVIDER) {
    throw new Error(
      `Invalid configuration in "${configPath}": database.provider is "${config.database.provider}", ` +
        `but the Prisma Client was generated for "${GENERATED_DATABASE_PROVIDER}". Changing this value ` +
        'alone does not switch databases — see config.example.yml for how to actually migrate providers.',
    );
  }

  return config;
}
