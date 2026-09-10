import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { DiaperEventEdit } from './DiaperEventEdit';
import * as diaperApi from '../api/diaper-api';
import * as householdApi from '../api/household-api';
import * as useAuthModule from '../auth/useAuth';
import type { HouseholdRole } from '../lib/householdPermissions';
import { queryClient } from '../lib/query-client';
import { chooseSelectOption } from '../test/chooseSelectOption';
import { stubPopupLayoutApis } from '../test/stubPopupLayoutApis';

vi.mock('../api/diaper-api');
vi.mock('../api/household-api');
vi.mock('../auth/useAuth');
vi.mock('../realtime/useHouseholdRoom');

// The diaper-type field is a Radix combobox — see the helper's doc comment.
stubPopupLayoutApis();

const mockedDiaperApi = vi.mocked(diaperApi);
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

const event: diaperApi.DiaperEventSummary = {
  id: EVENT_ID,
  childId: CHILD_ID,
  userId: CURRENT_USER_ID,
  type: 'DIAPER',
  diaperType: 'PEE',
  occurredAt: '2026-01-01T10:00:00.000Z',
  note: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
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
    givenHouseholdRole();
    givenSignedInUser();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('pre-fills the form from the fetched diaper event, with diaperType enabled', async () => {
    mockedDiaperApi.fetchDiaperEvent.mockResolvedValueOnce(event);

    renderDiaperEventEdit();

    // The combobox trigger shows the selected option's label, not its value.
    expect(await screen.findByLabelText('Diaper type')).toHaveTextContent('Pee');
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
    await chooseSelectOption(user, 'Diaper type', 'Both');
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

    expect(await screen.findByLabelText('Diaper type')).toHaveTextContent('Pee');
  });

  describe('role-dependent actions', () => {
    it.each(['OWNER', 'CO_PARENT'] as const)('offers Delete to a %s', async (role) => {
      givenHouseholdRole(role);
      mockedDiaperApi.fetchDiaperEvent.mockResolvedValueOnce(event);

      renderDiaperEventEdit();

      expect(await screen.findByRole('button', { name: 'Delete entry' })).toBeInTheDocument();
    });

    it.each(['CAREGIVER', 'OBSERVER'] as const)('hides Delete from a %s', async (role) => {
      givenHouseholdRole(role);
      mockedDiaperApi.fetchDiaperEvent.mockResolvedValueOnce(event);

      renderDiaperEventEdit();

      await screen.findByLabelText('Diaper type');
      expect(screen.queryByRole('button', { name: 'Delete entry' })).not.toBeInTheDocument();
    });

    it.each(['OWNER', 'CO_PARENT'] as const)(
      'lets a %s edit and save an entry logged by someone else',
      async (role) => {
        givenHouseholdRole(role);
        mockedDiaperApi.fetchDiaperEvent.mockResolvedValueOnce({ ...event, userId: OTHER_USER_ID });

        renderDiaperEventEdit();

        expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument();
        expect(screen.getByLabelText('Diaper type')).toBeEnabled();
      },
    );

    it('lets a CAREGIVER edit and save their own entry', async () => {
      givenHouseholdRole('CAREGIVER');
      mockedDiaperApi.fetchDiaperEvent.mockResolvedValueOnce(event);

      renderDiaperEventEdit();

      expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument();
      expect(screen.getByLabelText('Diaper type')).toBeEnabled();
    });

    it("hides Save from a CAREGIVER on someone else's entry, but keeps the fields readable", async () => {
      givenHouseholdRole('CAREGIVER');
      mockedDiaperApi.fetchDiaperEvent.mockResolvedValueOnce({ ...event, userId: OTHER_USER_ID });

      renderDiaperEventEdit();

      // This page is the only view of an entry's full fields, so they stay
      // rendered — just disabled, with no way to submit a change.
      const diaperTypeField = await screen.findByLabelText('Diaper type');
      expect(diaperTypeField).toHaveTextContent('Pee');
      expect(diaperTypeField).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });

    it('hides Save from an OBSERVER, but keeps the fields readable', async () => {
      givenHouseholdRole('OBSERVER');
      mockedDiaperApi.fetchDiaperEvent.mockResolvedValueOnce(event);

      renderDiaperEventEdit();

      const diaperTypeField = await screen.findByLabelText('Diaper type');
      expect(diaperTypeField).toHaveTextContent('Pee');
      expect(diaperTypeField).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });
  });
});
