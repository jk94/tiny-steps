import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { FeedingBackfillCreate } from './FeedingBackfillCreate';
import * as feedingApi from '../api/feeding-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/feeding-api');

const mockedFeedingApi = vi.mocked(feedingApi);

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

const created: feedingApi.FeedingEventSummary = {
  id: 'e1',
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
  note: null,
  createdAt: '2026-01-01T10:00:00.000Z',
};

function renderBackfillCreate() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[`/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/feeding/new`]}
      >
        <Routes>
          <Route
            path="/households/:householdId/children/:childId/feeding/new"
            element={<FeedingBackfillCreate />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('FeedingBackfillCreate', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('renders the FeedingEventForm in create mode', () => {
    renderBackfillCreate();

    expect(screen.getByRole('heading', { name: 'Add feeding entry' })).toBeInTheDocument();
    expect(screen.getByLabelText('Feeding type')).toBeEnabled();
  });

  it('creates the entry, invalidates the feeding-events query, and navigates back to feeding home', async () => {
    mockedFeedingApi.createFeedingEvent.mockResolvedValueOnce(created);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    renderBackfillCreate();

    await user.selectOptions(screen.getByLabelText('Feeding type'), 'Solid food');
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '2026-01-01T10:00' } });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(mockedFeedingApi.createFeedingEvent).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      expect.objectContaining({ feedingType: 'SOLID' }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['households', HOUSEHOLD_ID, 'children', CHILD_ID, 'feeding-events'],
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/feeding`,
      { replace: true },
    );
  });
});
