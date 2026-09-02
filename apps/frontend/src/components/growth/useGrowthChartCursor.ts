import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { localPoint } from '@visx/event';
import { nearestPointIndex, type GrowthPoint } from './growthChartData';

/**
 * How long a finger must rest on the chart before scrubbing starts (W-13).
 * Long enough not to hijack a vertical page scroll that happens to begin on
 * the chart, short enough to feel deliberate rather than laggy.
 */
export const LONG_PRESS_MS = 400;

export interface GrowthChartCursor {
  activeIndex: number | null;
  activePoint: GrowthPoint | null;
  /** True while a touch long-press is holding the cursor. */
  isScrubbing: boolean;
  setActive: (index: number | null) => void;
  /** Moves the cursor by `delta` points, clamped to the series (W-14). */
  stepActive: (delta: number) => void;
  pointerHandlers: {
    onPointerMove: (event: PointerEvent<SVGElement>) => void;
    onPointerDown: (event: PointerEvent<SVGElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onPointerLeave: () => void;
  };
  keyDownHandler: (event: KeyboardEvent<SVGElement>) => void;
}

export interface UseGrowthChartCursorOptions {
  series: GrowthPoint[];
  /** Maps a pixel x within the plot area back to an age in days. */
  ageFromX: (x: number) => number;
}

/**
 * One cursor state shared by all three input modalities — pointer hover
 * (W-13), touch long-press-and-drag (W-13) and arrow keys (W-14).
 *
 * Keeping them in a single hook is the point: the tooltip, the highlighted
 * marker and the `aria-live` readout all have to describe the *same* active
 * point no matter how it was selected, which is exactly what breaks when
 * hover state and keyboard state are tracked separately.
 */
export function useGrowthChartCursor({
  series,
  ageFromX,
}: UseGrowthChartCursorOptions): GrowthChartCursor {
  const [selectedIndex, setActiveIndex] = useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // A shrinking series (measure switch, deletion) must not leave the cursor
  // pointing past the end. Derived rather than corrected in an effect, so
  // there is never a render in which the cursor points at a missing point.
  const activeIndex =
    selectedIndex !== null && selectedIndex <= series.length - 1 ? selectedIndex : null;

  useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  const setActiveFromEvent = useCallback(
    (event: PointerEvent<SVGElement>) => {
      const point = localPoint(event.currentTarget.ownerSVGElement ?? event.currentTarget, event);
      if (!point) {
        return;
      }
      setActiveIndex(nearestPointIndex(series, ageFromX(point.x)));
    },
    [ageFromX, series],
  );

  const stepActive = useCallback(
    (delta: number) => {
      if (series.length === 0) {
        return;
      }
      setActiveIndex((current) => {
        // Starting from "nothing selected", the first key press selects the
        // first (forward) or last (backward) point rather than doing nothing.
        if (current === null) {
          return delta > 0 ? 0 : series.length - 1;
        }
        return Math.min(Math.max(current + delta, 0), series.length - 1);
      });
    },
    [series.length],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<SVGElement>) => {
      if (event.pointerType === 'touch') {
        // A touch only moves the cursor once the long press has armed it, so
        // an ordinary swipe over the chart still scrolls the page.
        if (isScrubbing) {
          setActiveFromEvent(event);
        }
        return;
      }
      setActiveFromEvent(event);
    },
    [isScrubbing, setActiveFromEvent],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<SVGElement>) => {
      if (event.pointerType !== 'touch') {
        setActiveFromEvent(event);
        return;
      }
      clearLongPressTimer();
      // React pools nothing in v17+, but the synthetic event is still reused
      // for the native one; capture what the timer needs up front.
      const target = event.currentTarget.ownerSVGElement ?? event.currentTarget;
      const point = localPoint(target, event);
      longPressTimer.current = setTimeout(() => {
        setIsScrubbing(true);
        if (point) {
          setActiveIndex(nearestPointIndex(series, ageFromX(point.x)));
        }
      }, LONG_PRESS_MS);
    },
    [ageFromX, clearLongPressTimer, series, setActiveFromEvent],
  );

  const endPointerInteraction = useCallback(() => {
    clearLongPressTimer();
    setIsScrubbing(false);
  }, [clearLongPressTimer]);

  const keyDownHandler = useCallback(
    (event: KeyboardEvent<SVGElement>) => {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          event.preventDefault();
          stepActive(1);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          event.preventDefault();
          stepActive(-1);
          break;
        case 'Home':
          event.preventDefault();
          setActiveIndex(series.length > 0 ? 0 : null);
          break;
        case 'End':
          event.preventDefault();
          setActiveIndex(series.length > 0 ? series.length - 1 : null);
          break;
        case 'Escape':
          setActiveIndex(null);
          break;
        default:
          break;
      }
    },
    [series.length, stepActive],
  );

  return {
    activeIndex,
    activePoint: activeIndex === null ? null : (series[activeIndex] ?? null),
    isScrubbing,
    setActive: setActiveIndex,
    stepActive,
    pointerHandlers: {
      onPointerMove,
      onPointerDown,
      onPointerUp: endPointerInteraction,
      onPointerCancel: endPointerInteraction,
      onPointerLeave: endPointerInteraction,
    },
    keyDownHandler,
  };
}
