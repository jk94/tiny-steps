import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Household, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { HouseholdRole, toHouseholdRole } from './household-role.enum';

export interface HouseholdSummary {
  id: string;
  name: string;
  role: HouseholdRole;
  createdAt: Date;
}

/**
 * One household member as the API returns them. `userId`/`email` resolve "who
 * logged this event" in the daily timeline (see `TimelineEventList`); `name`,
 * `role` and `joinedAt` were added for the Phase 7.5 member management screen
 * (ROL-9). Purely additive — existing consumers reading only the first two
 * fields are unaffected.
 */
export interface HouseholdMemberSummary {
  userId: string;
  email: string;
  name: string | null;
  role: HouseholdRole;
  /** When this member joined the household (`Membership.createdAt`). */
  joinedAt: Date;
}

@Injectable()
export class HouseholdService {
  private readonly logger = new Logger(HouseholdService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Creates a household with the creating user as its sole OWNER member. */
  async create(userId: string, dto: CreateHouseholdDto): Promise<Household> {
    return this.prisma.household.create({
      data: {
        name: dto.name,
        memberships: { create: { userId, role: HouseholdRole.OWNER } },
      },
    });
  }

  /** Lists every household the user belongs to, with their role in each. */
  async listForUser(userId: string): Promise<HouseholdSummary[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { household: true },
    });

    return memberships.map((membership) => ({
      id: membership.household.id,
      name: membership.household.name,
      role: toHouseholdRole(membership.role),
      createdAt: membership.household.createdAt,
    }));
  }

  /**
   * Lists every member of a household. No role filtering here — the caller
   * (`HouseholdController.listMembers`) is guarded by
   * `HouseholdMembershipGuard` only, since any member may view the member
   * list (same read-access rule as everywhere else in this codebase).
   */
  async listMembers(householdId: string): Promise<HouseholdMemberSummary[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { householdId },
      include: { user: true },
    });

    return memberships.map(toMemberSummary);
  }

  /**
   * Changes another member's role (ROL-6/ROL-7). OWNER-only, enforced by
   * `@RequireRole` on the route.
   *
   * Two invariants are checked here rather than in the guard, because both
   * depend on the *target* row rather than the caller's role:
   * - nobody changes their own role, so an owner cannot lock themselves out
   *   with a single mistaken request;
   * - the last remaining OWNER cannot be demoted, which would leave the
   *   household with nobody able to manage it.
   */
  async changeMemberRole(
    householdId: string,
    actingUserId: string,
    targetUserId: string,
    role: HouseholdRole,
  ): Promise<HouseholdMemberSummary> {
    if (targetUserId === actingUserId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'CANNOT_CHANGE_OWN_ROLE',
        message: 'You cannot change your own role',
      });
    }

    const membership = await this.findMembershipOrThrow(householdId, targetUserId);

    if (membership.role === role) {
      // Idempotent: re-sending the current role is a no-op rather than a
      // pointless write, so a double-submit cannot race with itself.
      return toMemberSummary(membership);
    }

    const isDemotingAnOwner =
      toHouseholdRole(membership.role) === HouseholdRole.OWNER && role !== HouseholdRole.OWNER;

    // Re-count inside the transaction, so a concurrent demotion of the *other*
    // owner cannot slip between the count and this write — see
    // `assertLastOwnerSurvives`.
    const updated = await this.translatingMissingTarget(() =>
      this.prisma.$transaction(async (tx) => {
        if (isDemotingAnOwner) {
          await assertLastOwnerSurvives(tx, householdId, 'LAST_OWNER_CANNOT_BE_DEMOTED');
        }
        return tx.membership.update({
          where: { id: membership.id },
          data: { role },
          include: { user: true },
        });
      }),
    );

    return toMemberSummary(updated);
  }

  /**
   * Removes another member from the household. OWNER-only, enforced by
   * `@RequireRole` on the route.
   *
   * Deliberately leaves the removed user's open invites, refresh tokens and
   * push subscriptions untouched: none of them grant access on their own —
   * every household route re-checks `Membership` on each request (ROL-5), so
   * dropping the row is sufficient. "Leave a household yourself" is out of
   * scope; self-removal is refused so an owner cannot orphan the household in
   * one click.
   *
   * The already-open Socket.IO room is the one place membership is *not*
   * re-checked per message (`handleJoinHousehold` checks once, at join time),
   * so the removed user is evicted from it explicitly afterwards.
   */
  async removeMember(
    householdId: string,
    actingUserId: string,
    targetUserId: string,
  ): Promise<void> {
    if (targetUserId === actingUserId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'CANNOT_REMOVE_SELF',
        message: 'You cannot remove yourself from the household',
      });
    }

    const membership = await this.findMembershipOrThrow(householdId, targetUserId);
    const isRemovingAnOwner = toHouseholdRole(membership.role) === HouseholdRole.OWNER;

    await this.translatingMissingTarget(() =>
      this.prisma.$transaction(async (tx) => {
        if (isRemovingAnOwner) {
          await assertLastOwnerSurvives(tx, householdId, 'LAST_OWNER_CANNOT_BE_REMOVED');
        }
        await tx.membership.delete({ where: { id: membership.id } });
      }),
    );

    // Best-effort and deliberately after the commit: the DB is the source of
    // truth for access, and the broadcast this stops carries no payload of its
    // own (a client that keeps receiving it just refetches and gets a 404).
    // Failing the request over a socket bookkeeping error would be worse than
    // the stale room.
    try {
      await this.realtime.evictFromHousehold(targetUserId, householdId);
    } catch (error) {
      this.logger.warn(
        `Failed to evict user ${targetUserId} from the room of household ${householdId}: ${String(error)}`,
      );
    }
  }

  /**
   * Runs a mutating operation and translates Prisma's "record to
   * update/delete does not exist" (P2025) into the same 404 an unknown member
   * gets everywhere else.
   *
   * Both member-management endpoints read the target `Membership` *before*
   * opening their transaction. Two owners acting on the same target
   * concurrently (both remove, or one removes while the other changes the
   * role) each pass that pre-read; SQLite then serializes the writes, so the
   * loser's `update`/`delete` runs against an id that no longer exists. Without
   * this the loser gets an unhandled 500 instead of the idempotent 404.
   */
  private async translatingMissingTarget<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  /**
   * A membership row with its user, or 404. Uses the same "unknown member is
   * indistinguishable from a nonexistent one" rule as the rest of the app.
   */
  private async findMembershipOrThrow(householdId: string, userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_householdId: { userId, householdId } },
      include: { user: true },
    });

    if (!membership) {
      throw new NotFoundException();
    }

    return membership;
  }
}

