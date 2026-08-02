import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { DailyStatsSummary } from './DailyStatsSummary';
import * as eventApi from '../api/event-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/event-api');

const mockedEventApi = vi.mocked(eventApi);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const FROM = '2026-01-01T00:00:00.000Z';
const TO = '2026-01-02T00:00:00.000Z';
const DATE_KEY = '2026-01-01';

function renderSummary() {
  return render(
    <QueryClientProvider client={queryClient}>
      <DailyStatsSummary
        householdId={HOUSEHOLD_ID}
        childId={CHILD_ID}
        from={FROM}
        to={TO}
        dateKey={DATE_KEY}
      />
    </QueryClientProvider>,
  );
}

describe('DailyStatsSummary', () => {
  beforeEach(() => {
    queryClient.clear();
    // `vi.setSystemTime` alone (no `vi.useFakeTimers()`) pins `Date.now()`
    // for deterministic "time since" text below, while leaving real
    // setTimeout/setInterval intact — needed so `findByText`'s polling wait
    // (and `TimeSinceCard`'s own `setInterval`) keep working normally.
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
    vi.useRealTimers();
  });

  it('shows the loading indicator while the stats query is in flight', () => {
    mockedEventApi.fetchEventStats.mockReturnValue(new Promise(() => {}));

    renderSummary();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders sleepHoursToday and feedingCountToday plus a TimeSinceCard per event type', async () => {
    mockedEventApi.fetchEventStats.mockResolvedValueOnce({
      sleepHoursToday: 2.5,
      feedingCountToday: 4,
      lastEventAt: {
        FEEDING: '2026-01-01T11:30:00.000Z',
        SLEEP: '2026-01-01T09:00:00.000Z',
        DIAPER: null,
      },
    });

    renderSummary();

    expect(await screen.findByText('Sleep today: 2.5h')).toBeInTheDocument();
    expect(screen.getByText('Feedings today: 4')).toBeInTheDocument();
    expect(screen.getByText('Last feeding')).toBeInTheDocument();
    expect(screen.getByText('30 min ago')).toBeInTheDocument();
    expect(screen.getByText('Last sleep')).toBeInTheDocument();
    expect(screen.getByText('3h ago')).toBeInTheDocument();
    expect(screen.getByText('Last diaper change')).toBeInTheDocument();
    expect(screen.getByText('No entries yet')).toBeInTheDocument();
  });

  it('renders nothing (fails silently) when the stats query errors', async () => {
    mockedEventApi.fetchEventStats.mockRejectedValueOnce(new Error('boom'));

    const { container } = renderSummary();

    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
