import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

/**
 * Thin wrapper around the generated Prisma Client, wired into Nest's
 * module lifecycle so the underlying connection opens/closes with the app.
 *
 * The connection URL is read from `DATABASE_URL` (set via `config.yml` /
 * the Docker environment, see `src/config/configuration.ts`). Prisma 7
 * requires an explicit driver adapter — swapping the database provider
 * (see `prisma/schema.prisma` for the full note) means swapping this
 * adapter for the target database as well.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }),
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
