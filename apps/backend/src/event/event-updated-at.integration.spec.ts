import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

/**
 * Real-SQLite integration test (NOT mocked Prisma) for the `Event.updatedAt`
 * slice — see ADR-0011. Validates the two assumptions the Last-Write-Wins
 * design rests on and that plain unit tests can't reach:
 *
 *  (a) the `add_event_updated_at` migration backfills `updatedAt` from each
 *      pre-existing row's `createdAt`, not the migration run time; and
 *  (b) how a detail-only edit advances `Event.updatedAt`. Prisma 7 does NOT
 *      auto-apply `@updatedAt` when the top-level Event `data` is empty and only
 *      a nested detail row changes — so the services pass an explicit
 *      `updatedAt: new Date()` to force the bump. This test pins both halves of
 *      that finding: the plain nested update leaves `updatedAt` unchanged, and
 *      the explicit-timestamp variant (what the services do) advances it.
 *
 * Migrations are applied by executing the committed `migration.sql` files
 * directly against a throwaway temp database, rather than shelling out to the
 * Prisma CLI, so the test stays hermetic and fast.
 */

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'prisma', 'migrations');
const NEW_MIGRATION_DIR = '20260814191022_add_event_updated_at';

function migrationDirsSorted(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function applyMigration(db: Database.Database, dir: string): void {
  const sql = readFileSync(join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf8');
  db.exec(sql);
}

function makeTempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'event-updated-at-'));
  return join(dir, 'test.db');
}

