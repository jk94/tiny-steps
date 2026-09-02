import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MilestonePhotoStorageService } from './milestone-photo-storage.service';
import { MilestoneCategory } from './milestone-category.enum';
import { MilestoneTemplate } from './milestone-template.enum';
import { MilestoneService } from './milestone.service';

const HOUSEHOLD_ID = 'household-1';
const CHILD_ID = 'child-1';
const USER_ID = 'user-1';
const MILESTONE_ID = 'milestone-1';

const BIRTH_DATE = new Date('2025-01-20T00:00:00.000Z');
// A bare calendar day parsed to UTC midnight, exactly like `Child.birthDate`.
const ACHIEVED_AT_DAY = '2025-08-20';
const ACHIEVED_AT = new Date(ACHIEVED_AT_DAY);

function makeChild(overrides: Record<string, unknown> = {}) {
  return {
    id: CHILD_ID,
    householdId: HOUSEHOLD_ID,
    name: 'Alex',
    birthDate: BIRTH_DATE,
    photoPath: null,
    photoMimeType: null,
    sex: null as string | null,
    createdAt: new Date('2025-01-21T00:00:00.000Z'),
    ...overrides,
  };
}

function makeMilestone(overrides: Record<string, unknown> = {}) {
  return {
    id: MILESTONE_ID,
    childId: CHILD_ID,
    userId: USER_ID,
    templateKey: MilestoneTemplate.SITS_UNSUPPORTED as string | null,
    title: 'Sitzt frei',
    category: MilestoneCategory.MOTOR as string | null,
    achievedAt: ACHIEVED_AT,
    note: null as string | null,
    createdAt: new Date('2025-08-21T09:00:00.000Z'),
    updatedAt: new Date('2025-08-21T09:00:00.000Z'),
    photos: [] as { id: string; sortIndex: number; mimeType: string; path: string }[],
    ...overrides,
  };
}

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['childId', 'templateKey'] },
  });
}

function makePhoto(overrides: Record<string, unknown> = {}) {
  return {
    id: 'photo-1',
    milestoneId: MILESTONE_ID,
    path: 'milestones/milestone-1-aaa.jpg',
    mimeType: 'image/jpeg',
    sortIndex: 0,
    createdAt: new Date('2025-08-21T09:00:00.000Z'),
    ...overrides,
  };
}

function makeUpload(mimetype = 'image/jpeg'): Express.Multer.File {
  return { mimetype, buffer: Buffer.from('bytes') } as Express.Multer.File;
}

