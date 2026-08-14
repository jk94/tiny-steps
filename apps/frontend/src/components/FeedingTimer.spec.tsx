import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { FeedingTimer } from './FeedingTimer';
import * as feedingApi from '../api/feeding-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/feeding-api');

const mockedFeedingApi = vi.mocked(feedingApi);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

function makeRunningEvent(
  overrides: Partial<feedingApi.FeedingEventSummary> = {},
): feedingApi.FeedingEventSummary {
  return {
    id: 'e1',
    childId: CHILD_ID,
    userId: 'u1',
    type: 'FEEDING',
    feedingType: 'BREAST',
    occurredAt: '2026-01-01T10:00:00.000Z',
    startedAt: '2026-01-01T10:00:00.000Z',
    endedAt: null,
    durationSeconds: null,
    side: 'LEFT',
    amountMl: null,
    note: null,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
    ...overrides,
  };
}

function renderTimer(event: feedingApi.FeedingEventSummary) {
  return render(
    <QueryClientProvider client={queryClient}>
      <FeedingTimer householdId={HOUSEHOLD_ID} childId={CHILD_ID} event={event} />
    </QueryClientProvider>,
  );
}

describe('FeedingTimer', () => {
  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  describe('elapsed time display (fake timers)', () => {
    beforeEach(() => {
      queryClient.clear();
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T10:05:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows the elapsed time derived from startedAt on mount', () => {
      renderTimer(makeRunningEvent({ startedAt: '2026-01-01T10:00:00.000Z' }));

      // 5 minutes elapsed at mount time (10:05 - 10:00).
      expect(screen.getByRole('timer')).toHaveTextContent('5:00');
    });

    it('ticks forward every second, recomputed from the diff (no drift)', () => {
      renderTimer(makeRunningEvent({ startedAt: '2026-01-01T10:00:00.000Z' }));

      act(() => {
        vi.advanceTimersByTime(65_000);
      });

      expect(screen.getByRole('timer')).toHaveTextContent('6:05');
    });

    it('shows the side label', () => {
      renderTimer(makeRunningEvent({ side: 'RIGHT' }));

      expect(screen.getByText('Right side')).toBeInTheDocument();
    });
  });

  describe('stop action (real timers)', () => {
    beforeEach(() => {
      queryClient.clear();
    });

    it('fires the optimistic stop with a captured clientTimestamp when Stop is clicked', async () => {
      const event = makeRunningEvent();
      mockedFeedingApi.stopFeedingTimerOptimistic.mockResolvedValueOnce({
        ...event,
        endedAt: '2026-01-01T10:05:00.000Z',
      });
      const user = userEvent.setup();
      renderTimer(event);

      await user.click(screen.getByRole('button', { name: 'Stop' }));

      // The optimistic wrapper buffers the stop and drives the stopped-state
      // swap / reconciliation (in FeedingHome + the engine); the timer just
      // captures the Last-Write-Wins baseline and delegates.
      expect(mockedFeedingApi.stopFeedingTimerOptimistic).toHaveBeenCalledWith(
        HOUSEHOLD_ID,
        CHILD_ID,
        expect.objectContaining({ id: 'e1' }),
        expect.any(String),
      );
    });
  });
});
