import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HouseholdRole, toHouseholdRole } from './household-role.enum';
import { generateInviteToken, hashInviteToken } from './invite-token.util';

export const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
      const existingMembership = await tx.membership.findUnique({
        where: { userId_householdId: { userId, householdId: invite.householdId } },
      });

      if (!existingMembership) {
        await tx.membership.create({
          data: { userId, householdId: invite.householdId, role },
        });
      }

      await tx.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date(), acceptedByUserId: userId },
      });
    });

    return { household: { id: invite.household.id, name: invite.household.name }, role };
  }
}
