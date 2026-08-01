import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ChildEdit } from './ChildEdit';
import * as householdApi from '../api/household-api';
import * as childApi from '../api/child-api';
import { getPhotoCacheBust } from '../child/childPhotoCacheBust';
import { queryClient } from '../lib/query-client';

vi.mock('../api/household-api');
// Partial mock: `ChildForm` imports `buildChildFormData` from this same
// module, so a full auto-mock would silently turn it into a `vi.fn()`
// returning `undefined` and break `onSubmit`'s FormData payload — keep the
// real implementation, only mock the network calls.
vi.mock('../api/child-api', async () => {
  const actual = await vi.importActual<typeof import('../api/child-api')>('../api/child-api');
  return { ...actual, fetchChild: vi.fn(), updateChild: vi.fn(), deleteChild: vi.fn() };
});

const mockedHouseholdApi = vi.mocked(householdApi);
const mockedChildApi = vi.mocked(childApi);

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

const household = {
  id: 'h1',
  name: 'Team Müller',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const child = {
  id: 'c1',
  householdId: 'h1',
  name: 'Alex',
  birthDate: '2020-01-01T00:00:00.000Z',
  hasPhoto: false,
  createdAt: '2020-01-01T00:00:00.000Z',
};

function renderChildEdit() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/households/h1/children/c1']}>
        <Routes>
          <Route path="/households/:householdId/children/:childId" element={<ChildEdit />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ChildEdit', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('pre-fills the ChildForm with the fetched child', async () => {
    mockedHouseholdApi.fetchHousehold.mockResolvedValueOnce({ ...household, role: 'OWNER' });
    mockedChildApi.fetchChild.mockResolvedValueOnce(child);

    renderChildEdit();

    expect(await screen.findByLabelText('Name')).toHaveValue('Alex');
    expect(screen.getByLabelText('Birth date')).toHaveValue('2020-01-01');
  });

  it('shows the delete button for an OWNER', async () => {
    mockedHouseholdApi.fetchHousehold.mockResolvedValueOnce({ ...household, role: 'OWNER' });
    mockedChildApi.fetchChild.mockResolvedValueOnce(child);

    renderChildEdit();

    expect(await screen.findByRole('button', { name: 'Delete child profile' })).toBeInTheDocument();
  });

  it('hides the delete button for a CO_PARENT', async () => {
    mockedHouseholdApi.fetchHousehold.mockResolvedValueOnce({ ...household, role: 'CO_PARENT' });
    mockedChildApi.fetchChild.mockResolvedValueOnce(child);

    renderChildEdit();

    await screen.findByLabelText('Name');
    expect(screen.queryByRole('button', { name: 'Delete child profile' })).not.toBeInTheDocument();
  });

  it('opens the confirm dialog when Delete is clicked, and cancel closes it without deleting', async () => {
    mockedHouseholdApi.fetchHousehold.mockResolvedValueOnce({ ...household, role: 'OWNER' });
    mockedChildApi.fetchChild.mockResolvedValueOnce(child);
    const user = userEvent.setup();

    renderChildEdit();
    await user.click(await screen.findByRole('button', { name: 'Delete child profile' }));

    expect(screen.getByText('Delete child profile?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockedChildApi.deleteChild).not.toHaveBeenCalled();
  });

  it('deletes the child, invalidates the children query, and navigates on confirm', async () => {
    mockedHouseholdApi.fetchHousehold.mockResolvedValueOnce({ ...household, role: 'OWNER' });
    mockedChildApi.fetchChild.mockResolvedValueOnce(child);
    mockedChildApi.deleteChild.mockResolvedValueOnce(undefined);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    renderChildEdit();
    await user.click(await screen.findByRole('button', { name: 'Delete child profile' }));
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));

    expect(mockedChildApi.deleteChild).toHaveBeenCalledWith('h1', 'c1');
    await vi.waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['households', 'h1', 'children'] }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/households/h1', { replace: true });
  });

  it('updates the child, does NOT bump the photo cache-bust when no photo was submitted, and navigates', async () => {
    mockedHouseholdApi.fetchHousehold.mockResolvedValueOnce({ ...household, role: 'OWNER' });
    mockedChildApi.fetchChild.mockResolvedValueOnce(child);
    mockedChildApi.updateChild.mockResolvedValueOnce({ ...child, name: 'Alexandra' });
    const cacheBustBefore = getPhotoCacheBust('c1');
    const user = userEvent.setup();

    renderChildEdit();
    await screen.findByLabelText('Name');
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Alexandra');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockedChildApi.updateChild).toHaveBeenCalledWith('h1', 'c1', expect.any(FormData));
    expect(getPhotoCacheBust('c1')).toBe(cacheBustBefore);
    expect(mockNavigate).toHaveBeenCalledWith('/households/h1', { replace: true });
  });

  it('bumps the photo cache-bust after a successful update that included a new photo', async () => {
    mockedHouseholdApi.fetchHousehold.mockResolvedValueOnce({ ...household, role: 'OWNER' });
    mockedChildApi.fetchChild.mockResolvedValueOnce(child);
    mockedChildApi.updateChild.mockResolvedValueOnce(child);
    const cacheBustBefore = getPhotoCacheBust('c1');
    const user = userEvent.setup();

    renderChildEdit();
    await screen.findByLabelText('Name');
    const photo = new File(['x'], 'photo.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Photo (optional)'), photo);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(getPhotoCacheBust('c1')).toBeGreaterThanOrEqual(cacheBustBefore);
    const formData = mockedChildApi.updateChild.mock.calls[0][2] as FormData;
    expect(formData.get('photo')).toBe(photo);
  });
});