describe('Event.updatedAt migration + Prisma @updatedAt (real SQLite)', () => {
  it('(a) backfills updatedAt from createdAt for rows that existed before the migration', () => {
    const dbPath = makeTempDbPath();
    const db = new Database(dbPath);
    try {
      // Apply every migration up to — but excluding — the new one, so the
      // Event table exists without an `updatedAt` column yet.
      for (const dir of migrationDirsSorted()) {
        if (dir === NEW_MIGRATION_DIR) {
          break;
        }
        applyMigration(db, dir);
      }

      // FK enforcement off so we can insert a lone Event without its whole
      // Child/User/Household chain — irrelevant to what this test asserts.
      db.pragma('foreign_keys = OFF');
      const createdAt = 1735689600000; // fixed epoch-ms, distinct from "now"
      db.prepare(
        `INSERT INTO "Event" ("id", "childId", "userId", "type", "occurredAt", "createdAt")
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run('e1', 'c1', 'u1', 'FEEDING', createdAt, createdAt);

      applyMigration(db, NEW_MIGRATION_DIR);

      const row = db
        .prepare(`SELECT "createdAt", "updatedAt" FROM "Event" WHERE "id" = ?`)
        .get('e1') as {
        createdAt: number;
        updatedAt: number;
      };
      expect(row.updatedAt).toBe(row.createdAt);
      expect(row.updatedAt).toBe(createdAt);
    } finally {
      db.close();
      rmSync(dbPath, { force: true });
    }
  });

  it('(b) advances Event.updatedAt on a detail-only edit only when updatedAt is passed explicitly', async () => {
    const dbPath = makeTempDbPath();
    const setupDb = new Database(dbPath);
    try {
      for (const dir of migrationDirsSorted()) {
        applyMigration(setupDb, dir);
      }
    } finally {
      setupDb.close();
    }

    const prisma = new PrismaClient({
      adapter: new PrismaBetterSqlite3({ url: `file:${dbPath}` }),
    });
    try {
      await prisma.user.create({ data: { id: 'u1', email: 'p@example.com' } });
      await prisma.household.create({ data: { id: 'h1', name: 'Home' } });
      await prisma.child.create({
        data: { id: 'c1', householdId: 'h1', name: 'Alex', birthDate: new Date('2024-01-01') },
      });
      const created = await prisma.event.create({
        data: {
          id: 'e1',
          childId: 'c1',
          userId: 'u1',
          type: 'FEEDING',
          occurredAt: new Date('2026-01-01T10:00:00.000Z'),
          feedingDetail: { create: { feedingType: 'SOLID' } },
        },
      });

      // Ensure a measurable gap so a later write's timestamp is strictly later
      // (SQLite/Prisma DateTime is millisecond-resolution).
      await new Promise((resolve) => setTimeout(resolve, 10));

      // A plain nested detail-only update (empty top-level Event data) does NOT
      // bump updatedAt — Prisma emits no parent UPDATE, so `@updatedAt` never
      // fires. This is the trap the services work around.
      const plain = await prisma.event.update({
        where: { id: 'e1' },
        data: { feedingDetail: { update: { note: 'plain' } } },
      });
      expect(plain.updatedAt.getTime()).toBe(created.updatedAt.getTime());

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Passing `updatedAt` explicitly (what the services do) forces the parent
      // UPDATE and advances the timestamp even on a detail-only edit.
      const explicit = await prisma.event.update({
        where: { id: 'e1' },
        data: { updatedAt: new Date(), feedingDetail: { update: { note: 'explicit' } } },
      });
      expect(explicit.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    } finally {
      await prisma.$disconnect();
      rmSync(dbPath, { force: true });
    }
  });

  it('(c) a $transaction-wrapped read-check-write persists the update and advances updatedAt (LWW race-fix regression)', async () => {
    // The services now wrap the LWW read-check-write in `prisma.$transaction`
    // so the check-then-act is atomic against concurrent writers (see ADR-0011).
    // A true two-writer race can't be interleaved here — the better-sqlite3
    // adapter is synchronous, so writes are fully serialized in-process and
    // there is no concurrency to reproduce within Jest. This instead pins that
    // the transactional read+write itself stays correct for the non-concurrent
    // path: the read sees the current row, and the write inside the same
    // transaction commits and advances updatedAt as expected.
    const dbPath = makeTempDbPath();
    const setupDb = new Database(dbPath);
    try {
      for (const dir of migrationDirsSorted()) {
        applyMigration(setupDb, dir);
      }
    } finally {
      setupDb.close();
    }

    const prisma = new PrismaClient({
      adapter: new PrismaBetterSqlite3({ url: `file:${dbPath}` }),
    });
    try {
      await prisma.user.create({ data: { id: 'u1', email: 'p@example.com' } });
      await prisma.household.create({ data: { id: 'h1', name: 'Home' } });
      await prisma.child.create({
        data: { id: 'c1', householdId: 'h1', name: 'Alex', birthDate: new Date('2024-01-01') },
      });
      const created = await prisma.event.create({
        data: {
          id: 'e1',
          childId: 'c1',
          userId: 'u1',
          type: 'FEEDING',
          occurredAt: new Date('2026-01-01T10:00:00.000Z'),
          feedingDetail: { create: { feedingType: 'SOLID', note: 'before' } },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await prisma.$transaction(async (tx) => {
        const existing = await tx.event.findUniqueOrThrow({
          where: { id: 'e1' },
          include: { feedingDetail: true },
        });
        // Stand-in for the LWW gate: it read the current row inside the tx.
        expect(existing.feedingDetail?.note).toBe('before');
        return tx.event.update({
          where: { id: existing.id },
          data: { updatedAt: new Date(), feedingDetail: { update: { note: 'after' } } },
          include: { feedingDetail: true },
        });
      });

      expect(updated.feedingDetail?.note).toBe('after');
      expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());

      // The committed row reflects the transactional write.
      const persisted = await prisma.event.findUniqueOrThrow({
        where: { id: 'e1' },
        include: { feedingDetail: true },
      });
      expect(persisted.feedingDetail?.note).toBe('after');
      expect(persisted.updatedAt.getTime()).toBe(updated.updatedAt.getTime());
    } finally {
      await prisma.$disconnect();
      rmSync(dbPath, { force: true });
    }
  });
});
