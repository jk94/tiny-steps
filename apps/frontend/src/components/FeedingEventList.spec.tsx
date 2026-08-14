import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { FeedingEventList } from './FeedingEventList';
import * as feedingApi from '../api/feeding-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/feeding-api');

const mockedFeedingApi = vi.mocked(feedingApi);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

function renderList() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FeedingEventList householdId={HOUSEHOLD_ID} childId={CHILD_ID} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('FeedingEventList', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('shows the loading indicator while the query is in flight', () => {
    mockedFeedingApi.listFeedingEvents.mockReturnValue(new Promise(() => {}));

    renderList();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows the empty state when there are no entries', async () => {
    mockedFeedingApi.listFeedingEvents.mockResolvedValueOnce([]);

    renderList();

    expect(await screen.findByText('No feeding entries recorded yet.')).toBeInTheDocument();
  });

  it('renders a completed BREAST entry with its duration and a link to its edit page', async () => {
    mockedFeedingApi.listFeedingEvents.mockResolvedValueOnce([
      {
        id: 'e1',
        childId: CHILD_ID,
        userId: 'u1',
        type: 'FEEDING',
        feedingType: 'BREAST',
        occurredAt: '2026-01-01T10:00:00.000Z',
        startedAt: '2026-01-01T10:00:00.000Z',
        endedAt: '2026-01-01T10:15:00.000Z',
        durationSeconds: 900,
        side: 'RIGHT',
        amountMl: null,
        note: null,
        createdAt: '2026-01-01T10:00:00.000Z',
        updatedAt: '2026-01-01T10:00:00.000Z',
      },
    ]);

    renderList();

    expect(await screen.findByText('Breastfeeding (right)')).toBeInTheDocument();
    expect(screen.getByText('15 min')).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute(
      'href',
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/feeding/e1/edit`,
    );
  });

  it('renders a BOTTLE entry with its amount', async () => {
    mockedFeedingApi.listFeedingEvents.mockResolvedValueOnce([
      {
        id: 'e2',
        childId: CHILD_ID,
        userId: 'u1',
        type: 'FEEDING',
        feedingType: 'BOTTLE',
        occurredAt: '2026-01-01T10:00:00.000Z',
        startedAt: null,
        endedAt: null,
        durationSeconds: null,
        side: null,
        amountMl: 90,
        note: null,
        createdAt: '2026-01-01T10:00:00.000Z',
        updatedAt: '2026-01-01T10:00:00.000Z',
      },
    ]);

    renderList();

    expect(await screen.findByText('Bottle (90 ml)')).toBeInTheDocument();
  });

  it('renders a SOLID entry', async () => {
    mockedFeedingApi.listFeedingEvents.mockResolvedValueOnce([
      {
        id: 'e3',
        childId: CHILD_ID,
        userId: 'u1',
        type: 'FEEDING',
        feedingType: 'SOLID',
        occurredAt: '2026-01-01T10:00:00.000Z',
        startedAt: null,
        endedAt: null,
        durationSeconds: null,
        side: null,
        amountMl: null,
        note: 'Half a banana',
        createdAt: '2026-01-01T10:00:00.000Z',
        updatedAt: '2026-01-01T10:00:00.000Z',
      },
    ]);

    renderList();

    expect(await screen.findByText('Solid food')).toBeInTheDocument();
  });
});