describe('MilestoneService', () => {
  let prisma: {
    child: { findUnique: jest.Mock };
    milestone: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    milestonePhoto: { create: jest.Mock; delete: jest.Mock };
  };
  let photoStorage: {
    save: jest.Mock;
    read: jest.Mock;
    delete: jest.Mock;
  };
  let service: MilestoneService;

  beforeEach(() => {
    prisma = {
      child: { findUnique: jest.fn() },
      milestone: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      milestonePhoto: { create: jest.fn(), delete: jest.fn() },
    };
    photoStorage = {
      save: jest.fn().mockResolvedValue('milestones/milestone-1-new.jpg'),
      read: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    service = new MilestoneService(
      prisma as unknown as PrismaService,
      photoStorage as unknown as MilestonePhotoStorageService,
    );
  });

  describe('create', () => {
    it('derives the category of a template entry from the catalog and freezes the sent title', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.create.mockResolvedValue(makeMilestone());

      const result = await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        templateKey: MilestoneTemplate.SITS_UNSUPPORTED,
        title: 'Sitzt frei',
        achievedAt: ACHIEVED_AT_DAY,
      });

      expect(prisma.milestone.create).toHaveBeenCalledWith({
        data: {
          childId: CHILD_ID,
          userId: USER_ID,
          templateKey: MilestoneTemplate.SITS_UNSUPPORTED,
          title: 'Sitzt frei',
          category: MilestoneCategory.MOTOR,
          achievedAt: ACHIEVED_AT,
          note: null,
        },
      });
      expect(result.category).toBe(MilestoneCategory.MOTOR);
      expect(result.title).toBe('Sitzt frei');
      expect(result.photos).toEqual([]);
    });

    it('keeps the user-chosen category of a free entry', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.create.mockResolvedValue(
        makeMilestone({
          templateKey: null,
          title: 'Erste Zugfahrt',
          category: MilestoneCategory.SOCIAL,
        }),
      );

      const result = await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        title: 'Erste Zugfahrt',
        category: MilestoneCategory.SOCIAL,
        achievedAt: ACHIEVED_AT_DAY,
      });

      expect(prisma.milestone.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ templateKey: null, category: MilestoneCategory.SOCIAL }),
        }),
      );
      expect(result.templateKey).toBeNull();
    });

    it('stores a free entry without a category as null', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.create.mockResolvedValue(
        makeMilestone({ templateKey: null, title: 'Erste Zugfahrt', category: null }),
      );

      const result = await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        title: 'Erste Zugfahrt',
        achievedAt: ACHIEVED_AT_DAY,
      });

      expect(result.category).toBeNull();
    });

    it('reports a repeated template as a friendly conflict (M-5)', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
          templateKey: MilestoneTemplate.SITS_UNSUPPORTED,
          title: 'Sitzt frei',
          achievedAt: ACHIEVED_AT_DAY,
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'MILESTONE_TEMPLATE_ALREADY_RECORDED' }),
      });
    });

    it('rethrows a database failure that is not the uniqueness violation', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.create.mockRejectedValue(new Error('connection lost'));

      // Must surface as the original failure, not be swallowed into the
      // friendly M-5 conflict — those are two very different problems.
      const failure = await service
        .create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
          title: 'Erste Zugfahrt',
          achievedAt: ACHIEVED_AT_DAY,
        })
        .catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(Error);
      expect(failure).not.toBeInstanceOf(ConflictException);
      expect((failure as Error).message).toBe('connection lost');
    });

    it('rejects a date before the child birth date (M-6)', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());

      const error = await service
        .create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
          title: 'Erstes Lächeln',
          achievedAt: '2025-01-19',
        })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BadRequestException);
      // Carries a machine-readable code so the frontend can show the specific
      // "before the birth date" message rather than the generic 400 fallback.
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'ACHIEVED_AT_BEFORE_BIRTH',
      });
      expect(prisma.milestone.create).not.toHaveBeenCalled();
    });

    it('accepts a milestone reached on the birth date itself', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.create.mockResolvedValue(
        makeMilestone({ achievedAt: BIRTH_DATE, templateKey: null, category: null }),
      );

      const result = await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        title: 'Geburt',
        achievedAt: '2025-01-20',
      });

      expect(result.ageInDaysAtMilestone).toBe(0);
      expect(result.ageInMonthsAtMilestone).toBe(0);
    });

    it('404s for a child from another household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(
        service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
          title: 'Erstes Lächeln',
          achievedAt: ACHIEVED_AT_DAY,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('list', () => {
    it("returns the child's milestones newest first with their ordered photos (M-10/M-11)", async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findMany.mockResolvedValue([
        makeMilestone({
          photos: [
            { id: 'photo-1', sortIndex: 0, mimeType: 'image/jpeg', path: 'milestones/a.jpg' },
            { id: 'photo-2', sortIndex: 1, mimeType: 'image/png', path: 'milestones/b.png' },
          ],
        }),
      ]);

      const result = await service.list(HOUSEHOLD_ID, CHILD_ID);

      expect(prisma.milestone.findMany).toHaveBeenCalledWith({
        where: { childId: CHILD_ID },
        include: { photos: { orderBy: { sortIndex: 'asc' } } },
        orderBy: { achievedAt: 'desc' },
      });
      expect(result[0].photos).toEqual([
        { id: 'photo-1', sortIndex: 0, mimeType: 'image/jpeg' },
        { id: 'photo-2', sortIndex: 1, mimeType: 'image/png' },
      ]);
    });

    it('never exposes a stored photo path (M-8)', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findMany.mockResolvedValue([
        makeMilestone({
          photos: [
            { id: 'photo-1', sortIndex: 0, mimeType: 'image/jpeg', path: 'milestones/secret.jpg' },
          ],
        }),
      ]);

      const result = await service.list(HOUSEHOLD_ID, CHILD_ID);

      expect(JSON.stringify(result)).not.toContain('milestones/secret.jpg');
      expect(result[0].photos[0]).not.toHaveProperty('path');
    });

    it('windows on achievedAt when a range is given', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findMany.mockResolvedValue([]);

      await service.list(HOUSEHOLD_ID, CHILD_ID, {
        from: '2025-01-01T00:00:00.000Z',
        to: '2026-01-01T00:00:00.000Z',
      });

      expect(prisma.milestone.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            childId: CHILD_ID,
            achievedAt: {
              gte: new Date('2025-01-01T00:00:00.000Z'),
              lt: new Date('2026-01-01T00:00:00.000Z'),
            },
          },
        }),
      );
    });

    it('states the age at the milestone in days and months (M-6)', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findMany.mockResolvedValue([makeMilestone()]);

      const [milestone] = await service.list(HOUSEHOLD_ID, CHILD_ID);

      expect(milestone.ageInDaysAtMilestone).toBe(212);
      expect(milestone.ageInMonthsAtMilestone).toBe(7);
    });
  });

  describe('findOne', () => {
    it('404s for a milestone belonging to another child', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findUnique.mockResolvedValue(null);

      await expect(service.findOne(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.milestone.findUnique).toHaveBeenCalledWith({
        where: { id: MILESTONE_ID, childId: CHILD_ID },
        include: { photos: { orderBy: { sortIndex: 'asc' } } },
      });
    });
  });

  describe('update', () => {
    it('rejects changing the title of a template entry', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findUnique.mockResolvedValue(makeMilestone());

      await expect(
        service.update(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID, { title: 'Etwas anderes' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'MILESTONE_TEMPLATE_FIELD_NOT_EDITABLE' }),
      });
      expect(prisma.milestone.update).not.toHaveBeenCalled();
    });

    it('rejects changing the category of a template entry', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findUnique.mockResolvedValue(makeMilestone());

      await expect(
        service.update(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID, {
          category: MilestoneCategory.SOCIAL,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows retitling a free entry', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findUnique.mockResolvedValue(
        makeMilestone({ templateKey: null, category: null, title: 'Erste Zugfahrt' }),
      );
      prisma.milestone.update.mockResolvedValue(
        makeMilestone({ templateKey: null, category: null, title: 'Erste Bahnfahrt' }),
      );

      const result = await service.update(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID, {
        title: 'Erste Bahnfahrt',
      });

      expect(prisma.milestone.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MILESTONE_ID },
          data: { title: 'Erste Bahnfahrt' },
        }),
      );
      expect(result.title).toBe('Erste Bahnfahrt');
    });

    it('updates note and date on a template entry', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findUnique.mockResolvedValue(makeMilestone());
      prisma.milestone.update.mockResolvedValue(
        makeMilestone({ note: 'Auf dem Spielplatz', achievedAt: new Date('2025-08-21') }),
      );

      await service.update(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID, {
        note: 'Auf dem Spielplatz',
        achievedAt: '2025-08-21',
      });

      expect(prisma.milestone.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { achievedAt: new Date('2025-08-21'), note: 'Auf dem Spielplatz' },
        }),
      );
    });

    it('rejects moving the date before the birth date', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findUnique.mockResolvedValue(makeMilestone());

      await expect(
        service.update(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID, { achievedAt: '2024-12-31' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.milestone.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the row first, then the photo files on disk (M-9)', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findUnique.mockResolvedValue(
        makeMilestone({
          photos: [
            makePhoto({ id: 'photo-1', path: 'milestones/a.jpg' }),
            makePhoto({ id: 'photo-2', path: 'milestones/b.png', sortIndex: 1 }),
          ],
        }),
      );
      prisma.milestone.delete.mockResolvedValue(makeMilestone());

      await service.remove(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID);

      expect(prisma.milestone.delete).toHaveBeenCalledWith({ where: { id: MILESTONE_ID } });
      expect(photoStorage.delete).toHaveBeenCalledWith('milestones/a.jpg');
      expect(photoStorage.delete).toHaveBeenCalledWith('milestones/b.png');
    });

    it('still succeeds and keeps deleting when one file cannot be removed (M-9)', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findUnique.mockResolvedValue(
        makeMilestone({
          photos: [
            makePhoto({ id: 'photo-1', path: 'milestones/a.jpg' }),
            makePhoto({ id: 'photo-2', path: 'milestones/b.png', sortIndex: 1 }),
          ],
        }),
      );
      prisma.milestone.delete.mockResolvedValue(makeMilestone());
      photoStorage.delete.mockRejectedValueOnce(new Error('EACCES'));

      await expect(service.remove(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID)).resolves.toBeUndefined();
      // The failing file must not abort the cleanup of the remaining ones.
      expect(photoStorage.delete).toHaveBeenCalledWith('milestones/b.png');
    });

    it('404s for a milestone from another child', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findUnique.mockResolvedValue(null);

      await expect(service.remove(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.milestone.delete).not.toHaveBeenCalled();
    });
  });

  describe('addPhoto', () => {
    it('writes the file before the row and assigns the next sort index (M-10)', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findUnique.mockResolvedValue(
        makeMilestone({
          photos: [
            makePhoto({ id: 'photo-1', sortIndex: 0 }),
            makePhoto({ id: 'photo-2', sortIndex: 4 }),
          ],
        }),
      );
      prisma.milestonePhoto.create.mockResolvedValue(
        makePhoto({ id: 'photo-3', sortIndex: 5, path: 'milestones/milestone-1-new.jpg' }),
      );

      const result = await service.addPhoto(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID, makeUpload());

      expect(photoStorage.save).toHaveBeenCalledWith(
        MILESTONE_ID,
        'image/jpeg',
        expect.any(Buffer),
      );
      expect(prisma.milestonePhoto.create).toHaveBeenCalledWith({
        data: {
          milestoneId: MILESTONE_ID,
          path: 'milestones/milestone-1-new.jpg',
          mimeType: 'image/jpeg',
          // "highest existing + 1", not the row count — deleting from the
          // middle must never make a later upload collide.
          sortIndex: 5,
        },
      });
      expect(result).toEqual({ id: 'photo-3', sortIndex: 5, mimeType: 'image/jpeg' });
    });

    it('starts at sort index 0 for the first photo', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findUnique.mockResolvedValue(makeMilestone({ photos: [] }));
      prisma.milestonePhoto.create.mockResolvedValue(makePhoto({ sortIndex: 0 }));

      await service.addPhoto(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID, makeUpload());

      expect(prisma.milestonePhoto.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sortIndex: 0 }) }),
      );
    });

    it('rejects an eleventh photo with a machine-readable conflict (M-7)', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findUnique.mockResolvedValue(
        makeMilestone({
          photos: Array.from({ length: 10 }, (_unused, index) =>
            makePhoto({ id: `photo-${index}`, sortIndex: index }),
          ),
        }),
      );

      await expect(
        service.addPhoto(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID, makeUpload()),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'MILESTONE_PHOTO_LIMIT_REACHED' }),
      });
      expect(photoStorage.save).not.toHaveBeenCalled();
    });

    it('rejects a mime type the upload pipe should already have filtered out', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findUnique.mockResolvedValue(makeMilestone({ photos: [] }));

      await expect(
        service.addPhoto(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID, makeUpload('application/pdf')),
      ).rejects.toThrow('Unexpected photo mime type: application/pdf');
      expect(photoStorage.save).not.toHaveBeenCalled();
    });

    it('404s for a milestone from another household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(
        service.addPhoto(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID, makeUpload()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getPhoto', () => {
    it('returns the stored bytes and mime type', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findUnique.mockResolvedValue(
        makeMilestone({ photos: [makePhoto({ path: 'milestones/a.jpg' })] }),
      );
      photoStorage.read.mockResolvedValue(Buffer.from('bytes'));

      const result = await service.getPhoto(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID, 'photo-1');

      expect(photoStorage.read).toHaveBeenCalledWith('milestones/a.jpg');
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.buffer.toString()).toBe('bytes');
    });

    it('404s for a photo id that belongs to another milestone', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findUnique.mockResolvedValue(makeMilestone({ photos: [makePhoto()] }));

      await expect(
        service.getPhoto(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID, 'photo-from-elsewhere'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s when the row exists but the file is gone (drift)', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findUnique.mockResolvedValue(makeMilestone({ photos: [makePhoto()] }));
      photoStorage.read.mockResolvedValue(null);

      await expect(
        service.getPhoto(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID, 'photo-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('removePhoto', () => {
    it('deletes the row first, then the file', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findUnique.mockResolvedValue(
        makeMilestone({ photos: [makePhoto({ path: 'milestones/a.jpg' })] }),
      );
      prisma.milestonePhoto.delete.mockResolvedValue(makePhoto());

      await service.removePhoto(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID, 'photo-1');

      expect(prisma.milestonePhoto.delete).toHaveBeenCalledWith({ where: { id: 'photo-1' } });
      expect(photoStorage.delete).toHaveBeenCalledWith('milestones/a.jpg');
    });

    it('404s for an unknown photo id', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findUnique.mockResolvedValue(makeMilestone({ photos: [] }));

      await expect(
        service.removePhoto(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID, 'photo-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.milestonePhoto.delete).not.toHaveBeenCalled();
    });
  });
});
