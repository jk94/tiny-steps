import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { HOUSEHOLD_ROLES_KEY } from '../household/guards/require-role.decorator';
import { HouseholdRole } from '../household/household-role.enum';
import { ChildController } from './child.controller';
import { ChildService } from './child.service';
import type { ChildSummary } from './child.service';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';

const HOUSEHOLD_ID = 'household-1';
const CHILD_ID = 'child-1';

const summary: ChildSummary = {
  id: CHILD_ID,
  householdId: HOUSEHOLD_ID,
  name: 'Alex',
  birthDate: new Date('2024-01-01T00:00:00.000Z'),
  hasPhoto: false,
  createdAt: new Date('2024-01-02T00:00:00.000Z'),
};

function makePhoto(): Express.Multer.File {
  return {
    fieldname: 'photo',
    originalname: 'photo.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('bytes'),
    size: 5,
    stream: undefined as never,
    destination: '',
    filename: '',
    path: '',
  };
}

describe('ChildController', () => {
  let childService: jest.Mocked<
    Pick<ChildService, 'create' | 'list' | 'findOne' | 'update' | 'remove' | 'getPhoto'>
  >;
  let controller: ChildController;

  beforeEach(() => {
    childService = {
      create: jest.fn(),
      list: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getPhoto: jest.fn(),
    };
    controller = new ChildController(childService as unknown as ChildService);
  });

  describe('create', () => {
    it('delegates to ChildService.create with householdId, dto, and the uploaded photo', async () => {
      childService.create.mockResolvedValue(summary);
      const dto: CreateChildDto = { name: 'Alex', birthDate: '2024-01-01T00:00:00.000Z' };
      const photo = makePhoto();

      const result = await controller.create(HOUSEHOLD_ID, dto, photo);

      expect(childService.create).toHaveBeenCalledWith(HOUSEHOLD_ID, dto, photo);
      expect(result).toBe(summary);
    });

    it('passes undefined through when no photo was uploaded', async () => {
      childService.create.mockResolvedValue(summary);
      const dto: CreateChildDto = { name: 'Alex', birthDate: '2024-01-01T00:00:00.000Z' };

      await controller.create(HOUSEHOLD_ID, dto, undefined);

      expect(childService.create).toHaveBeenCalledWith(HOUSEHOLD_ID, dto, undefined);
    });

    it('requires the OWNER role', () => {
      const roles = Reflect.getMetadata(HOUSEHOLD_ROLES_KEY, ChildController.prototype.create);
      expect(roles).toEqual([HouseholdRole.OWNER]);
    });
  });

  describe('list', () => {
    it('delegates to ChildService.list with householdId', async () => {
      childService.list.mockResolvedValue([summary]);

      const result = await controller.list(HOUSEHOLD_ID);

      expect(childService.list).toHaveBeenCalledWith(HOUSEHOLD_ID);
      expect(result).toEqual([summary]);
    });

    it('has no required role (any member may list)', () => {
      const roles = Reflect.getMetadata(HOUSEHOLD_ROLES_KEY, ChildController.prototype.list);
      expect(roles).toBeUndefined();
    });
  });

  describe('getOne', () => {
    it('delegates to ChildService.findOne with householdId and childId', async () => {
      childService.findOne.mockResolvedValue(summary);

      const result = await controller.getOne(HOUSEHOLD_ID, CHILD_ID);

      expect(childService.findOne).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID);
      expect(result).toBe(summary);
    });

    it('has no required role (any member may read)', () => {
      const roles = Reflect.getMetadata(HOUSEHOLD_ROLES_KEY, ChildController.prototype.getOne);
      expect(roles).toBeUndefined();
    });
  });

  describe('getPhoto', () => {
    it('delegates to ChildService.getPhoto and sets the Content-Type header', async () => {
      const buffer = Buffer.from('image-bytes');
      childService.getPhoto.mockResolvedValue({ buffer, mimeType: 'image/jpeg' });
      const res = { set: jest.fn() } as unknown as Response;

      const result = await controller.getPhoto(HOUSEHOLD_ID, CHILD_ID, res);

      expect(childService.getPhoto).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID);
      expect(res.set).toHaveBeenCalledWith({ 'Content-Type': 'image/jpeg' });
      expect(result).toBeInstanceOf(StreamableFile);
    });

    it('has no required role (any member may view)', () => {
      const roles = Reflect.getMetadata(HOUSEHOLD_ROLES_KEY, ChildController.prototype.getPhoto);
      expect(roles).toBeUndefined();
    });
  });

  describe('update', () => {
    it('delegates to ChildService.update with householdId, childId, dto, and the photo', async () => {
      childService.update.mockResolvedValue(summary);
      const dto: UpdateChildDto = { name: 'Renamed' };
      const photo = makePhoto();

      const result = await controller.update(HOUSEHOLD_ID, CHILD_ID, dto, photo);

      expect(childService.update).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, dto, photo);
      expect(result).toBe(summary);
    });

    it('has no required role (Co-Parent may edit, per the role reconciliation)', () => {
      const roles = Reflect.getMetadata(HOUSEHOLD_ROLES_KEY, ChildController.prototype.update);
      expect(roles).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('delegates to ChildService.remove with householdId and childId', async () => {
      childService.remove.mockResolvedValue(undefined);

      await controller.remove(HOUSEHOLD_ID, CHILD_ID);

      expect(childService.remove).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID);
    });

    it('requires the OWNER role', () => {
      const roles = Reflect.getMetadata(HOUSEHOLD_ROLES_KEY, ChildController.prototype.remove);
      expect(roles).toEqual([HouseholdRole.OWNER]);
    });
  });
});
