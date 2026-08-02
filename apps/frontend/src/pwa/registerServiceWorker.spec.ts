import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from './registerServiceWorker';

describe('registerServiceWorker', () => {
  const originalProd = import.meta.env.PROD;
  const originalServiceWorker = (navigator as Navigator & { serviceWorker?: unknown })
    .serviceWorker;

  function setServiceWorker(value: unknown): void {
    Object.defineProperty(navigator, 'serviceWorker', {
      value,
      configurable: true,
      writable: true,
    });
  }

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    import.meta.env.PROD = originalProd;
    setServiceWorker(originalServiceWorker);
    vi.restoreAllMocks();
  });

  it('is a no-op outside of a production build, even when serviceWorker is supported', () => {
    import.meta.env.PROD = false;
    const register = vi.fn();
    setServiceWorker({ register });

    registerServiceWorker();

    expect(register).not.toHaveBeenCalled();
  });

  it('is a no-op when the browser has no serviceWorker support, even in production', () => {
    import.meta.env.PROD = true;
    delete (navigator as unknown as Record<string, unknown>).serviceWorker;

    expect(() => registerServiceWorker()).not.toThrow();
  });

  it('registers /sw.js when both in production and serviceWorker is supported', () => {
    import.meta.env.PROD = true;
    const register = vi.fn().mockResolvedValue(undefined);
    setServiceWorker({ register });

    registerServiceWorker();

    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('logs (does not throw) when registration fails', async () => {
    import.meta.env.PROD = true;
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const registrationError = new Error('registration failed');
    const register = vi.fn().mockRejectedValue(registrationError);
    setServiceWorker({ register });

    expect(() => registerServiceWorker()).not.toThrow();
    // Let the rejected promise's .catch() handler run.
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Service worker registration failed',
      registrationError,
    );
  });
});
