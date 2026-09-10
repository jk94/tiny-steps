import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KeyboardEvent, PointerEvent } from 'react';
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

interface CapturingTarget {
  ownerSVGElement: null;
  captured: Set<number>;
  setPointerCapture: (pointerId: number) => void;
  releasePointerCapture: (pointerId: number) => void;
  hasPointerCapture: (pointerId: number) => boolean;
}

/** A stand-in for the overlay rect that records pointer-capture calls. */
function capturingTarget(): CapturingTarget {
  const captured = new Set<number>();
  return {
    ownerSVGElement: null,
    captured,
    setPointerCapture: (pointerId: number) => void captured.add(pointerId),
    releasePointerCapture: (pointerId: number) => void captured.delete(pointerId),
    hasPointerCapture: (pointerId: number) => captured.has(pointerId),
  };
}

function pointerEvent(
  pointerType: 'mouse' | 'touch',
  clientX: number,
  target: CapturingTarget = capturingTarget(),
  pointerId = 1,
): PointerEvent<SVGElement> {
  return {
    pointerType,
    clientX,
    pointerId,
    currentTarget: target,
  } as unknown as PointerEvent<SVGElement>;
}

function keyEvent(key: string): KeyboardEvent<SVGElement> {
  return { key, preventDefault: () => {} } as unknown as KeyboardEvent<SVGElement>;
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
      act(() => result.current.pointerHandlers.onPointerUp(pointerEvent('touch', 80)));
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

    it('captures the pointer so scrubbing survives leaving the plot bounds', () => {
      // Without capture, dragging past the rect's edge silently ends the
      // gesture. Real-device behaviour is a manual verification item; this
      // pins the contract the browser relies on.
      const { result } = setup();
      const target = capturingTarget();

      act(() => result.current.pointerHandlers.onPointerDown(pointerEvent('touch', 0, target)));
      expect(target.captured.has(1)).toBe(true);

      act(() => result.current.pointerHandlers.onPointerUp(pointerEvent('touch', 0, target)));
      expect(target.captured.has(1)).toBe(false);
    });

    it('releases the captured pointer when the gesture is cancelled', () => {
      const { result } = setup();
      const target = capturingTarget();

      act(() => result.current.pointerHandlers.onPointerDown(pointerEvent('touch', 0, target)));
      act(() => result.current.pointerHandlers.onPointerCancel(pointerEvent('touch', 0, target)));

      expect(target.captured.has(1)).toBe(false);
    });

    it('stops scrubbing when the touch is cancelled', () => {
      const { result } = setup();

      act(() => result.current.pointerHandlers.onPointerDown(pointerEvent('touch', 0)));
      act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
      act(() => result.current.pointerHandlers.onPointerCancel(pointerEvent('touch', 0)));

      expect(result.current.isScrubbing).toBe(false);
    });
  });

  describe('keyboard (W-14)', () => {
    it('steps forward from nothing selected to the first point', () => {
      const { result } = setup();

      act(() => result.current.keyDownHandler(keyEvent('ArrowRight')));

      expect(result.current.activeIndex).toBe(0);
    });

    it('steps backwards from nothing selected to the last point', () => {
      const { result } = setup();

      act(() => result.current.keyDownHandler(keyEvent('ArrowLeft')));

      expect(result.current.activeIndex).toBe(series.length - 1);
    });

    it('clamps at both ends instead of wrapping around', () => {
      const { result } = setup();

      act(() => result.current.keyDownHandler(keyEvent('Home')));
      act(() => result.current.keyDownHandler(keyEvent('ArrowLeft')));
      expect(result.current.activeIndex).toBe(0);

      act(() => result.current.keyDownHandler(keyEvent('End')));
      act(() => result.current.keyDownHandler(keyEvent('ArrowRight')));
      expect(result.current.activeIndex).toBe(series.length - 1);
    });

    it('clears the cursor on Escape', () => {
      const { result } = setup();

      act(() => result.current.keyDownHandler(keyEvent('End')));
      act(() => result.current.keyDownHandler(keyEvent('Escape')));

      expect(result.current.activeIndex).toBeNull();
    });

    it('does nothing on an empty series', () => {
      const { result } = setup([]);

      act(() => result.current.keyDownHandler(keyEvent('ArrowRight')));

      expect(result.current.activeIndex).toBeNull();
    });
  });

  it('drops an active index that a shrinking series no longer contains', () => {
    const { result, rerender } = renderHook(
      ({ points }) => useGrowthChartCursor({ series: points, ageFromX }),
      { initialProps: { points: series } },
    );

    act(() => result.current.keyDownHandler(keyEvent('End')));
    expect(result.current.activeIndex).toBe(2);

    rerender({ points: series.slice(0, 1) });

    expect(result.current.activeIndex).toBeNull();
  });
});
