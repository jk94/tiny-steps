import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { TimelineEventList } from './TimelineEventList';
import * as eventApi from '../api/event-api';
import type { TimelineEventSummary } from '../api/event-api';
import * as householdApi from '../api/household-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/event-api');
vi.mock('../api/household-api');

const mockedEventApi = vi.mocked(eventApi);
const mockedHouseholdApi = vi.mocked(householdApi);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const FROM = '2026-01-01T00:00:00.000Z';
const TO = '2026-01-02T00:00:00.000Z';
const DATE_KEY = '2026-01-01';

const feedingEvent: TimelineEventSummary = {
  id: 'feeding-1',
  childId: CHILD_ID,
  userId: 'user-1',
  type: 'FEEDING',
  feedingType: 'BOTTLE',
  occurredAt: '2026-01-01T08:00:00.000Z',
  startedAt: null,
  endedAt: null,
  durationSeconds: null,
  side: null,
  amountMl: 90,
  note: null,
  createdAt: '2026-01-01T08:00:00.000Z',
};

const sleepEvent: TimelineEventSummary = {
  id: 'sleep-1',
  childId: CHILD_ID,
  userId: 'user-2',
  type: 'SLEEP',
  occurredAt: '2026-01-01T09:00:00.000Z',
  startedAt: '2026-01-01T09:00:00.000Z',
  endedAt: '2026-01-01T10:00:00.000Z',
  durationSeconds: 3600,
  createdAt: '2026-01-01T09:00:00.000Z',
};

const diaperEvent: TimelineEventSummary = {
  id: 'diaper-1',
  childId: CHILD_ID,
  userId: 'user-unknown',
  type: 'DIAPER',
  diaperType: 'PEE',
  occurredAt: '2026-01-01T11:00:00.000Z',
  note: null,
  createdAt: '2026-01-01T11:00:00.000Z',
};

const members = [
  { userId: 'user-1', email: 'parent-one@example.com' },
  { userId: 'user-2', email: 'parent-two@example.com' },
];

const ALL_TYPES = new Set<eventApi.EventType>(['FEEDING', 'SLEEP', 'DIAPER']);

function renderList(enabledTypes: Set<eventApi.EventType> = ALL_TYPES) {
  return render(
    <QueryClientProvider client={queryClient}>
      <TimelineEventList
        householdId={HOUSEHOLD_ID}
        childId={CHILD_ID}
        from={FROM}
        to={TO}
        dateKey={DATE_KEY}
        enabledTypes={enabledTypes}
      />
    </QueryClientProvider>,
  );
}

describe('TimelineEventList', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('shows the loading indicator while the daily-events query is in flight', () => {
    mockedEventApi.fetchDailyEvents.mockReturnValue(new Promise(() => {}));
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValue(members);

    renderList();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows the empty state when there are no entries for the day', async () => {
    mockedEventApi.fetchDailyEvents.mockResolvedValueOnce([]);
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValueOnce(members);

    renderList();

    expect(await screen.findByText('No entries for this day yet.')).toBeInTheDocument();
  });

  it('renders mixed-type events in the order the backend returned them (already sorted ascending)', async () => {
    mockedEventApi.fetchDailyEvents.mockResolvedValueOnce([feedingEvent, sleepEvent, diaperEvent]);
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValueOnce(members);

    renderList();

    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Bottle (90 ml)');
    expect(items[1]).toHaveTextContent('Sleep');
    expect(items[2]).toHaveTextContent('Pee');
  });

  it('renders each event type with its own type-specific detail', async () => {
    mockedEventApi.fetchDailyEvents.mockResolvedValueOnce([feedingEvent, sleepEvent, diaperEvent]);
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValueOnce(members);

    renderList();

    expect(await screen.findByText('Bottle (90 ml)')).toBeInTheDocument();
    expect(screen.getByText('Sleep')).toBeInTheDocument();
    expect(screen.getByText('60 min')).toBeInTheDocument();
    expect(screen.getByText('Pee')).toBeInTheDocument();
  });

  it('resolves the logging user to their email via the household member list', async () => {
    mockedEventApi.fetchDailyEvents.mockResolvedValueOnce([feedingEvent]);
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValueOnce(members);

    renderList();

    expect(await screen.findByText('Logged by parent-one@example.com')).toBeInTheDocument();
  });

  it('falls back to the raw userId when the logging user is not found in the member list', async () => {
    mockedEventApi.fetchDailyEvents.mockResolvedValueOnce([diaperEvent]);
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValueOnce(members);

    renderList();

    expect(await screen.findByText('Logged by user-unknown')).toBeInTheDocument();
  });

  it('hides a type entirely when the filter set does not include it', async () => {
    mockedEventApi.fetchDailyEvents.mockResolvedValueOnce([feedingEvent, sleepEvent, diaperEvent]);
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValueOnce(members);

    renderList(new Set(['FEEDING', 'DIAPER']));

    expect(await screen.findByText('Bottle (90 ml)')).toBeInTheDocument();
    expect(screen.getByText('Pee')).toBeInTheDocument();
    expect(screen.queryByText('Sleep')).not.toBeInTheDocument();
  });
});
