import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { SleepEventEdit } from './SleepEventEdit';
import * as sleepApi from '../api/sleep-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/sleep-api');

const mockedSleepApi = vi.mocked(sleepApi);

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

const event: sleepApi.SleepEventSummary = {
  id: EVENT_ID,
  childId: CHILD_ID,
  userId: 'u1',
  type: 'SLEEP',
  occurredAt: '2026-01-01T20:00:00.000Z',
  startedAt: '2026-01-01T20:00:00.000Z',
  endedAt: null,
  durationSeconds: null,
  createdAt: '2026-01-01T20:00:00.000Z',
};

function renderSleepEventEdit() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[`/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/sleep/${EVENT_ID}/edit`]}
      >
        <Routes>
          <Route
            path="/households/:householdId/children/:childId/sleep/:eventId/edit"
            element={<SleepEventEdit />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SleepEventEdit', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('pre-fills the form from the fetched sleep event, allowing an empty endedAt (in-progress timer)', async () => {
    mockedSleepApi.fetchSleepEvent.mockResolvedValueOnce(event);

    renderSleepEventEdit();

    // Not hardcoding a local-time string here, since the UTC<->local
    // conversion depends on the test runner's timezone — instead assert
    // the field is non-empty and round-trips back to the fetched ISO value.
    // There is no separate "Start time" field to assert on — `startedAt`
    // is mirrored from `occurredAt` on submit, see `SleepEventForm`.
    const occurredAtField = await screen.findByLabelText('Time');
    expect(occurredAtField).not.toHaveValue('');
    expect(new Date((occurredAtField as HTMLInputElement).value).toISOString()).toBe(
      event.occurredAt,
    );
    expect(screen.queryByLabelText('Start time (optional)')).not.toBeInTheDocument();
    expect(screen.getByLabelText('End time (optional)')).toHaveValue('');
  });

  it('submits a PATCH with the updated fields and navigates back to sleep home', async () => {
    mockedSleepApi.fetchSleepEvent.mockResolvedValueOnce(event);
    mockedSleepApi.updateSleepEvent.mockResolvedValueOnce({
      ...event,
      endedAt: '2026-01-02T06:00:00.000Z',
      durationSeconds: 36000,
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    renderSleepEventEdit();
    await screen.findByLabelText('End time (optional)');
    fireEvent.change(screen.getByLabelText('End time (optional)'), {
      target: { value: '2026-01-02T06:00' },
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockedSleepApi.updateSleepEvent).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      EVENT_ID,
      expect.objectContaining({ endedAt: new Date('2026-01-02T06:00').toISOString() }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['households', HOUSEHOLD_ID, 'children', CHILD_ID, 'sleep-events'],
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/sleep`,
      {
        replace: true,
      },
    );
  });

  it('opens the confirm dialog when Delete is clicked, and cancel closes it without deleting', async () => {
    mockedSleepApi.fetchSleepEvent.mockResolvedValueOnce(event);
    const user = userEvent.setup();

    renderSleepEventEdit();
    await user.click(await screen.findByRole('button', { name: 'Delete entry' }));

    expect(screen.getByText('Delete sleep entry?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockedSleepApi.deleteSleepEvent).not.toHaveBeenCalled();
  });

  it('deletes the entry, invalidates the query, and navigates on confirm', async () => {
    mockedSleepApi.fetchSleepEvent.mockResolvedValueOnce(event);
    mockedSleepApi.deleteSleepEvent.mockResolvedValueOnce(undefined);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    renderSleepEventEdit();
    await user.click(await screen.findByRole('button', { name: 'Delete entry' }));
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));

    expect(mockedSleepApi.deleteSleepEvent).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);
    await vi.waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['households', HOUSEHOLD_ID, 'children', CHILD_ID, 'sleep-events'],
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/sleep`,
      {
        replace: true,
      },
    );
  });
});
