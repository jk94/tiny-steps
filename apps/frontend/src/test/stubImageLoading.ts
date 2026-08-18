import { afterEach, beforeEach } from 'vitest';

/**
 * Radix UI's Avatar primitive (which backs `<Avatar>`/`<ChildPhoto>`) decides
 * between image and initials fallback by preloading the URL through
 * `new window.Image()` and waiting for its `load`/`error` event. jsdom never
 * fetches subresources, so in tests that image would stay in the "loading"
 * state forever and only the fallback would ever be reachable.
 *
 * `stubImageLoading()` swaps in a fake `window.Image` that resolves on the
 * microtask queue, keyed off the URL: anything containing `broken` errors,
 * everything else loads. Call it once at the top of a `describe` (or a spec
 * file); it registers its own `beforeEach`/`afterEach` and restores the native
 * constructor afterwards.
 */
const BROKEN_URL_MARKER = 'broken';

class StubImage extends EventTarget {
  complete = false;
  naturalWidth = 0;
  referrerPolicy = '';
  crossOrigin: string | null = null;
  #src = '';

  get src(): string {
    return this.#src;
  }

  set src(value: string) {
    this.#src = value;
    queueMicrotask(() => {
      if (value.includes(BROKEN_URL_MARKER)) {
        this.dispatchEvent(new Event('error'));
        return;
      }
      this.complete = true;
      this.naturalWidth = 1;
      this.dispatchEvent(new Event('load'));
    });
  }
}

export function stubImageLoading(): void {
  const nativeImage = window.Image;

  beforeEach(() => {
    window.Image = StubImage as unknown as typeof window.Image;
  });

  afterEach(() => {
    window.Image = nativeImage;
  });
}
