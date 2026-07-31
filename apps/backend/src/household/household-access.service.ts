import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { MembershipWithHousehold } from './types/household-scoped-request';

/**
 * Resolves a user's `Membership` in a household, or throws `NotFoundException`
 * if none exists — the "you may only access households/children you belong
 * to" access check (see PRD section 3). Extracted out of
 * `HouseholdMembershipGuard` so a future child-scoped guard can resolve
 * `child.householdId` first and then reuse this same lookup/404 semantics
 * without duplicating the Prisma query.
 */
@Injectable()
export class HouseholdAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async findMembershipOrThrow(
    userId: string,
    householdId: string,
  ): Promise<MembershipWithHousehold> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_householdId: { userId, householdId } },
      include: { household: true },
    });

    if (!membership) {
      throw new NotFoundException();
    }

    return membership;
  }
}
