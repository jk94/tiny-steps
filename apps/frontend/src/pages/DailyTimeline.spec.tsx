import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { DailyTimeline } from './DailyTimeline';
import * as childApi from '../api/child-api';
import * as eventApi from '../api/event-api';
import type { TimelineEventSummary } from '../api/event-api';
import * as householdApi from '../api/household-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/child-api');
vi.mock('../api/event-api');
vi.mock('../api/household-api');
vi.mock('../realtime/useHouseholdRoom');

const mockedChildApi = vi.mocked(childApi);
const mockedEventApi = vi.mocked(eventApi);
const mockedHouseholdApi = vi.mocked(householdApi);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

const child: childApi.ChildSummary = {
  id: CHILD_ID,
  householdId: HOUSEHOLD_ID,
  name: 'Alex',
  birthDate: '2024-01-01T00:00:00.000Z',
  hasPhoto: false,
  createdAt: '2024-01-02T00:00:00.000Z',
};

const feedingEvent: TimelineEventSummary = {
  id: 'feeding-1',
  childId: CHILD_ID,
  userId: 'user-1',
  type: 'FEEDING',
  feedingType: 'SOLID',
  occurredAt: '2026-01-01T08:00:00.000Z',
  startedAt: null,
  endedAt: null,
  durationSeconds: null,
  side: null,
  amountMl: null,
  note: null,
  createdAt: '2026-01-01T08:00:00.000Z',
  updatedAt: '2026-01-01T08:00:00.000Z',
};

const sleepEvent: TimelineEventSummary = {
  id: 'sleep-1',
  childId: CHILD_ID,
  userId: 'user-1',
  type: 'SLEEP',
  occurredAt: '2026-01-01T09:00:00.000Z',
  startedAt: '2026-01-01T09:00:00.000Z',
  endedAt: '2026-01-01T09:30:00.000Z',
  durationSeconds: 1800,
  createdAt: '2026-01-01T09:00:00.000Z',
  updatedAt: '2026-01-01T09:00:00.000Z',
};

function renderDailyTimeline() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/timeline`]}>
        <Routes>
          <Route
            path="/households/:householdId/children/:childId/timeline"
            element={<DailyTimeline />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DailyTimeline', () => {
  beforeEach(() => {
    queryClient.clear();
    mockedChildApi.fetchChild.mockResolvedValue(child);
    mockedEventApi.fetchEventStats.mockResolvedValue({
      sleepHoursToday: 0.5,
      feedingCountToday: 1,
      lastEventAt: { FEEDING: feedingEvent.occurredAt, SLEEP: sleepEvent.occurredAt, DIAPER: null },
    });
    mockedEventApi.fetchDailyEvents.mockResolvedValue([feedingEvent, sleepEvent]);
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValue([
      { userId: 'user-1', email: 'parent@example.com' },
    ]);
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('shows the loading skeleton while the child query is in flight', () => {
    mockedChildApi.fetchChild.mockReturnValue(new Promise(() => {}));

    renderDailyTimeline();

    expect(document.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it('shows the child name in the heading and a link back to the child overview', async () => {
    renderDailyTimeline();

    expect(
      await screen.findByRole('heading', { name: 'Daily timeline — Alex' }),
    ).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Back to overview' });
    expect(link).toHaveAttribute('href', `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}`);
  });

  it('composes the stats summary and the event list, both populated', async () => {
    renderDailyTimeline();

    expect(await screen.findByText('Sleep today: 0.5h')).toBeInTheDocument();
    expect(screen.getByText('Feedings today: 1')).toBeInTheDocument();
    const list = screen.getByRole('list');
    expect(within(list).getByText('Solid food')).toBeInTheDocument();
    expect(within(list).getByText('Sleep')).toBeInTheDocument();
  });

  it('hides a type from the event list once its filter checkbox is unchecked', async () => {
    const user = userEvent.setup();
    renderDailyTimeline();
    const list = await screen.findByRole('list');
    expect(within(list).getByText('Sleep')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Sleep' }));

    expect(within(list).queryByText('Sleep')).not.toBeInTheDocument();
    expect(within(list).getByText('Solid food')).toBeInTheDocument();
  });
});