/**
 * ROL-6: a household must always keep at least one OWNER.
 *
 * Takes the transaction client rather than the service's own, and must be
 * called *inside* the same `$transaction` as the demotion/removal it guards:
 * counting outside would leave a read-check-write race where two owners
 * demote each other concurrently, both read `ownerCount = 2`, and both commit
 * — leaving the household with no owner at all. Same read-check-write-in-one-
 * transaction reasoning as `InviteService.accept()` and the LWW updates in
 * `FeedingService`/`SleepService` (ADR-0011).
 *
 * The single-owner case is also unreachable through today's routes (both
 * callers are `@RequireRole(...OWNER_ROLES)` and refuse a self-target, so an
 * OWNER target implies a second OWNER caller), but that argument collapses the
 * moment either premise changes — e.g. a future "leave this household" action
 * — so the invariant is enforced rather than left implicit.
 */
async function assertLastOwnerSurvives(
  tx: Prisma.TransactionClient,
  householdId: string,
  code: string,
): Promise<void> {
  const ownerCount = await tx.membership.count({
    where: { householdId, role: HouseholdRole.OWNER },
  });

  if (ownerCount <= 1) {
    throw new ConflictException({
      statusCode: 409,
      code,
      message: 'A household must always have at least one owner',
    });
  }
}

/** Shared shape for every endpoint that returns a member. */
function toMemberSummary(membership: {
  user: { id: string; email: string; name: string | null };
  role: string;
  createdAt: Date;
}): HouseholdMemberSummary {
  return {
    userId: membership.user.id,
    email: membership.user.email,
    name: membership.user.name,
    role: toHouseholdRole(membership.role),
    joinedAt: membership.createdAt,
  };
}
