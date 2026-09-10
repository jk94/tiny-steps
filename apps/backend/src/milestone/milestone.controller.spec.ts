import { CsrfGuard } from '../auth/guards/csrf.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import type { HouseholdActor } from '../household/decorators/household-actor.decorator';
import { HOUSEHOLD_ROLES_KEY } from '../household/guards/require-role.decorator';
import { ENTRY_WRITE_ROLES, FULL_WRITE_ROLES } from '../household/household-permissions';
import { HouseholdRole } from '../household/household-role.enum';
import { MilestoneCategory } from './milestone-category.enum';
import { MilestoneTemplate } from './milestone-template.enum';
import { MilestoneController } from './milestone.controller';
import { MilestoneService } from './milestone.service';
import type { MilestoneSummary } from './milestone.service';

const HOUSEHOLD_ID = 'household-1';
const CHILD_ID = 'child-1';
const MILESTONE_ID = 'milestone-1';

// Role scoping (Phase 7.5): the controller only forwards the injected actor,
// so one representative value is enough here — the role rules themselves are
// covered by the guard, service and e2e specs.
const OWNER_ACTOR: HouseholdActor = { userId: 'user-1', role: HouseholdRole.OWNER };

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'parent@example.com',
  name: 'Parent',
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
};

const summary: MilestoneSummary = {
  id: MILESTONE_ID,
  childId: CHILD_ID,
  userId: user.id,
  templateKey: MilestoneTemplate.SITS_UNSUPPORTED,
  title: 'Sitzt frei',
  category: MilestoneCategory.MOTOR,
  achievedAt: '2025-08-20T00:00:00.000Z',
  ageInDaysAtMilestone: 212,
  ageInMonthsAtMilestone: 7,
  note: null,
  createdAt: '2025-08-21T09:00:00.000Z',
  updatedAt: '2025-08-21T09:00:00.000Z',
  photos: [],
};

const ROUTE_METHOD_NAMES = [
  'create',
  'list',
  'getOne',
  'update',
  'remove',
  'addPhoto',
  'getPhoto',
  'removePhoto',
] as const;

/**
 * Route method → the exact role bundle its `@RequireRole` must declare. Note
 * the deliberate asymmetry: `addPhoto` is an entry write, `removePhoto` is a
 * delete — a CAREGIVER may add to the family's record but never destroy part
 * of it.
 */
const ROLE_SCOPED_ROUTES = [
  ['create', ENTRY_WRITE_ROLES],
  ['update', ENTRY_WRITE_ROLES],
  ['addPhoto', ENTRY_WRITE_ROLES],
  ['remove', FULL_WRITE_ROLES],
  ['removePhoto', FULL_WRITE_ROLES],
] as const;

/** Routes any household member may call, so they carry no role metadata. */
const READ_OPEN_ROUTES = ['list', 'getOne', 'getPhoto'] as const;

/** The `@UseGuards(...)` classes Nest recorded for one controller method. */
function guardsOf(methodName: (typeof ROUTE_METHOD_NAMES)[number]): unknown[] {
  return (Reflect.getMetadata('__guards__', MilestoneController.prototype[methodName]) ??
    []) as unknown[];
}

