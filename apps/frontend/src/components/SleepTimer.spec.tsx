import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { SleepTimer } from './SleepTimer';
import * as sleepApi from '../api/sleep-api';
import { ApiError } from '../api/http-client';
import { queryClient } from '../lib/query-client';

vi.mock('../api/sleep-api');

const mockedSleepApi = vi.mocked(sleepApi);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

function makeRunningEvent(
  overrides: Partial<sleepApi.SleepEventSummary> = {},
): sleepApi.SleepEventSummary {
  return {
    id: 'e1',
    childId: CHILD_ID,
    userId: 'u1',
    type: 'SLEEP',
    occurredAt: '2026-01-01T20:00:00.000Z',
    startedAt: '2026-01-01T20:00:00.000Z',
    endedAt: null,
    durationSeconds: null,
    createdAt: '2026-01-01T20:00:00.000Z',
    ...overrides,
  };
}

function renderTimer(event: sleepApi.SleepEventSummary) {
  return render(
    <QueryClientProvider client={queryClient}>
      <SleepTimer householdId={HOUSEHOLD_ID} childId={CHILD_ID} event={event} />
    </QueryClientProvider>,
  );
}

describe('SleepTimer', () => {
  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  describe('elapsed time display (fake timers)', () => {
    beforeEach(() => {
      queryClient.clear();
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T20:05:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows the elapsed time derived from startedAt on mount', () => {
      renderTimer(makeRunningEvent({ startedAt: '2026-01-01T20:00:00.000Z' }));

      // 5 minutes elapsed at mount time (20:05 - 20:00).
      expect(screen.getByRole('timer')).toHaveTextContent('5:00');
    });

    it('ticks forward every second, recomputed from the diff (no drift)', () => {
      renderTimer(makeRunningEvent({ startedAt: '2026-01-01T20:00:00.000Z' }));

      act(() => {
        vi.advanceTimersByTime(65_000);
      });

      expect(screen.getByRole('timer')).toHaveTextContent('6:05');
    });
  });

  describe('stop action (real timers)', () => {
    beforeEach(() => {
      queryClient.clear();
    });

    it('calls stopSleepTimer and invalidates queries when Stop is clicked', async () => {
      const event = makeRunningEvent();
      mockedSleepApi.stopSleepTimer.mockResolvedValueOnce({
        ...event,
        endedAt: '2026-01-01T20:05:00.000Z',
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const user = userEvent.setup();
      renderTimer(event);

      await user.click(screen.getByRole('button', { name: 'Stop' }));

      expect(mockedSleepApi.stopSleepTimer).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, 'e1');
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['households', HOUSEHOLD_ID, 'children', CHILD_ID, 'sleep-events'],
      });
    });

    it('shows a mapped error message when stop fails with a 409 (already stopped)', async () => {
      mockedSleepApi.stopSleepTimer.mockRejectedValueOnce(new ApiError(409, {}));
      const user = userEvent.setup();
      renderTimer(makeRunningEvent());

      await user.click(screen.getByRole('button', { name: 'Stop' }));

      expect(await screen.findByText('This timer has already been stopped.')).toBeInTheDocument();
    });
  });
});
