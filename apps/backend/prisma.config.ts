// Config for the Prisma CLI (generate/migrate). The actual DATABASE_URL is
// provided via the shell/Docker environment or the app's `config.yml` (see
// `src/config/configuration.ts`) — not via a `.env` file, so no dotenv
// dependency is needed here.
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
