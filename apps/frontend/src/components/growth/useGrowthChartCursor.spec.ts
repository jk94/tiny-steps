import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent } from 'react';
import type { GrowthPoint } from './growthChartData';
import { LONG_PRESS_MS, useGrowthChartCursor } from './useGrowthChartCursor';

vi.mock('@visx/event', () => ({
  // jsdom has no SVG geometry, so `localPoint` cannot resolve real
  // coordinates; the stub returns the x the test put on the event.
  localPoint: (_node: unknown, event: { clientX?: number }) => ({
    x: event.clientX ?? 0,
    y: 0,
  }),
}));

const series: GrowthPoint[] = [0, 90, 365].map((ageInDays) => ({
  measurementId: `m-${ageInDays}`,
  ageInDays,
  value: 1000 + ageInDays,
  measuredAt: '2025-04-01T09:00:00.000Z',
  percentile: null,
  position: null,
}));

/** Identity mapping: the test's "pixel" x is the age in days. */
const ageFromX = (x: number) => x;

function pointerEvent(pointerType: 'mouse' | 'touch', clientX: number): PointerEvent<SVGElement> {
  return {
    pointerType,
    clientX,
    currentTarget: { ownerSVGElement: null },
  } as unknown as PointerEvent<SVGElement>;
}

function setup(points: GrowthPoint[] = series) {
  return renderHook(() => useGrowthChartCursor({ series: points, ageFromX }));
}

describe('useGrowthChartCursor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with no active point', () => {
    const { result } = setup();
    expect(result.current.activeIndex).toBeNull();
    expect(result.current.activePoint).toBeNull();
  });

  describe('pointer (W-13)', () => {
    it('activates the nearest point on mouse move', () => {
      const { result } = setup();

      act(() => result.current.pointerHandlers.onPointerMove(pointerEvent('mouse', 80)));

      expect(result.current.activeIndex).toBe(1);
      expect(result.current.activePoint?.measurementId).toBe('m-90');
    });

    it('follows the pointer to another point', () => {
      const { result } = setup();

      act(() => result.current.pointerHandlers.onPointerMove(pointerEvent('mouse', 80)));
      act(() => result.current.pointerHandlers.onPointerMove(pointerEvent('mouse', 400)));

      expect(result.current.activePoint?.measurementId).toBe('m-365');
    });
  });

  describe('touch long-press (W-13)', () => {
    it('starts scrubbing and activates a point after the long press', () => {
      const { result } = setup();

      act(() => result.current.pointerHandlers.onPointerDown(pointerEvent('touch', 80)));
      expect(result.current.isScrubbing).toBe(false);
      expect(result.current.activeIndex).toBeNull();

      act(() => vi.advanceTimersByTime(LONG_PRESS_MS));

      expect(result.current.isScrubbing).toBe(true);
      expect(result.current.activePoint?.measurementId).toBe('m-90');
    });

    it('does nothing when the finger lifts before the long press completes', () => {
      const { result } = setup();

      act(() => result.current.pointerHandlers.onPointerDown(pointerEvent('touch', 80)));
      act(() => vi.advanceTimersByTime(LONG_PRESS_MS - 1));
      act(() => result.current.pointerHandlers.onPointerUp());
      act(() => vi.advanceTimersByTime(LONG_PRESS_MS));

      expect(result.current.isScrubbing).toBe(false);
      expect(result.current.activeIndex).toBeNull();
    });

    it('ignores a touch move until scrubbing is armed, so the page can still scroll', () => {
      const { result } = setup();

      act(() => result.current.pointerHandlers.onPointerMove(pointerEvent('touch', 400)));
      expect(result.current.activeIndex).toBeNull();

      act(() => result.current.pointerHandlers.onPointerDown(pointerEvent('touch', 0)));
      act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
      act(() => result.current.pointerHandlers.onPointerMove(pointerEvent('touch', 400)));

      expect(result.current.activePoint?.measurementId).toBe('m-365');
    });

    it('stops scrubbing when the touch is cancelled', () => {
      const { result } = setup();

      act(() => result.current.pointerHandlers.onPointerDown(pointerEvent('touch', 0)));
      act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
      act(() => result.current.pointerHandlers.onPointerCancel());

      expect(result.current.isScrubbing).toBe(false);
    });
  });

  describe('keyboard (W-14)', () => {
    it('steps forward from nothing selected to the first point', () => {
      const { result } = setup();

      act(() => result.current.stepActive(1));

      expect(result.current.activeIndex).toBe(0);
    });

    it('steps backwards from nothing selected to the last point', () => {
      const { result } = setup();

      act(() => result.current.stepActive(-1));

      expect(result.current.activeIndex).toBe(series.length - 1);
    });

    it('clamps at both ends instead of wrapping around', () => {
      const { result } = setup();

      act(() => result.current.setActive(0));
      act(() => result.current.stepActive(-1));
      expect(result.current.activeIndex).toBe(0);

      act(() => result.current.setActive(series.length - 1));
      act(() => result.current.stepActive(1));
      expect(result.current.activeIndex).toBe(series.length - 1);
    });

    it('does nothing on an empty series', () => {
      const { result } = setup([]);

      act(() => result.current.stepActive(1));

      expect(result.current.activeIndex).toBeNull();
    });
  });

  it('drops an active index that a shrinking series no longer contains', () => {
    const { result, rerender } = renderHook(
      ({ points }) => useGrowthChartCursor({ series: points, ageFromX }),
      { initialProps: { points: series } },
    );

    act(() => result.current.setActive(2));
    expect(result.current.activeIndex).toBe(2);

    rerender({ points: series.slice(0, 1) });

    expect(result.current.activeIndex).toBeNull();
  });
});
