import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canUseViewTransitions,
  isViewTransitionPending,
  navigateWithViewTransition,
  resolvePendingViewTransition,
  viewTransitionStyle,
} from './viewTransition';

type UpdateCallback = () => Promise<void> | void;

/** Installs a fake `document.startViewTransition` that records its callback. */
function installFakeViewTransitions() {
  const callbacks: UpdateCallback[] = [];
  const start = vi.fn((update: UpdateCallback) => {
    callbacks.push(update);
    return {
      finished: Promise.resolve(),
      ready: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
    };
  });
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: start,
  });
  return { start, callbacks };
}

function setReducedMotion(reduce: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches: reduce && query.includes('reduce') }),
  });
}

describe('viewTransition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setReducedMotion(false);
  });

  afterEach(() => {
    resolvePendingViewTransition();
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'startViewTransition');
  });

  it('just navigates where the API is missing (e.g. jsdom, older browsers)', () => {
    const navigate = vi.fn();

    expect(canUseViewTransitions()).toBe(false);
    navigateWithViewTransition(navigate);

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(isViewTransitionPending()).toBe(false);
  });

  it('just navigates under prefers-reduced-motion, even with the API present', () => {
    const { start } = installFakeViewTransitions();
    setReducedMotion(true);
    const navigate = vi.fn();

    navigateWithViewTransition(navigate);

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
  });

  it('navigates inside the transition and holds it until the new route commits', async () => {
    const { callbacks } = installFakeViewTransitions();
    const navigate = vi.fn();

    navigateWithViewTransition(navigate);
    let settled = false;
    const update = Promise.resolve(callbacks[0]()).then(() => {
      settled = true;
    });

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(isViewTransitionPending()).toBe(true);
    await Promise.resolve();
    expect(settled).toBe(false);

    resolvePendingViewTransition();
    await update;

    expect(settled).toBe(true);
    expect(isViewTransitionPending()).toBe(false);
  });

  it('gives up waiting after a timeout so a stuck navigation cannot freeze the page', async () => {
    const { callbacks } = installFakeViewTransitions();

    navigateWithViewTransition(vi.fn());
    const update = Promise.resolve(callbacks[0]());

    vi.advanceTimersByTime(500);
    await update;

    expect(isViewTransitionPending()).toBe(false);
  });

  it('derives a valid, prefixed view-transition-name from an id', () => {
    expect(viewTransitionStyle('child', '8893ae4b-775b-4001')).toEqual({
      viewTransitionName: 'child-8893ae4b-775b-4001',
    });
    expect(viewTransitionStyle('milestone-cover', 'a.b/c')).toEqual({
      viewTransitionName: 'milestone-cover-abc',
    });
  });
});
