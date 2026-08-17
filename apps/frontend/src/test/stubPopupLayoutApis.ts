import { afterEach, beforeEach, vi } from 'vitest';

/**
 * Floating/overlay UI (Sonner's toasts, and any popper-based primitive that
 * measures a floating layer) relies on browser layout and pointer APIs that
 * jsdom does not implement at all: `ResizeObserver`, `DOMRect.fromRect`,
 * pointer capture, and `scrollIntoView`. Without them, e.g. a pointer-down on a
 * toast throws `setPointerCapture is not a function`.
 *
 * `stubPopupLayoutApis()` installs no-op implementations for the duration of a
 * spec file and restores whatever was there before. It only fills in missing
 * plumbing — every assertion in a spec using it still exercises the real
 * component behavior.
 */
class NoopResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

export function stubPopupLayoutApis(): void {
  const original = {
    resizeObserver: globalThis.ResizeObserver,
    hasPointerCapture: Element.prototype.hasPointerCapture,
    setPointerCapture: Element.prototype.setPointerCapture,
    releasePointerCapture: Element.prototype.releasePointerCapture,
    scrollIntoView: Element.prototype.scrollIntoView,
    domRectFromRect: DOMRect.fromRect,
  };

  beforeEach(() => {
    globalThis.ResizeObserver = NoopResizeObserver;
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    DOMRect.fromRect = vi.fn(
      (rect?: DOMRectInit) => new DOMRect(rect?.x, rect?.y, rect?.width, rect?.height),
    );
  });

  afterEach(() => {
    globalThis.ResizeObserver = original.resizeObserver;
    Element.prototype.hasPointerCapture = original.hasPointerCapture;
    Element.prototype.setPointerCapture = original.setPointerCapture;
    Element.prototype.releasePointerCapture = original.releasePointerCapture;
    Element.prototype.scrollIntoView = original.scrollIntoView;
    DOMRect.fromRect = original.domRectFromRect;
  });
}
