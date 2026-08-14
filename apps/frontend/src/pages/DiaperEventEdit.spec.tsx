import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { DiaperEventEdit } from './DiaperEventEdit';
import * as diaperApi from '../api/diaper-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/diaper-api');
vi.mock('../realtime/useHouseholdRoom');

const mockedDiaperApi = vi.mocked(diaperApi);

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

const event: diaperApi.DiaperEventSummary = {
  id: EVENT_ID,
  childId: CHILD_ID,
  userId: 'u1',
  type: 'DIAPER',
  diaperType: 'PEE',
  occurredAt: '2026-01-01T10:00:00.000Z',
  note: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
};

function renderDiaperEventEdit() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[
          `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/diaper/${EVENT_ID}/edit`,
        ]}
      >
        <Routes>
          <Route
            path="/households/:householdId/children/:childId/diaper/:eventId/edit"
            element={<DiaperEventEdit />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DiaperEventEdit', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('pre-fills the form from the fetched diaper event, with diaperType enabled', async () => {
    mockedDiaperApi.fetchDiaperEvent.mockResolvedValueOnce(event);

    renderDiaperEventEdit();

    expect(await screen.findByLabelText('Diaper type')).toHaveValue('PEE');
    expect(screen.getByLabelText('Diaper type')).toBeEnabled();
  });

  it('submits an optimistic PATCH (with a clientTimestamp, incl. diaperType) and navigates back', async () => {
    mockedDiaperApi.fetchDiaperEvent.mockResolvedValueOnce(event);
    mockedDiaperApi.updateDiaperEventOptimistic.mockResolvedValueOnce({
      ...event,
      diaperType: 'BOTH',
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    renderDiaperEventEdit();
    await screen.findByLabelText('Diaper type');
    await user.selectOptions(screen.getByLabelText('Diaper type'), 'Both');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockedDiaperApi.updateDiaperEventOptimistic).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      expect.objectContaining({ id: EVENT_ID }),
      expect.objectContaining({ diaperType: 'BOTH', clientTimestamp: expect.any(String) }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['households', HOUSEHOLD_ID, 'children', CHILD_ID, 'diaper-events'],
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/diaper`,
      { replace: true },
    );
  });

  it('opens the confirm dialog when Delete is clicked, and cancel closes it without deleting', async () => {
    mockedDiaperApi.fetchDiaperEvent.mockResolvedValueOnce(event);
    const user = userEvent.setup();

    renderDiaperEventEdit();
    await user.click(await screen.findByRole('button', { name: 'Delete entry' }));

    expect(screen.getByText('Delete diaper entry?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockedDiaperApi.deleteDiaperEvent).not.toHaveBeenCalled();
  });

  it('deletes the entry, invalidates the query, and navigates on confirm', async () => {
    mockedDiaperApi.fetchDiaperEvent.mockResolvedValueOnce(event);
    mockedDiaperApi.deleteDiaperEvent.mockResolvedValueOnce(undefined);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    renderDiaperEventEdit();
    await user.click(await screen.findByRole('button', { name: 'Delete entry' }));
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));

    expect(mockedDiaperApi.deleteDiaperEvent).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      EVENT_ID,
    );
    await vi.waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['households', HOUSEHOLD_ID, 'children', CHILD_ID, 'diaper-events'],
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/diaper`,
      { replace: true },
    );
  });

  it('shows the mapped error message when the initial fetch fails', async () => {
    mockedDiaperApi.fetchDiaperEvent.mockRejectedValueOnce(
      new (await import('../api/http-client')).ApiError(404, {}),
    );

    renderDiaperEventEdit();

    expect(await screen.findByText("This diaper entry wasn't found.")).toBeInTheDocument();
  });

  it('seeds the form from the cached list row when the direct fetch is unavailable offline (JC-5)', async () => {
    queryClient.setQueryData(
      ['households', HOUSEHOLD_ID, 'children', CHILD_ID, 'diaper-events'],
      [event],
    );
    mockedDiaperApi.fetchDiaperEvent.mockRejectedValueOnce(new TypeError('offline'));

    renderDiaperEventEdit();

    expect(await screen.findByLabelText('Diaper type')).toHaveValue('PEE');
  });
});
