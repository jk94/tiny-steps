import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTick } from './useTick';

describe('useTick', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('advances its returned value on each interval tick, without any external input', () => {
    const { result } = renderHook(() => useTick(30_000));
    const initial = result.current;

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current).toBeGreaterThan(initial);
  });

  it('does not re-render between ticks', () => {
    const { result } = renderHook(() => useTick(30_000));
    const initial = result.current;

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current).toBe(initial);
  });
});
