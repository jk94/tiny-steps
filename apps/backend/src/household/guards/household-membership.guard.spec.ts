import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HouseholdAccessService } from '../household-access.service';
import { ENTRY_WRITE_ROLES, FULL_WRITE_ROLES } from '../household-permissions';
import { HouseholdRole } from '../household-role.enum';
import type { MembershipWithHousehold } from '../types/household-scoped-request';
import { HouseholdMembershipGuard } from './household-membership.guard';

describe('HouseholdMembershipGuard', () => {
  const userId = 'user-1';
  const householdId = 'household-1';

  const buildMembership = (role: string): MembershipWithHousehold => ({
    id: 'membership-1',
    userId,
    householdId,
    role,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    household: {
      id: householdId,
      name: 'Test Household',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  });

  const buildContext = (
    method = 'GET',
  ): { context: ExecutionContext; request: Record<string, unknown> } => {
    const request: Record<string, unknown> = {
      method,
      user: { id: userId, email: 'parent@example.com', createdAt: new Date() },
      params: { householdId },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
    return { context, request };
  };

  let householdAccessService: jest.Mocked<Pick<HouseholdAccessService, 'findMembershipOrThrow'>>;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let guard: HouseholdMembershipGuard;

  beforeEach(() => {
    householdAccessService = { findMembershipOrThrow: jest.fn() };
    reflector = { getAllAndOverride: jest.fn() };
    guard = new HouseholdMembershipGuard(
      householdAccessService as unknown as HouseholdAccessService,
      reflector as unknown as Reflector,
    );
  });

  it('allows a read request when membership exists and no role metadata is set', async () => {
    const membership = buildMembership(HouseholdRole.CO_PARENT);
    householdAccessService.findMembershipOrThrow.mockResolvedValue(membership);
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const { context, request } = buildContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(householdAccessService.findMembershipOrThrow).toHaveBeenCalledWith(userId, householdId);
    expect(request.membership).toBe(membership);
  });

  it('allows the request when the membership role matches a required role', async () => {
    const membership = buildMembership(HouseholdRole.OWNER);
    householdAccessService.findMembershipOrThrow.mockResolvedValue(membership);
    reflector.getAllAndOverride.mockReturnValue([HouseholdRole.OWNER]);

    const { context } = buildContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('propagates NotFoundException when no membership row exists', async () => {
    householdAccessService.findMembershipOrThrow.mockRejectedValue(new NotFoundException());
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const { context } = buildContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ForbiddenException when membership exists but role is not in the required set', async () => {
    const membership = buildMembership(HouseholdRole.CO_PARENT);
    householdAccessService.findMembershipOrThrow.mockResolvedValue(membership);
    reflector.getAllAndOverride.mockReturnValue([HouseholdRole.OWNER]);

    const { context } = buildContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a CAREGIVER on an entry-write route', async () => {
    const membership = buildMembership(HouseholdRole.CAREGIVER);
    householdAccessService.findMembershipOrThrow.mockResolvedValue(membership);
    reflector.getAllAndOverride.mockReturnValue([...ENTRY_WRITE_ROLES]);

    const { context } = buildContext('POST');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects an OBSERVER on an entry-write route', async () => {
    const membership = buildMembership(HouseholdRole.OBSERVER);
    householdAccessService.findMembershipOrThrow.mockResolvedValue(membership);
    reflector.getAllAndOverride.mockReturnValue([...ENTRY_WRITE_ROLES]);

    const { context } = buildContext('POST');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an OBSERVER on a full-write route', async () => {
    const membership = buildMembership(HouseholdRole.OBSERVER);
    householdAccessService.findMembershipOrThrow.mockResolvedValue(membership);
    reflector.getAllAndOverride.mockReturnValue([...FULL_WRITE_ROLES]);

    const { context } = buildContext('DELETE');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  // ROL-2 fail-closed: an unannotated write endpoint must not silently fall
  // back to "any member may write".
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'throws ForbiddenException on an unannotated %s route',
    async (method) => {
      const membership = buildMembership(HouseholdRole.OWNER);
      householdAccessService.findMembershipOrThrow.mockResolvedValue(membership);
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const { context } = buildContext(method);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('treats an empty role array on a write route as a missing requirement', async () => {
    const membership = buildMembership(HouseholdRole.OWNER);
    householdAccessService.findMembershipOrThrow.mockResolvedValue(membership);
    reflector.getAllAndOverride.mockReturnValue([]);

    const { context } = buildContext('POST');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
