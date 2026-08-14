import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { SleepEventList } from './SleepEventList';
import * as sleepApi from '../api/sleep-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/sleep-api');

const mockedSleepApi = vi.mocked(sleepApi);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

function renderList() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SleepEventList householdId={HOUSEHOLD_ID} childId={CHILD_ID} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SleepEventList', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('shows the loading indicator while the query is in flight', () => {
    mockedSleepApi.listSleepEvents.mockReturnValue(new Promise(() => {}));

    renderList();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows the empty state when there are no entries', async () => {
    mockedSleepApi.listSleepEvents.mockResolvedValueOnce([]);

    renderList();

    expect(await screen.findByText('No sleep entries recorded yet.')).toBeInTheDocument();
  });

  it('renders a completed sleep entry with its duration and a link to its edit page', async () => {
    mockedSleepApi.listSleepEvents.mockResolvedValueOnce([
      {
        id: 'e1',
        childId: CHILD_ID,
        userId: 'u1',
        type: 'SLEEP',
        occurredAt: '2026-01-01T20:00:00.000Z',
        startedAt: '2026-01-01T20:00:00.000Z',
        endedAt: '2026-01-02T06:00:00.000Z',
        durationSeconds: 36000,
        createdAt: '2026-01-01T20:00:00.000Z',
        updatedAt: '2026-01-01T20:00:00.000Z',
      },
    ]);

    renderList();

    expect(await screen.findByText('Sleep')).toBeInTheDocument();
    expect(screen.getByText('600 min')).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute(
      'href',
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/sleep/e1/edit`,
    );
  });

  it('renders an in-progress sleep entry without a duration', async () => {
    mockedSleepApi.listSleepEvents.mockResolvedValueOnce([
      {
        id: 'e2',
        childId: CHILD_ID,
        userId: 'u1',
        type: 'SLEEP',
        occurredAt: '2026-01-01T20:00:00.000Z',
        startedAt: '2026-01-01T20:00:00.000Z',
        endedAt: null,
        durationSeconds: null,
        createdAt: '2026-01-01T20:00:00.000Z',
        updatedAt: '2026-01-01T20:00:00.000Z',
      },
    ]);

    renderList();

    expect(await screen.findByText('Sleep')).toBeInTheDocument();
    expect(screen.queryByText(/min\.?$/)).not.toBeInTheDocument();
  });
});
