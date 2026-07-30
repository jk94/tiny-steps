import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { configValidationSchema } from './configuration.schema';

export interface AppConfig {
  server: {
    port: number;
  };
  database: {
    provider: 'sqlite' | 'postgresql' | 'mysql';
    url: string;
  };
  auth: {
    local: {
      enabled: boolean;
    };
    oidc: {
      providers: unknown[];
    };
  };
}

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

  return value as AppConfig;
}
