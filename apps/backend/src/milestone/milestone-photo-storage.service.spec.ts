import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MilestonePhotoStorageService } from './milestone-photo-storage.service';

describe('MilestonePhotoStorageService', () => {
  let uploadsDir: string;
  let service: MilestonePhotoStorageService;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    uploadsDir = await mkdtemp(join(tmpdir(), 'milestone-photo-storage-test-'));
    originalEnv = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = uploadsDir;
    service = new MilestonePhotoStorageService();
  });

  afterEach(async () => {
    process.env.UPLOADS_DIR = originalEnv;
    await rm(uploadsDir, { recursive: true, force: true });
  });

  describe('save', () => {
    it('writes into its own subdirectory, under a filename derived from the id and mime type', async () => {
      const relativePath = await service.save('milestone-1', 'image/jpeg', Buffer.from('bytes-a'));

      expect(relativePath).toMatch(/^milestones\/milestone-1-[0-9a-f-]{36}\.jpg$/);
      expect((await readFile(join(uploadsDir, relativePath))).toString()).toBe('bytes-a');
    });

    it('never overwrites an existing file — repeated saves produce distinct paths', async () => {
      const first = await service.save('milestone-1', 'image/png', Buffer.from('one'));
      const second = await service.save('milestone-1', 'image/png', Buffer.from('two'));

      expect(first).not.toBe(second);
      expect((await readFile(join(uploadsDir, first))).toString()).toBe('one');
      expect((await readFile(join(uploadsDir, second))).toString()).toBe('two');
    });

    it('derives the extension from the validated mime type, never from a filename', async () => {
      const relativePath = await service.save('milestone-1', 'image/webp', Buffer.from('bytes'));

      expect(relativePath.endsWith('.webp')).toBe(true);
    });
  });

  describe('read', () => {
    it('returns the stored bytes', async () => {
      const relativePath = await service.save('milestone-1', 'image/png', Buffer.from('bytes'));

      expect((await service.read(relativePath))?.toString()).toBe('bytes');
    });

    it('returns null rather than throwing when the file is gone', async () => {
      await expect(service.read('milestones/does-not-exist.jpg')).resolves.toBeNull();
    });
  });

  describe('delete', () => {
    it('removes the file', async () => {
      const relativePath = await service.save('milestone-1', 'image/png', Buffer.from('bytes'));

      await service.delete(relativePath);

      await expect(service.read(relativePath)).resolves.toBeNull();
    });

    it('swallows a missing file so a delete can never fail on it (M-9)', async () => {
      await expect(service.delete('milestones/does-not-exist.jpg')).resolves.toBeUndefined();
    });
  });
});
