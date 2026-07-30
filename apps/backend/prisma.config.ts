// Config for the Prisma CLI (generate/migrate). The actual DATABASE_URL is
// provided via the shell/Docker environment, falling back to a code-level
// default if unset (see `src/config/database-url.ts`) — not via a `.env`
// file, so no dotenv dependency is needed here. It is NOT read from
// `config.yml`.
import { defineConfig } from 'prisma/config';
import { resolveDatabaseUrl } from './src/config/database-url';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: resolveDatabaseUrl(),
  },
});