describe('MilestoneController', () => {
  let milestoneService: jest.Mocked<
    Pick<
      MilestoneService,
      'create' | 'list' | 'findOne' | 'update' | 'remove' | 'addPhoto' | 'getPhoto' | 'removePhoto'
    >
  >;
  let controller: MilestoneController;

  beforeEach(() => {
    milestoneService = {
      create: jest.fn(),
      list: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      addPhoto: jest.fn(),
      getPhoto: jest.fn(),
      removePhoto: jest.fn(),
    };
    controller = new MilestoneController(milestoneService as unknown as MilestoneService);
  });

  it('delegates create with the current user id (M-14)', async () => {
    milestoneService.create.mockResolvedValue(summary);
    const dto = {
      templateKey: MilestoneTemplate.SITS_UNSUPPORTED,
      title: 'Sitzt frei',
      achievedAt: '2025-08-20',
    };

    const result = await controller.create(HOUSEHOLD_ID, CHILD_ID, dto, user);

    expect(milestoneService.create).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, user.id, dto);
    expect(result).toBe(summary);
  });

  it('forwards the optional from/to range to list', async () => {
    milestoneService.list.mockResolvedValue([summary]);
    const range = { from: '2025-01-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' };

    const result = await controller.list(HOUSEHOLD_ID, CHILD_ID, range);

    expect(milestoneService.list).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, range);
    expect(result).toEqual([summary]);
  });

  it('delegates getOne with the milestone id', async () => {
    milestoneService.findOne.mockResolvedValue(summary);

    const result = await controller.getOne(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID);

    expect(milestoneService.findOne).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID);
    expect(result).toBe(summary);
  });

  it('delegates update with the milestone id and the dto', async () => {
    milestoneService.update.mockResolvedValue(summary);
    const dto = { note: 'Auf dem Spielplatz' };

    const result = await controller.update(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID, dto, OWNER_ACTOR);

    expect(milestoneService.update).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      MILESTONE_ID,
      OWNER_ACTOR,
      dto,
    );
    expect(result).toBe(summary);
  });

  it('delegates remove and returns nothing', async () => {
    milestoneService.remove.mockResolvedValue(undefined);

    await expect(controller.remove(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID)).resolves.toBeUndefined();
    expect(milestoneService.remove).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID);
  });

  it('delegates a photo upload and answers with the new photo reference', async () => {
    const photoRef = { id: 'photo-1', sortIndex: 0, mimeType: 'image/jpeg' };
    milestoneService.addPhoto.mockResolvedValue(photoRef);
    const upload = { mimetype: 'image/jpeg', buffer: Buffer.from('bytes') } as Express.Multer.File;

    const result = await controller.addPhoto(
      HOUSEHOLD_ID,
      CHILD_ID,
      MILESTONE_ID,
      upload,
      OWNER_ACTOR,
    );

    expect(milestoneService.addPhoto).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      MILESTONE_ID,
      OWNER_ACTOR,
      upload,
    );
    expect(result).toBe(photoRef);
  });

  it('serves a photo with its stored content type', async () => {
    milestoneService.getPhoto.mockResolvedValue({
      buffer: Buffer.from('bytes'),
      mimeType: 'image/png',
    });
    const res = { set: jest.fn() };

    const result = await controller.getPhoto(
      HOUSEHOLD_ID,
      CHILD_ID,
      MILESTONE_ID,
      'photo-1',
      res as never,
    );

    expect(res.set).toHaveBeenCalledWith({ 'Content-Type': 'image/png' });
    expect(result.getStream()).toBeDefined();
  });

  it('delegates a single photo delete', async () => {
    milestoneService.removePhoto.mockResolvedValue(undefined);

    await expect(
      controller.removePhoto(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID, 'photo-1'),
    ).resolves.toBeUndefined();
    expect(milestoneService.removePhoto).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      MILESTONE_ID,
      'photo-1',
    );
  });

  describe('route metadata', () => {
    it.each(['remove', 'removePhoto'] as const)('answers DELETE %s with 204 No Content', (name) => {
      expect(Reflect.getMetadata('__httpCode__', MilestoneController.prototype[name])).toBe(204);
    });

    it.each(['create', 'update', 'remove', 'addPhoto', 'removePhoto'] as const)(
      'guards the write route %s with authentication, membership and CSRF',
      (methodName) => {
        expect(guardsOf(methodName)).toEqual([JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard]);
      },
    );

    it.each(['list', 'getOne', 'getPhoto'] as const)(
      'guards the read route %s with authentication and membership only',
      (methodName) => {
        expect(guardsOf(methodName)).toEqual([JwtAuthGuard, HouseholdMembershipGuard]);
      },
    );

    it('classifies every route as either role-scoped or read-open', () => {
      // Catches a newly added route that nobody classified below.
      expect([...ROLE_SCOPED_ROUTES.map(([name]) => name), ...READ_OPEN_ROUTES].sort()).toEqual(
        [...ROUTE_METHOD_NAMES].sort(),
      );
    });

    // Every writing route must carry an explicit role requirement (ROL-2) —
    // `HouseholdMembershipGuard` rejects unannotated writes outright.
    it.each(ROLE_SCOPED_ROUTES)('%s requires the expected roles', (methodName, expectedRoles) => {
      expect(
        Reflect.getMetadata(HOUSEHOLD_ROLES_KEY, MilestoneController.prototype[methodName]),
      ).toEqual([...expectedRoles]);
    });

    it.each(READ_OPEN_ROUTES)('leaves the read route %s open to any member', (methodName) => {
      expect(
        Reflect.getMetadata(HOUSEHOLD_ROLES_KEY, MilestoneController.prototype[methodName]),
      ).toBeUndefined();
    });
  });
});
