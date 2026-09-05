import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { SleepEventEdit } from './SleepEventEdit';
import * as sleepApi from '../api/sleep-api';
import * as householdApi from '../api/household-api';
import * as useAuthModule from '../auth/useAuth';
import type { HouseholdRole } from '../lib/householdPermissions';
import { queryClient } from '../lib/query-client';

vi.mock('../api/sleep-api');
vi.mock('../api/household-api');
vi.mock('../auth/useAuth');
vi.mock('../realtime/useHouseholdRoom');

const mockedSleepApi = vi.mocked(sleepApi);
const mockedHouseholdApi = vi.mocked(householdApi);
const mockedUseAuth = vi.mocked(useAuthModule.useAuth);

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
/** The signed-in user — also the author of `event` below (an "own" entry). */
const CURRENT_USER_ID = 'u1';
/** Another household member, so `event` can be turned into a "foreign" entry. */
const OTHER_USER_ID = 'u2';

const event: sleepApi.SleepEventSummary = {
  id: EVENT_ID,
  childId: CHILD_ID,
  userId: CURRENT_USER_ID,
  type: 'SLEEP',
  occurredAt: '2026-01-01T20:00:00.000Z',
  startedAt: '2026-01-01T20:00:00.000Z',
  endedAt: null,
  durationSeconds: null,
  createdAt: '2026-01-01T20:00:00.000Z',
  updatedAt: '2026-01-01T20:00:00.000Z',
};

/**
 * Resolves the household query `useHouseholdRole` shares with `HouseholdDetail`,
 * so the page's role-gating sees a concrete role. Defaults to `OWNER` — the role
 * the pre-existing delete tests were implicitly written against.
 */
function givenHouseholdRole(role: HouseholdRole = 'OWNER') {
  mockedHouseholdApi.fetchHousehold.mockResolvedValue({
    id: HOUSEHOLD_ID,
    name: 'Team Müller',
    role,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
}

/** Signs a user in, so the page's ownership check has a concrete id to compare. */
function givenSignedInUser(id: string = CURRENT_USER_ID) {
  mockedUseAuth.mockReturnValue({
    user: { id, email: 'parent@example.com', name: 'Bernd', createdAt: '2026-01-01T00:00:00.000Z' },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    updateName: vi.fn(),
    logout: vi.fn(),
  });
}

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
    givenHouseholdRole();
    givenSignedInUser();
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

  it('submits an optimistic PATCH (with a clientTimestamp) and navigates back to sleep home', async () => {
    mockedSleepApi.fetchSleepEvent.mockResolvedValueOnce(event);
    mockedSleepApi.updateSleepEventOptimistic.mockResolvedValueOnce({
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

    expect(mockedSleepApi.updateSleepEventOptimistic).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      expect.objectContaining({ id: EVENT_ID }),
      expect.objectContaining({
        endedAt: new Date('2026-01-02T06:00').toISOString(),
        clientTimestamp: expect.any(String),
      }),
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

  it('seeds the form from the cached list row when the direct fetch is unavailable offline (JC-5)', async () => {
    queryClient.setQueryData(
      ['households', HOUSEHOLD_ID, 'children', CHILD_ID, 'sleep-events'],
      [event],
    );
    mockedSleepApi.fetchSleepEvent.mockRejectedValueOnce(new TypeError('offline'));

    renderSleepEventEdit();

    // The form (its Save button) renders from cache rather than the error state.
    expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  describe('role-dependent actions', () => {
    it.each(['OWNER', 'CO_PARENT'] as const)('offers Delete to a %s', async (role) => {
      givenHouseholdRole(role);
      mockedSleepApi.fetchSleepEvent.mockResolvedValueOnce(event);

      renderSleepEventEdit();

      expect(await screen.findByRole('button', { name: 'Delete entry' })).toBeInTheDocument();
    });

    it.each(['CAREGIVER', 'OBSERVER'] as const)('hides Delete from a %s', async (role) => {
      givenHouseholdRole(role);
      mockedSleepApi.fetchSleepEvent.mockResolvedValueOnce(event);

      renderSleepEventEdit();

      await screen.findByLabelText('End time (optional)');
      expect(screen.queryByRole('button', { name: 'Delete entry' })).not.toBeInTheDocument();
    });

    it.each(['OWNER', 'CO_PARENT'] as const)(
      'lets a %s edit and save an entry logged by someone else',
      async (role) => {
        givenHouseholdRole(role);
        mockedSleepApi.fetchSleepEvent.mockResolvedValueOnce({ ...event, userId: OTHER_USER_ID });

        renderSleepEventEdit();

        expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument();
        expect(screen.getByLabelText('End time (optional)')).toBeEnabled();
      },
    );

    it('lets a CAREGIVER edit and save their own entry', async () => {
      givenHouseholdRole('CAREGIVER');
      mockedSleepApi.fetchSleepEvent.mockResolvedValueOnce(event);

      renderSleepEventEdit();

      expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument();
      expect(screen.getByLabelText('End time (optional)')).toBeEnabled();
    });

    it("hides Save from a CAREGIVER on someone else's entry, but keeps the fields readable", async () => {
      givenHouseholdRole('CAREGIVER');
      mockedSleepApi.fetchSleepEvent.mockResolvedValueOnce({ ...event, userId: OTHER_USER_ID });

      renderSleepEventEdit();

      // This page is the only view of an entry's full fields, so they stay
      // rendered — just disabled, with no way to submit a change.
      const endedAtField = await screen.findByLabelText('End time (optional)');
      expect(endedAtField).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });

    it('hides Save from an OBSERVER, but keeps the fields readable', async () => {
      givenHouseholdRole('OBSERVER');
      mockedSleepApi.fetchSleepEvent.mockResolvedValueOnce(event);

      renderSleepEventEdit();

      const occurredAtField = await screen.findByLabelText('Time');
      expect(occurredAtField).toBeDisabled();
      expect(new Date((occurredAtField as HTMLInputElement).value).toISOString()).toBe(
        event.occurredAt,
      );
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });
  });
});
