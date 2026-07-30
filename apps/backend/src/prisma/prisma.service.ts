import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { resolveDatabaseUrl } from '../config/database-url';

/**
 * Thin wrapper around the generated Prisma Client, wired into Nest's
 * module lifecycle so the underlying connection opens/closes with the app.
 *
 * The connection URL is resolved via `resolveDatabaseUrl()` — `DATABASE_URL`
 * if set (via the Docker environment, see `docker-compose.yml`), otherwise
 * a code-level default (see `src/config/database-url.ts`). It is NOT read
 * from `config.yml`. Prisma 7 requires an explicit driver adapter —
 * swapping the database provider (see `prisma/schema.prisma` for the full
 * note) means swapping this adapter for the target database as well.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      adapter: new PrismaBetterSqlite3({ url: resolveDatabaseUrl() }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to database');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
