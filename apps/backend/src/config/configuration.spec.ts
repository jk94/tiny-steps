import { join } from 'path';
import loadConfiguration from './configuration';

const fixture = (name: string) => join(__dirname, '__fixtures__', name);

describe('loadConfiguration', () => {
  const originalConfigPath = process.env.CONFIG_PATH;

  afterEach(() => {
    process.env.CONFIG_PATH = originalConfigPath;
  });

  it('loads and returns a valid config file without requiring a database.url key', () => {
    process.env.CONFIG_PATH = fixture('valid.config.yml');

    const config = loadConfiguration();

    expect(config).toEqual({
      server: { port: 3000 },
      database: { provider: 'sqlite' },
      auth: { local: { enabled: true }, oidc: { providers: [] } },
    });
  });

  it('throws (fails fast) when the config file still contains a database.url key', () => {
    // `database.url` was removed from the config surface entirely — the
    // connection string is resolved solely from `DATABASE_URL` (see
    // `src/config/database-url.ts`). This guards against silently accepting
    // (and ignoring) a stale `url` key left over in a homelab user's config.
    process.env.CONFIG_PATH = fixture('unexpected-url-key.config.yml');

    expect(() => loadConfiguration()).toThrow(/Invalid configuration/);
  });

  it('throws (fails fast) on an invalid database provider', () => {
    process.env.CONFIG_PATH = fixture('invalid-provider.config.yml');

    expect(() => loadConfiguration()).toThrow(/Invalid configuration/);
  });

  it('throws (fails fast) when database.provider is valid but does not match the generated Prisma Client', () => {
    process.env.CONFIG_PATH = fixture('mismatched-provider.config.yml');

    expect(() => loadConfiguration()).toThrow(/Prisma Client was generated for "sqlite"/);
  });

  it('throws when the config file does not exist', () => {
    process.env.CONFIG_PATH = fixture('does-not-exist.config.yml');

    expect(() => loadConfiguration()).toThrow(/Failed to read config file/);
  });
});
