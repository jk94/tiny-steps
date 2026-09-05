import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { SleepTimer } from './SleepTimer';
import * as sleepApi from '../api/sleep-api';
import type { HouseholdRole } from '../lib/householdPermissions';
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
    updatedAt: '2026-01-01T20:00:00.000Z',
    ...overrides,
  };
}

function renderTimer(event: sleepApi.SleepEventSummary, role: HouseholdRole | undefined = 'OWNER') {
  return render(
    <QueryClientProvider client={queryClient}>
      <SleepTimer householdId={HOUSEHOLD_ID} childId={CHILD_ID} event={event} role={role} />
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

    it('fires the optimistic stop with a captured clientTimestamp when Stop is clicked', async () => {
      const event = makeRunningEvent();
      mockedSleepApi.stopSleepTimerOptimistic.mockResolvedValueOnce({
        ...event,
        endedAt: '2026-01-01T20:05:00.000Z',
      });
      const user = userEvent.setup();
      renderTimer(event);

      await user.click(screen.getByRole('button', { name: 'Stop' }));

      expect(mockedSleepApi.stopSleepTimerOptimistic).toHaveBeenCalledWith(
        HOUSEHOLD_ID,
        CHILD_ID,
        expect.objectContaining({ id: 'e1' }),
        expect.any(String),
      );
    });
  });

  describe('role-dependent stopping', () => {
    it.each(['OWNER', 'CO_PARENT', 'CAREGIVER'] as const)(
      'lets a %s stop a timer another member started (deliberate shift-handover exception)',
      (role) => {
        renderTimer(makeRunningEvent({ userId: 'someone-else' }), role);

        expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
      },
    );

    it('hides Stop from an OBSERVER while still showing the running timer', () => {
      renderTimer(makeRunningEvent(), 'OBSERVER');

      expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
      // Read access to what is currently happening stays universal.
      expect(screen.getByRole('timer')).toBeInTheDocument();
    });

    it('hides Stop until the role is known, rather than flashing it into view', () => {
      // Rendered directly: passing `undefined` through `renderTimer` would fall
      // back to its default role parameter and defeat the point of the test.
      render(
        <QueryClientProvider client={queryClient}>
          <SleepTimer
            householdId={HOUSEHOLD_ID}
            childId={CHILD_ID}
            event={makeRunningEvent()}
            role={undefined}
          />
        </QueryClientProvider>,
      );

      expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
    });
  });
});
