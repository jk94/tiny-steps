import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { DiaperEventList } from './DiaperEventList';
import * as diaperApi from '../api/diaper-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/diaper-api');

const mockedDiaperApi = vi.mocked(diaperApi);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

function renderList() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DiaperEventList householdId={HOUSEHOLD_ID} childId={CHILD_ID} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DiaperEventList', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('shows the loading indicator while the query is in flight', () => {
    mockedDiaperApi.listDiaperEvents.mockReturnValue(new Promise(() => {}));

    renderList();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows the empty state when there are no entries', async () => {
    mockedDiaperApi.listDiaperEvents.mockResolvedValueOnce([]);

    renderList();

    expect(await screen.findByText('No diaper changes recorded yet.')).toBeInTheDocument();
  });

  it('renders a PEE entry with a link to its edit page', async () => {
    mockedDiaperApi.listDiaperEvents.mockResolvedValueOnce([
      {
        id: 'e1',
        childId: CHILD_ID,
        userId: 'u1',
        type: 'DIAPER',
        diaperType: 'PEE',
        occurredAt: '2026-01-01T10:00:00.000Z',
        note: null,
        createdAt: '2026-01-01T10:00:00.000Z',
      },
    ]);

    renderList();

    expect(await screen.findByText('Pee')).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute(
      'href',
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/diaper/e1/edit`,
    );
  });

  it('renders a STOOL entry', async () => {
    mockedDiaperApi.listDiaperEvents.mockResolvedValueOnce([
      {
        id: 'e2',
        childId: CHILD_ID,
        userId: 'u1',
        type: 'DIAPER',
        diaperType: 'STOOL',
        occurredAt: '2026-01-01T10:00:00.000Z',
        note: null,
        createdAt: '2026-01-01T10:00:00.000Z',
      },
    ]);

    renderList();

    expect(await screen.findByText('Stool')).toBeInTheDocument();
  });

  it('renders a BOTH entry', async () => {
    mockedDiaperApi.listDiaperEvents.mockResolvedValueOnce([
      {
        id: 'e3',
        childId: CHILD_ID,
        userId: 'u1',
        type: 'DIAPER',
        diaperType: 'BOTH',
        occurredAt: '2026-01-01T10:00:00.000Z',
        note: 'Needs cream',
        createdAt: '2026-01-01T10:00:00.000Z',
      },
    ]);

    renderList();

    expect(await screen.findByText('Both')).toBeInTheDocument();
  });
});
