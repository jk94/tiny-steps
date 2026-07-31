import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ChildPhotoStorageService } from './child-photo-storage.service';

describe('ChildPhotoStorageService', () => {
  let uploadsDir: string;
  let service: ChildPhotoStorageService;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    uploadsDir = await mkdtemp(join(tmpdir(), 'child-photo-storage-test-'));
    originalEnv = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = uploadsDir;
    service = new ChildPhotoStorageService();
  });

  afterEach(async () => {
    process.env.UPLOADS_DIR = originalEnv;
    await rm(uploadsDir, { recursive: true, force: true });
  });

  describe('save', () => {
    it('writes the buffer under a fresh unique filename derived from the childId and mime type', async () => {
      const relativePath = await service.save('child-1', 'image/jpeg', Buffer.from('bytes-a'));

      expect(relativePath).toMatch(/^children\/child-1-[0-9a-f-]{36}\.jpg$/);
      const written = await readFile(join(uploadsDir, relativePath));
      expect(written.toString()).toBe('bytes-a');
    });

    it('never overwrites an existing file — repeated saves produce distinct paths', async () => {
      const first = await service.save('child-1', 'image/png', Buffer.from('one'));
      const second = await service.save('child-1', 'image/png', Buffer.from('two'));

      expect(first).not.toBe(second);
      expect((await readFile(join(uploadsDir, first))).toString()).toBe('one');
      expect((await readFile(join(uploadsDir, second))).toString()).toBe('two');
    });

    it('derives the extension from the mime type, not any client-supplied name', async () => {
      const relativePath = await service.save('child-1', 'image/webp', Buffer.from('bytes'));
      expect(relativePath.endsWith('.webp')).toBe(true);
    });
  });

  describe('read', () => {
    it('returns the buffer for an existing file', async () => {
      const relativePath = await service.save('child-1', 'image/jpeg', Buffer.from('hello'));

      const result = await service.read(relativePath);

      expect(result?.toString()).toBe('hello');
    });

    it('returns null (not a throw) for a missing file', async () => {
      await expect(service.read('children/does-not-exist.jpg')).resolves.toBeNull();
    });
  });

  describe('delete', () => {
    it('actually removes an existing file', async () => {
      const relativePath = await service.save('child-1', 'image/jpeg', Buffer.from('bye'));

      await service.delete(relativePath);

      await expect(service.read(relativePath)).resolves.toBeNull();
    });

    it('resolves silently (does not throw) for a missing file', async () => {
      await expect(service.delete('children/does-not-exist.jpg')).resolves.toBeUndefined();
    });
  });
});
