import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { HealthSummaryCard } from './HealthSummaryCard';
import type { HealthRecordSummary } from '../../api/health-record-api';
import * as healthRecordApi from '../../api/health-record-api';
import * as householdApi from '../../api/household-api';
import type { HouseholdRole } from '../../lib/householdPermissions';
import { queryClient } from '../../lib/query-client';

vi.mock('../../api/health-record-api', async () => {
  const actual = await vi.importActual<typeof healthRecordApi>('../../api/health-record-api');
  return { ...actual, listHealthRecords: vi.fn() };
});
vi.mock('../../api/household-api');

const mockedHealthRecordApi = vi.mocked(healthRecordApi);
const mockedHouseholdApi = vi.mocked(householdApi);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const TODAY = new Date(2026, 0, 15, 10, 0, 0);

function makeRecord(overrides: Partial<HealthRecordSummary> = {}): HealthRecordSummary {
  return {
    id: 'r1',
    childId: CHILD_ID,
    userId: 'u1',
    kind: 'VACCINATION',
    name: '6-in-1 vaccine',
    administeredAt: null,
    dueAt: '2026-02-01T00:00:00.000Z',
    doseAmount: null,
    doseUnit: null,
    vaccineBatch: null,
    note: null,
    reminderEnabled: true,
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
    ...overrides,
  };
}

/** Resolves the household query `useHouseholdRole` reads the card's role from. */
function givenHouseholdRole(role: HouseholdRole = 'OWNER') {
  mockedHouseholdApi.fetchHousehold.mockResolvedValue({
    id: HOUSEHOLD_ID,
    name: 'Team Müller',
    role,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
}

function renderCard() {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <HealthSummaryCard householdId={HOUSEHOLD_ID} childId={CHILD_ID} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('HealthSummaryCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(TODAY);
    queryClient.clear();
    givenHouseholdRole();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('names the next due appointment (MED-13)', async () => {
    mockedHealthRecordApi.listHealthRecords.mockResolvedValue([
      makeRecord({ id: 'later', name: 'Later one', dueAt: '2026-03-01T00:00:00.000Z' }),
      makeRecord({ id: 'sooner', name: 'Sooner one', dueAt: '2026-02-01T00:00:00.000Z' }),
    ]);

    renderCard();

    // The soonest still-open appointment, not the first in the response.
    expect(await screen.findByText(/Sooner one/)).toBeInTheDocument();
    expect(screen.queryByText(/Later one/)).not.toBeInTheDocument();
  });

  it('flags an appointment whose due day has passed', async () => {
    mockedHealthRecordApi.listHealthRecords.mockResolvedValue([
      makeRecord({ dueAt: '2026-01-01T00:00:00.000Z' }),
    ]);

    renderCard();

    expect(await screen.findByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText(/was due on/)).toBeInTheDocument();
  });

  it('offers a way in when nothing has been recorded at all', async () => {
    mockedHealthRecordApi.listHealthRecords.mockResolvedValue([]);

    renderCard();

    expect(await screen.findByText('Nothing recorded yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add entry' })).toHaveAttribute(
      'href',
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/health/new`,
    );
  });

  it('keeps the empty-state statement but drops the call to action for an OBSERVER', async () => {
    givenHouseholdRole('OBSERVER');
    mockedHealthRecordApi.listHealthRecords.mockResolvedValue([]);

    renderCard();

    expect(await screen.findByText('Nothing recorded yet.')).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Add entry' })).not.toBeInTheDocument(),
    );
  });

  it('does not claim "nothing recorded" when only the history is non-empty', async () => {
    mockedHealthRecordApi.listHealthRecords.mockResolvedValue([
      makeRecord({ administeredAt: '2026-01-02T09:00:00.000Z', dueAt: null }),
    ]);

    renderCard();

    expect(await screen.findByText('No appointment planned.')).toBeInTheDocument();
    expect(screen.queryByText('Nothing recorded yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all entries' })).toBeInTheDocument();
  });

  it('renders nothing at all when the query fails', async () => {
    // An error state must never be shown as "no appointments" — a parent would
    // read that as "nothing is due".
    mockedHealthRecordApi.listHealthRecords.mockRejectedValue(new Error('offline'));

    const { container } = renderCard();

    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
