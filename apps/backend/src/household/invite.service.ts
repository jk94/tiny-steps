import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HouseholdRole, toHouseholdRole } from './household-role.enum';
import { generateInviteToken, hashInviteToken } from './invite-token.util';

export const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Prisma's unique-constraint-violation error code (see docs.prisma.io). */
const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

export type InvitePreviewStatus = 'invalid' | 'expired' | 'used' | 'revoked' | 'valid';

export interface InvitePreview {
  status: InvitePreviewStatus;
  // Only populated for status === 'valid' — minimizes leakage about
  // non-valid invites (e.g. a stale/guessed token) to an unauthenticated caller.
  householdName?: string;
  expiresAt?: Date;
}

export interface CreatedInvite {
  token: string;
  expiresAt: Date;
}

export interface AcceptedInvite {
  household: { id: string; name: string };
  role: HouseholdRole;
}

@Injectable()
export class InviteService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a fresh invite for a household. The raw `token` is returned
   * once to the caller (to share via link/code) — only its hash is
   * persisted, and the raw value is never logged.
   */
  async create(createdByUserId: string, householdId: string): Promise<CreatedInvite> {
    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS);

    await this.prisma.invite.create({
      data: {
        tokenHash: hashInviteToken(token),
        householdId,
        createdByUserId,
        role: HouseholdRole.CO_PARENT,
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  /**
   * Unauthenticated preview of an invite token's status. Distinguishes
   * invalid/expired/used/revoked/valid so a frontend can show a helpful
   * message before the user is asked to log in/register — unlike
   * `accept()`, which deliberately collapses all of these into a single
   * 404.
   */
  async preview(token: string): Promise<InvitePreview> {
    const invite = await this.prisma.invite.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      include: { household: true },
    });

    if (!invite) {
      return { status: 'invalid' };
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      return { status: 'expired' };
    }
    if (invite.acceptedAt) {
      return { status: 'used' };
    }
    if (invite.revokedAt) {
      return { status: 'revoked' };
    }

    return { status: 'valid', householdName: invite.household.name, expiresAt: invite.expiresAt };
  }

  /**
   * Accepts an invite on behalf of `userId`. Any invalid state (unknown
   * token, expired, revoked, already accepted) throws a uniform
   * `NotFoundException` — deliberately not the more specific statuses
   * `preview()` exposes, since this is an authenticated, state-changing
   * action where over-precise errors aren't useful to a legitimate caller
   * and would leak invite state to a guessing attacker.
   *
   * Idempotent: if the user already has a `Membership` in the target
   * household, no duplicate is created, but the invite is still consumed
   * (stamped as accepted) so it can't be replayed. Both writes happen in a
   * transaction — they must succeed or fail together.
   *
   * The `isUsable` check below runs against a row read *before* the
   * transaction, so it can't be relied on as the source of truth for the
   * writes themselves — a concurrent request could accept/revoke the same
   * invite in between. The transaction therefore re-validates usability
   * atomically via a conditional `updateMany` (mirrors the refresh-token
   * rotation guard in `AuthService.refresh`), instead of trusting the
   * earlier read.
   */
  async accept(token: string, userId: string): Promise<AcceptedInvite> {
    const invite = await this.prisma.invite.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      include: { household: true },
    });

    const isUsable =
      invite !== null &&
      invite.expiresAt.getTime() >= Date.now() &&
      invite.revokedAt === null &&
      invite.acceptedAt === null;

    if (!isUsable) {
      throw new NotFoundException();
    }

    const role = toHouseholdRole(invite.role);

    await this.prisma.$transaction(async (tx) => {
      // Atomically consume the invite: the WHERE clause only matches (and
      // thus only stamps) a row that's still usable at the moment of the
      // write. A separate read-then-write here would leave a race where two
      // concurrent accepts of the same token both pass the pre-transaction
      // check above before either write lands, letting both grant
      // membership from a single-use invite.
      const updateResult = await tx.invite.updateMany({
        where: {
          id: invite.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gte: new Date() },
        },
        data: { acceptedAt: new Date(), acceptedByUserId: userId },
      });

      const existingMembership = await tx.membership.findUnique({
        where: { userId_householdId: { userId, householdId: invite.householdId } },
      });

      if (updateResult.count !== 1) {
        if (existingMembership) {
          // This exact invite was already consumed by this exact user —
          // most likely a concurrent duplicate of this same request (e.g. a
          // UI double-click). Treat it as the same idempotent success as
          // any other already-a-member case rather than a hard failure.
          return;
        }
        // Someone else (or a prior concurrent request) already
        // consumed/invalidated this invite between the initial read above
        // and this transaction — collapse into the same uniform "invalid
        // invite" case the pre-check uses.
        throw new NotFoundException();
      }

      if (existingMembership) {
        // Idempotent: the user already has a Membership (e.g. from a
        // different invite to the same household) — the invite is still
        // consumed above so it can't be replayed, but no duplicate
        // Membership is created.
        return;
      }

      try {
        await tx.membership.create({
          data: { userId, householdId: invite.householdId, role },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
        ) {
          // Backstop for a same-user race not covered by the invite-level
          // guard above (e.g. two different invites to the same household
          // accepted concurrently): another transaction created the
          // Membership between our findUnique above and this create.
          return;
        }
        throw error;
      }
    });

    return { household: { id: invite.household.id, name: invite.household.name }, role };
  }
}
