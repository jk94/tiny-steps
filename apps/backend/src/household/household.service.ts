import { Injectable } from '@nestjs/common';
import { Household } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { HouseholdRole, toHouseholdRole } from './household-role.enum';

export interface HouseholdSummary {
  id: string;
  name: string;
  role: HouseholdRole;
  createdAt: Date;
}

@Injectable()
export class HouseholdService {
  constructor(private readonly prisma: PrismaService) {}

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
}
