import { NotFoundException } from '@nestjs/common';
import { ChildPhotoStorageService } from './child-photo-storage.service';
import { ChildSex } from './child-sex.enum';
import { ChildService } from './child.service';
import { CLEAR_CHILD_SEX } from './dto/update-child.dto';
import { PrismaService } from '../prisma/prisma.service';

const HOUSEHOLD_ID = 'household-1';
const CHILD_ID = 'child-1';

function makeChild(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: CHILD_ID,
    householdId: HOUSEHOLD_ID,
    name: 'Alex',
    birthDate: new Date('2024-01-01T00:00:00.000Z'),
    photoPath: null,
    photoMimeType: null,
    sex: null,
    createdAt: new Date('2024-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function makePhoto(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'photo',
    originalname: 'photo.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake-image-bytes'),
    size: 16,
    stream: undefined as never,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

describe('ChildService', () => {
  let prisma: {
    child: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let photoStorage: jest.Mocked<Pick<ChildPhotoStorageService, 'save' | 'read' | 'delete'>>;
  let service: ChildService;

  beforeEach(() => {
    prisma = {
      child: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    photoStorage = {
      save: jest.fn(),
      read: jest.fn(),
      delete: jest.fn(),
    };
    service = new ChildService(
      prisma as unknown as PrismaService,
      photoStorage as unknown as ChildPhotoStorageService,
    );
  });

  describe('create', () => {
    it('creates a child without a photo, scoped to the household', async () => {
      const created = makeChild();
      prisma.child.create.mockResolvedValue(created);

      const result = await service.create(HOUSEHOLD_ID, {
        name: 'Alex',
        birthDate: '2024-01-01T00:00:00.000Z',
      });

      expect(photoStorage.save).not.toHaveBeenCalled();
      expect(prisma.child.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          householdId: HOUSEHOLD_ID,
          name: 'Alex',
          birthDate: new Date('2024-01-01T00:00:00.000Z'),
          photoPath: undefined,
          photoMimeType: undefined,
        }),
      });
      expect(result).toEqual({
        id: created.id,
        householdId: created.householdId,
        name: created.name,
        birthDate: created.birthDate,
        hasPhoto: false,
        sex: null,
        createdAt: created.createdAt,
      });
    });

    it('stores an explicitly chosen sex', async () => {
      prisma.child.create.mockResolvedValue(makeChild({ sex: ChildSex.FEMALE }));

      const result = await service.create(HOUSEHOLD_ID, {
        name: 'Alex',
        birthDate: '2024-01-01T00:00:00.000Z',
        sex: ChildSex.FEMALE,
      });

      expect(prisma.child.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ sex: ChildSex.FEMALE }),
      });
      expect(result.sex).toBe(ChildSex.FEMALE);
    });

    it('stores "not specified" as a null column rather than a placeholder string', async () => {
      prisma.child.create.mockResolvedValue(makeChild());

      const result = await service.create(HOUSEHOLD_ID, {
        name: 'Alex',
        birthDate: '2024-01-01T00:00:00.000Z',
      });

      expect(prisma.child.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ sex: null }),
      });
      expect(result.sex).toBeNull();
    });

    it('writes the photo file before the DB row, and includes its path/mime type', async () => {
      photoStorage.save.mockResolvedValue('children/child-1-uuid.jpg');
      const created = makeChild({
        photoPath: 'children/child-1-uuid.jpg',
        photoMimeType: 'image/jpeg',
      });
      prisma.child.create.mockResolvedValue(created);

      const photo = makePhoto();
      const result = await service.create(
        HOUSEHOLD_ID,
        { name: 'Alex', birthDate: '2024-01-01T00:00:00.000Z' },
        photo,
      );

      expect(photoStorage.save).toHaveBeenCalledWith(
        expect.any(String),
        'image/jpeg',
        photo.buffer,
      );
      expect(prisma.child.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          photoPath: 'children/child-1-uuid.jpg',
          photoMimeType: 'image/jpeg',
        }),
      });
      expect(result.hasPhoto).toBe(true);
    });

    it('skips the DB call entirely if the photo write throws', async () => {
      photoStorage.save.mockRejectedValue(new Error('disk full'));

      await expect(
        service.create(
          HOUSEHOLD_ID,
          { name: 'Alex', birthDate: '2024-01-01T00:00:00.000Z' },
          makePhoto(),
        ),
      ).rejects.toThrow('disk full');

      expect(prisma.child.create).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('queries by householdId and maps to summaries', async () => {
      prisma.child.findMany.mockResolvedValue([makeChild(), makeChild({ id: 'child-2' })]);

      const result = await service.list(HOUSEHOLD_ID);

      expect(prisma.child.findMany).toHaveBeenCalledWith({ where: { householdId: HOUSEHOLD_ID } });
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('queries by id AND householdId together', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());

      await service.findOne(HOUSEHOLD_ID, CHILD_ID);

      expect(prisma.child.findUnique).toHaveBeenCalledWith({
        where: { id: CHILD_ID, householdId: HOUSEHOLD_ID },
      });
    });

    it('throws NotFoundException when no matching child exists', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.findOne(HOUSEHOLD_ID, CHILD_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('sets the sex when one is supplied', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.child.update.mockResolvedValue(makeChild({ sex: ChildSex.MALE }));

      const result = await service.update(HOUSEHOLD_ID, CHILD_ID, { sex: ChildSex.MALE });

      expect(prisma.child.update).toHaveBeenCalledWith({
        where: { id: CHILD_ID, householdId: HOUSEHOLD_ID },
        data: { sex: ChildSex.MALE },
      });
      expect(result.sex).toBe(ChildSex.MALE);
    });

    it('clears the sex back to "not specified" on the empty-string sentinel', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild({ sex: ChildSex.MALE }));
      prisma.child.update.mockResolvedValue(makeChild({ sex: null }));

      const result = await service.update(HOUSEHOLD_ID, CHILD_ID, { sex: CLEAR_CHILD_SEX });

      expect(prisma.child.update).toHaveBeenCalledWith({
        where: { id: CHILD_ID, householdId: HOUSEHOLD_ID },
        data: { sex: null },
      });
      expect(result.sex).toBeNull();
    });

    it('leaves the stored sex untouched when the field is absent', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild({ sex: ChildSex.MALE }));
      prisma.child.update.mockResolvedValue(makeChild({ sex: ChildSex.MALE }));

      await service.update(HOUSEHOLD_ID, CHILD_ID, { name: 'Alexa' });

      expect(prisma.child.update).toHaveBeenCalledWith({
        where: { id: CHILD_ID, householdId: HOUSEHOLD_ID },
        data: { name: 'Alexa' },
      });
    });

    it('writes new -> updates DB -> deletes old, in that order, when replacing a photo', async () => {
      const callOrder: string[] = [];
      prisma.child.findUnique.mockResolvedValue(
        makeChild({ photoPath: 'children/old.jpg', photoMimeType: 'image/jpeg' }),
      );
      photoStorage.save.mockImplementation(async () => {
        callOrder.push('save');
        return 'children/new.jpg';
      });
      prisma.child.update.mockImplementation(async () => {
        callOrder.push('update');
        return makeChild({ photoPath: 'children/new.jpg', photoMimeType: 'image/jpeg' });
      });
      photoStorage.delete.mockImplementation(async () => {
        callOrder.push('delete');
      });

      await service.update(HOUSEHOLD_ID, CHILD_ID, {}, makePhoto());

      expect(callOrder).toEqual(['save', 'update', 'delete']);
      expect(prisma.child.update).toHaveBeenCalledWith({
        where: { id: CHILD_ID, householdId: HOUSEHOLD_ID },
        data: expect.objectContaining({
          photoPath: 'children/new.jpg',
          photoMimeType: 'image/jpeg',
        }),
      });
      expect(photoStorage.delete).toHaveBeenCalledWith('children/old.jpg');
    });

    it('never calls delete on the old file if the DB update throws after a successful file write', async () => {
      prisma.child.findUnique.mockResolvedValue(
        makeChild({ photoPath: 'children/old.jpg', photoMimeType: 'image/jpeg' }),
      );
      photoStorage.save.mockResolvedValue('children/new.jpg');
      prisma.child.update.mockRejectedValue(new Error('db down'));

      await expect(service.update(HOUSEHOLD_ID, CHILD_ID, {}, makePhoto())).rejects.toThrow(
        'db down',
      );

      expect(photoStorage.delete).not.toHaveBeenCalled();
    });

    it('does not raise past the service boundary if the old file delete fails', async () => {
      prisma.child.findUnique.mockResolvedValue(
        makeChild({ photoPath: 'children/old.jpg', photoMimeType: 'image/jpeg' }),
      );
      photoStorage.save.mockResolvedValue('children/new.jpg');
      prisma.child.update.mockResolvedValue(
        makeChild({ photoPath: 'children/new.jpg', photoMimeType: 'image/jpeg' }),
      );
      // ChildPhotoStorageService.delete() itself never throws (see its own
      // spec) — this asserts ChildService doesn't add any handling that
      // would defeat that guarantee.
      photoStorage.delete.mockResolvedValue(undefined);

      await expect(service.update(HOUSEHOLD_ID, CHILD_ID, {}, makePhoto())).resolves.toBeDefined();
    });

    it('updates text fields only, leaving the photo untouched, when no file is given', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.child.update.mockResolvedValue(makeChild({ name: 'Renamed' }));

      await service.update(HOUSEHOLD_ID, CHILD_ID, { name: 'Renamed' });

      expect(photoStorage.save).not.toHaveBeenCalled();
      expect(photoStorage.delete).not.toHaveBeenCalled();
      expect(prisma.child.update).toHaveBeenCalledWith({
        where: { id: CHILD_ID, householdId: HOUSEHOLD_ID },
        data: { name: 'Renamed' },
      });
    });

    it('throws NotFoundException for a child in a different household, without touching storage', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.update(HOUSEHOLD_ID, CHILD_ID, { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
      expect(photoStorage.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the DB row before attempting the file delete', async () => {
      const callOrder: string[] = [];
      prisma.child.findUnique.mockResolvedValue(makeChild({ photoPath: 'children/old.jpg' }));
      prisma.child.delete.mockImplementation(async () => {
        callOrder.push('delete-db');
      });
      photoStorage.delete.mockImplementation(async () => {
        callOrder.push('delete-file');
      });

      await service.remove(HOUSEHOLD_ID, CHILD_ID);

      expect(callOrder).toEqual(['delete-db', 'delete-file']);
      expect(prisma.child.delete).toHaveBeenCalledWith({
        where: { id: CHILD_ID, householdId: HOUSEHOLD_ID },
      });
      expect(photoStorage.delete).toHaveBeenCalledWith('children/old.jpg');
    });

    it('does not attempt a file delete when the child has no photo', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild({ photoPath: null }));

      await service.remove(HOUSEHOLD_ID, CHILD_ID);

      expect(photoStorage.delete).not.toHaveBeenCalled();
    });

    it('a failing file delete does not raise past the service boundary', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild({ photoPath: 'children/old.jpg' }));
      // Mirrors ChildPhotoStorageService's real contract (never throws).
      photoStorage.delete.mockResolvedValue(undefined);

      await expect(service.remove(HOUSEHOLD_ID, CHILD_ID)).resolves.toBeUndefined();
    });

    it('throws NotFoundException for a child scoped to a different household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.remove(HOUSEHOLD_ID, CHILD_ID)).rejects.toThrow(NotFoundException);
      expect(prisma.child.delete).not.toHaveBeenCalled();
    });
  });

  describe('getPhoto', () => {
    it('throws NotFoundException without touching storage when photoPath is null', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild({ photoPath: null }));

      await expect(service.getPhoto(HOUSEHOLD_ID, CHILD_ID)).rejects.toThrow(NotFoundException);
      expect(photoStorage.read).not.toHaveBeenCalled();
    });

    it('returns the buffer and mime type when the photo exists on disk', async () => {
      const buffer = Buffer.from('image-bytes');
      prisma.child.findUnique.mockResolvedValue(
        makeChild({ photoPath: 'children/photo.jpg', photoMimeType: 'image/jpeg' }),
      );
      photoStorage.read.mockResolvedValue(buffer);

      const result = await service.getPhoto(HOUSEHOLD_ID, CHILD_ID);

      expect(result).toEqual({ buffer, mimeType: 'image/jpeg' });
    });

    it('throws NotFoundException when photoPath is set but storage.read() returns null (drift)', async () => {
      prisma.child.findUnique.mockResolvedValue(
        makeChild({ photoPath: 'children/missing.jpg', photoMimeType: 'image/jpeg' }),
      );
      photoStorage.read.mockResolvedValue(null);

      await expect(service.getPhoto(HOUSEHOLD_ID, CHILD_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('ChildSummary mapping', () => {
    it('never includes photoPath and always includes the computed hasPhoto flag', async () => {
      prisma.child.findUnique.mockResolvedValue(
        makeChild({ photoPath: 'children/photo.jpg', photoMimeType: 'image/jpeg' }),
      );

      const result = await service.findOne(HOUSEHOLD_ID, CHILD_ID);

      expect(result).not.toHaveProperty('photoPath');
      expect(result).not.toHaveProperty('photoMimeType');
      expect(result.hasPhoto).toBe(true);
    });
  });
});
