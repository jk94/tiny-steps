import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { FeedingEventEdit } from './FeedingEventEdit';
import * as feedingApi from '../api/feeding-api';
import { ApiError } from '../api/http-client';
import { queryClient } from '../lib/query-client';

vi.mock('../api/feeding-api');
vi.mock('../realtime/useHouseholdRoom');

const mockedFeedingApi = vi.mocked(feedingApi);

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

// jsdom doesn't implement `HTMLDialogElement.showModal()`/`.close()` — see
// `components/ConfirmDialog.spec.tsx` for the full rationale.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  });
});

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const EVENT_ID = 'e1';

const event: feedingApi.FeedingEventSummary = {
  id: EVENT_ID,
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
};

function renderFeedingEventEdit() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[
          `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/feeding/${EVENT_ID}/edit`,
        ]}
      >
        <Routes>
          <Route
            path="/households/:householdId/children/:childId/feeding/:eventId/edit"
            element={<FeedingEventEdit />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('FeedingEventEdit', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('pre-fills the form from the fetched feeding event', async () => {
    mockedFeedingApi.fetchFeedingEvent.mockResolvedValueOnce(event);

    renderFeedingEventEdit();

    expect(await screen.findByLabelText('Amount (ml)')).toHaveValue(90);
    expect(screen.getByLabelText('Feeding type')).toBeDisabled();
  });

  it('submits an optimistic PATCH (with a clientTimestamp) and navigates back to feeding home', async () => {
    mockedFeedingApi.fetchFeedingEvent.mockResolvedValueOnce(event);
    mockedFeedingApi.updateFeedingEventOptimistic.mockResolvedValueOnce({
      ...event,
      amountMl: 120,
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    renderFeedingEventEdit();
    await screen.findByLabelText('Amount (ml)');
    await user.clear(screen.getByLabelText('Amount (ml)'));
    await user.type(screen.getByLabelText('Amount (ml)'), '120');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockedFeedingApi.updateFeedingEventOptimistic).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      expect.objectContaining({ id: EVENT_ID }),
      expect.objectContaining({ amountMl: 120, clientTimestamp: expect.any(String) }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['households', HOUSEHOLD_ID, 'children', CHILD_ID, 'feeding-events'],
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/feeding`,
      { replace: true },
    );
  });

  it('opens the confirm dialog when Delete is clicked, and cancel closes it without deleting', async () => {
    mockedFeedingApi.fetchFeedingEvent.mockResolvedValueOnce(event);
    const user = userEvent.setup();

    renderFeedingEventEdit();
    await user.click(await screen.findByRole('button', { name: 'Delete entry' }));

    expect(screen.getByText('Delete feeding entry?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockedFeedingApi.deleteFeedingEvent).not.toHaveBeenCalled();
  });

  it('deletes the entry, invalidates the query, and navigates on confirm', async () => {
    mockedFeedingApi.fetchFeedingEvent.mockResolvedValueOnce(event);
    mockedFeedingApi.deleteFeedingEvent.mockResolvedValueOnce(undefined);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    renderFeedingEventEdit();
    await user.click(await screen.findByRole('button', { name: 'Delete entry' }));
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));

    expect(mockedFeedingApi.deleteFeedingEvent).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      EVENT_ID,
    );
    await vi.waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['households', HOUSEHOLD_ID, 'children', CHILD_ID, 'feeding-events'],
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/feeding`,
      { replace: true },
    );
  });

  it('seeds the form from the cached list row when the direct fetch is unavailable offline (JC-5)', async () => {
    // No direct-fetch response is available (offline), but the list query cache
    // already holds the row — the edit page must still render the form.
    queryClient.setQueryData(
      ['households', HOUSEHOLD_ID, 'children', CHILD_ID, 'feeding-events'],
      [event],
    );
    mockedFeedingApi.fetchFeedingEvent.mockRejectedValueOnce(new TypeError('offline'));

    renderFeedingEventEdit();

    expect(await screen.findByLabelText('Amount (ml)')).toHaveValue(90);
  });

  it('navigates back after a failed (buffered) offline submit rather than blocking on the edit page', async () => {
    mockedFeedingApi.fetchFeedingEvent.mockResolvedValueOnce(event);
    // The optimistic wrapper buffers the edit but its network call fails; it
    // rethrows, yet the page should still return to the list (JC-2).
    mockedFeedingApi.updateFeedingEventOptimistic.mockRejectedValueOnce(new TypeError('offline'));
    const user = userEvent.setup();

    renderFeedingEventEdit();
    await screen.findByLabelText('Amount (ml)');
    await user.clear(screen.getByLabelText('Amount (ml)'));
    await user.type(screen.getByLabelText('Amount (ml)'), '120');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/feeding`,
        { replace: true },
      ),
    );
  });

  it('navigates back on a synchronous conflict without showing a bespoke inline error (JC-3)', async () => {
    mockedFeedingApi.fetchFeedingEvent.mockResolvedValueOnce(event);
    mockedFeedingApi.updateFeedingEventOptimistic.mockRejectedValueOnce(
      new ApiError(409, { code: 'EVENT_CONFLICT', currentEvent: event }),
    );
    const user = userEvent.setup();

    renderFeedingEventEdit();
    await screen.findByLabelText('Amount (ml)');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // The notice is surfaced by the app-root banner (recorded inside the engine),
    // not by an inline message here — the page just returns to the list.
    await vi.waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/feeding`,
        { replace: true },
      ),
    );
  });
});
