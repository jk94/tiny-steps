import { Injectable } from '@nestjs/common';
import { HouseholdRole, toHouseholdRole } from '../household/household-role.enum';
import { PrismaService } from '../prisma/prisma.service';

/**
 * One child a user can reach through any of their memberships, together with
 * the role they hold in that child's household.
 */
export interface AccessibleChild {
  id: string;
  name: string;
  householdId: string;
  householdName: string;
  role: HouseholdRole;
}

/**
 * Every child the user can reach, across all their households (ALX-9: a user
 * may belong to several households, e.g. separated parents).
 *
 * Voice requests carry no household in their URL, so the household-scoped
 * route guard cannot run; this lookup is its in-process equivalent: a child the
 * user has no membership for simply does not appear, and the role comes from
 * that one membership, read through `toHouseholdRole()` (ROL-1).
 *
 * Ordered by household, then by child creation — the order the app lists them
 * in, so "Emma oder Paul" sounds the way the household list looks.
 */
@Injectable()
export class AlexaChildDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async listAccessibleChildren(userId: string): Promise<AccessibleChild[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        household: {
          include: { children: { orderBy: { createdAt: 'asc' } } },
        },
      },
    });

    return memberships.flatMap((membership) => {
      const role = toHouseholdRole(membership.role);
      return membership.household.children.map((child) => ({
        id: child.id,
        name: child.name,
        householdId: membership.household.id,
        householdName: membership.household.name,
        role,
      }));
    });
  }

  async findAccessibleChild(userId: string, childId: string): Promise<AccessibleChild | null> {
    const children = await this.listAccessibleChildren(userId);
    return children.find((child) => child.id === childId) ?? null;
  }
}
