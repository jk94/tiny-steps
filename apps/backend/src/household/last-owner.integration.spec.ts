import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConflictException } from '@nestjs/common';
import Database from 'better-sqlite3';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { RealtimeService } from '../realtime/realtime.service';
import { HouseholdRole } from './household-role.enum';
import { HouseholdService } from './household.service';

/**
 * Real-SQLite integration test (NOT mocked Prisma) for ROL-6, the "a household
 * always keeps at least one OWNER" invariant.
 *
 * The mocked unit tests in `household.service.spec.ts` can only assert that the
 * count happens before the write and inside `$transaction` — they cannot show
 * that the guard actually *sees* a concurrent change, because the mock returns
 * whatever it was told regardless of what else ran. This test uses a real
 * database so the second call genuinely re-reads the owner count the first one
 * left behind.
 *
 * Two owners each demoting the other is the exact scenario the pre-fix code got
 * wrong: both requests counted two owners, both passed, both wrote, and the
 * household ended up with none. The concurrent case below is the one that
 * actually pins the fix (it fails against a count taken outside the
 * transaction); the sequential cases guard the invariant more broadly.
 *
 * Migrations are applied by executing the committed `migration.sql` files
 * directly against a throwaway temp database, mirroring
 * `event/event-updated-at.integration.spec.ts`.
 */

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'prisma', 'migrations');

const HOUSEHOLD_ID = 'h1';
const OWNER_A = 'owner-a';
const OWNER_B = 'owner-b';

function migrationDirsSorted(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function makeMigratedDbPath(): string {
  const dbPath = join(mkdtempSync(join(tmpdir(), 'last-owner-')), 'test.db');
  const db = new Database(dbPath);
  try {
    for (const dir of migrationDirsSorted()) {
      db.exec(readFileSync(join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf8'));
    }
  } finally {
    db.close();
  }
  return dbPath;
}

describe('ROL-6 last-owner invariant (real SQLite)', () => {
  let dbPath: string;
  let prisma: PrismaClient;
  let service: HouseholdService;

  beforeEach(async () => {
    dbPath = makeMigratedDbPath();
    prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${dbPath}` }) });

    // The room eviction is irrelevant here and needs a live Socket.IO server.
    const realtime = { evictFromHousehold: jest.fn().mockResolvedValue(undefined) };
    service = new HouseholdService(
      prisma as unknown as PrismaService,
      realtime as unknown as RealtimeService,
    );

    await prisma.household.create({ data: { id: HOUSEHOLD_ID, name: 'Home' } });
    for (const userId of [OWNER_A, OWNER_B]) {
      await prisma.user.create({ data: { id: userId, email: `${userId}@example.com` } });
      await prisma.membership.create({
        data: { userId, householdId: HOUSEHOLD_ID, role: HouseholdRole.OWNER },
      });
    }
  });

  afterEach(async () => {
    await prisma.$disconnect();
    rmSync(dbPath, { force: true });
  });

  const ownerCount = () =>
    prisma.membership.count({ where: { householdId: HOUSEHOLD_ID, role: HouseholdRole.OWNER } });

  it('keeps an owner when two owners demote each other concurrently', async () => {
    // The regression this pins: with the owner count read *outside* the
    // transaction, both requests observe two owners before either write lands,
    // both pass the guard, and the household is left with none. Counting inside
    // the transaction serializes the two, so exactly one succeeds.
    const results = await Promise.allSettled([
      service.changeMemberRole(HOUSEHOLD_ID, OWNER_A, OWNER_B, HouseholdRole.CO_PARENT),
      service.changeMemberRole(HOUSEHOLD_ID, OWNER_B, OWNER_A, HouseholdRole.CO_PARENT),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejection = results.find((result) => result.status === 'rejected');
    expect(rejection?.reason).toBeInstanceOf(ConflictException);
    expect(await ownerCount()).toBe(1);
  });

  it('refuses the second of two demotions that both started from two owners', async () => {
    // Owner A demotes B — fine, A is still an owner.
    await service.changeMemberRole(HOUSEHOLD_ID, OWNER_A, OWNER_B, HouseholdRole.CO_PARENT);
    expect(await ownerCount()).toBe(1);

    // B now tries to demote A, the last remaining owner. (Unlike the
    // concurrent case above, this sequence was already refused before the
    // transactional fix — it is here as a plain invariant regression guard.)
    await expect(
      service.changeMemberRole(HOUSEHOLD_ID, OWNER_B, OWNER_A, HouseholdRole.CO_PARENT),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(await ownerCount()).toBe(1);
  });

  it('refuses the second of two removals that both started from two owners', async () => {
    await service.removeMember(HOUSEHOLD_ID, OWNER_A, OWNER_B);
    expect(await ownerCount()).toBe(1);

    await expect(service.removeMember(HOUSEHOLD_ID, OWNER_B, OWNER_A)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(await ownerCount()).toBe(1);
  });

  it('rolls the demotion back when the guard fires, leaving the role untouched', async () => {
    await service.changeMemberRole(HOUSEHOLD_ID, OWNER_A, OWNER_B, HouseholdRole.CO_PARENT);

    await expect(
      service.changeMemberRole(HOUSEHOLD_ID, OWNER_B, OWNER_A, HouseholdRole.OBSERVER),
    ).rejects.toBeInstanceOf(ConflictException);

    const ownerA = await prisma.membership.findUniqueOrThrow({
      where: { userId_householdId: { userId: OWNER_A, householdId: HOUSEHOLD_ID } },
    });
    expect(ownerA.role).toBe(HouseholdRole.OWNER);
  });

  it('still allows a demotion while a second owner remains', async () => {
    await prisma.user.create({ data: { id: 'owner-c', email: 'owner-c@example.com' } });
    await prisma.membership.create({
      data: { userId: 'owner-c', householdId: HOUSEHOLD_ID, role: HouseholdRole.OWNER },
    });

    await service.changeMemberRole(HOUSEHOLD_ID, OWNER_A, OWNER_B, HouseholdRole.CO_PARENT);

    expect(await ownerCount()).toBe(2);
  });
});
