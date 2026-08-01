import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('childPhotoCacheBust', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the same module-load-time default for a child that was never bumped', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const { getPhotoCacheBust } = await import('./childPhotoCacheBust');

    expect(getPhotoCacheBust('child-1')).toBe(1000);
    expect(getPhotoCacheBust('child-2')).toBe(1000);
  });

  it('bumping one child does not affect another child’s cache-bust value', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const { getPhotoCacheBust, bumpPhotoCacheBust } = await import('./childPhotoCacheBust');

    vi.spyOn(Date, 'now').mockReturnValue(2000);
    bumpPhotoCacheBust('child-1');

    expect(getPhotoCacheBust('child-1')).toBe(2000);
    expect(getPhotoCacheBust('child-2')).toBe(1000);
  });

  it('a later bump overwrites an earlier one for the same child', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const { getPhotoCacheBust, bumpPhotoCacheBust } = await import('./childPhotoCacheBust');

    vi.spyOn(Date, 'now').mockReturnValue(2000);
    bumpPhotoCacheBust('child-1');
    vi.spyOn(Date, 'now').mockReturnValue(3000);
    bumpPhotoCacheBust('child-1');

    expect(getPhotoCacheBust('child-1')).toBe(3000);
  });
});
