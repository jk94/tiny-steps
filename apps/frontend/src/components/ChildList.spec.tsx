import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ChildList } from './ChildList';
import * as childApi from '../api/child-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/child-api');

const mockedChildApi = vi.mocked(childApi);

function renderChildList(role: 'OWNER' | 'CO_PARENT') {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ChildList householdId="h1" role={role} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ChildList', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('shows the loading indicator while the children query is in flight', () => {
    mockedChildApi.listChildren.mockReturnValue(new Promise(() => {}));

    renderChildList('OWNER');

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows the empty state when there are no children', async () => {
    mockedChildApi.listChildren.mockResolvedValueOnce([]);

    renderChildList('OWNER');

    expect(
      await screen.findByText('No child profiles have been created for this household yet.'),
    ).toBeInTheDocument();
  });

  it('renders a link per child, pointing at its home dashboard', async () => {
    mockedChildApi.listChildren.mockResolvedValueOnce([
      {
        id: 'c1',
        householdId: 'h1',
        name: 'Alex',
        birthDate: '2020-01-01',
        hasPhoto: false,
        createdAt: '2020-01-01T00:00:00.000Z',
      },
    ]);

    renderChildList('OWNER');

    const link = await screen.findByRole('link', { name: 'Alex' });
    expect(link).toHaveAttribute('href', '/households/h1/children/c1');
  });

  it('renders a "Feeding" link per child, pointing at its feeding home', async () => {
    mockedChildApi.listChildren.mockResolvedValueOnce([
      {
        id: 'c1',
        householdId: 'h1',
        name: 'Alex',
        birthDate: '2020-01-01',
        hasPhoto: false,
        createdAt: '2020-01-01T00:00:00.000Z',
      },
    ]);

    renderChildList('OWNER');

    const link = await screen.findByRole('link', { name: 'Feeding' });
    expect(link).toHaveAttribute('href', '/households/h1/children/c1/feeding');
  });

  it('renders a "Sleep" link per child, pointing at its sleep home', async () => {
    mockedChildApi.listChildren.mockResolvedValueOnce([
      {
        id: 'c1',
        householdId: 'h1',
        name: 'Alex',
        birthDate: '2020-01-01',
        hasPhoto: false,
        createdAt: '2020-01-01T00:00:00.000Z',
      },
    ]);

    renderChildList('OWNER');

    const link = await screen.findByRole('link', { name: 'Sleep' });
    expect(link).toHaveAttribute('href', '/households/h1/children/c1/sleep');
  });

  it('renders a "Diaper" link per child, pointing at its diaper home', async () => {
    mockedChildApi.listChildren.mockResolvedValueOnce([
      {
        id: 'c1',
        householdId: 'h1',
        name: 'Alex',
        birthDate: '2020-01-01',
        hasPhoto: false,
        createdAt: '2020-01-01T00:00:00.000Z',
      },
    ]);

    renderChildList('OWNER');

    const link = await screen.findByRole('link', { name: 'Diaper' });
    expect(link).toHaveAttribute('href', '/households/h1/children/c1/diaper');
  });

  it('does not render Export or Settings links per child (those live on the settings page and per-child nav instead)', async () => {
    mockedChildApi.listChildren.mockResolvedValueOnce([
      {
        id: 'c1',
        householdId: 'h1',
        name: 'Alex',
        birthDate: '2020-01-01',
        hasPhoto: false,
        createdAt: '2020-01-01T00:00:00.000Z',
      },
    ]);

    renderChildList('OWNER');

    await screen.findByRole('link', { name: 'Diaper' });
    expect(screen.queryByRole('link', { name: 'Export' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('shows the "add child" link for an OWNER', () => {
    mockedChildApi.listChildren.mockReturnValue(new Promise(() => {}));

    renderChildList('OWNER');

    expect(screen.getByRole('link', { name: 'Add child' })).toBeInTheDocument();
  });

  it('hides the "add child" link for a CO_PARENT', () => {
    mockedChildApi.listChildren.mockReturnValue(new Promise(() => {}));

    renderChildList('CO_PARENT');

    expect(screen.queryByRole('link', { name: 'Add child' })).not.toBeInTheDocument();
  });

  it('is keyboard-operable: tabbing to the child link and pressing Enter navigates to its home dashboard', async () => {
    mockedChildApi.listChildren.mockResolvedValueOnce([
      {
        id: 'c1',
        householdId: 'h1',
        name: 'Alex',
        birthDate: '2020-01-01',
        hasPhoto: false,
        createdAt: '2020-01-01T00:00:00.000Z',
      },
    ]);
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/households/h1']}>
          <Routes>
            <Route
              path="/households/:householdId"
              element={<ChildList householdId="h1" role="OWNER" />}
            />
            <Route path="/households/:householdId/children/:childId" element={<p>Child home</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const link = await screen.findByRole('link', { name: 'Alex' });
    await user.tab();
    expect(link).not.toHaveFocus();
    await user.tab();
    expect(link).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(await screen.findByText('Child home')).toBeInTheDocument();
  });
});
