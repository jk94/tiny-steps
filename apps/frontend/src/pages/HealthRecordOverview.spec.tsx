import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { HealthRecordOverview } from './HealthRecordOverview';
import type { HealthRecordSummary } from '../api/health-record-api';
import * as healthRecordApi from '../api/health-record-api';
import * as childApi from '../api/child-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/health-record-api', async () => {
  const actual = await vi.importActual<typeof healthRecordApi>('../api/health-record-api');
  return {
    ...actual,
    listHealthRecords: vi.fn(),
    updateHealthRecord: vi.fn(),
    deleteHealthRecord: vi.fn(),
  };
});
vi.mock('../api/child-api', async () => {
  const actual = await vi.importActual<typeof childApi>('../api/child-api');
  return { ...actual, fetchChild: vi.fn() };
});

const mockedHealthRecordApi = vi.mocked(healthRecordApi);
const mockedChildApi = vi.mocked(childApi);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const TODAY = new Date(2026, 0, 15, 10, 0, 0);

const child = {
  id: CHILD_ID,
  householdId: HOUSEHOLD_ID,
  name: 'Mia',
  birthDate: '2025-01-20T00:00:00.000Z',
  hasPhoto: false,
  sex: null,
  createdAt: '2025-01-21T00:00:00.000Z',
};

function makeRecord(overrides: Partial<HealthRecordSummary> = {}): HealthRecordSummary {
  return {
    id: 'r1',
    childId: CHILD_ID,
    userId: 'u1',
    kind: 'VACCINATION',
    name: 'Vaccine',
    administeredAt: null,
    dueAt: '2026-02-01T00:00:00.000Z',
    doseAmount: null,
    doseUnit: null,
    vaccineBatch: null,
    note: null,
    reminderEnabled: false,
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
    ...overrides,
  };
}

function renderOverview() {
  return render(
    <MemoryRouter initialEntries={[`/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/health`]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route
            path="/households/:householdId/children/:childId/health"
            element={<HealthRecordOverview />}
          />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

/** The record names under one of MED-12's two section headings, in order. */
function rowNamesUnder(heading: string): string[] {
  const section = screen.getByRole('heading', { name: heading }).closest('section')!;
  return (
    within(section)
      .queryAllByRole('listitem')
      // The name is the first paragraph of a row; the ones after it are the
      // date, the kind-specific detail and the note.
      .map((item) => within(item).getAllByRole('paragraph')[0].textContent ?? '')
  );
}

describe('HealthRecordOverview', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(TODAY);
    queryClient.clear();
    mockedChildApi.fetchChild.mockResolvedValue(child);
    mockedHealthRecordApi.listHealthRecords.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('splits planned from done and sorts each section (MED-12)', async () => {
    mockedHealthRecordApi.listHealthRecords.mockResolvedValue([
      makeRecord({ id: 'p2', name: 'Planned later', dueAt: '2026-03-01T00:00:00.000Z' }),
      makeRecord({
        id: 'd1',
        name: 'Done older',
        administeredAt: '2026-01-02T09:00:00.000Z',
        dueAt: null,
      }),
      makeRecord({ id: 'p1', name: 'Planned sooner', dueAt: '2026-02-01T00:00:00.000Z' }),
      makeRecord({
        id: 'd2',
        name: 'Done newer',
        administeredAt: '2026-01-10T09:00:00.000Z',
        dueAt: null,
      }),
    ]);

    renderOverview();
    await screen.findByText('Planned sooner');

    // Upcoming ascends (next appointment first), history descends (most
    // recent first).
    expect(rowNamesUnder('Upcoming & overdue')).toEqual(['Planned sooner', 'Planned later']);
    expect(rowNamesUnder('History')).toEqual(['Done newer', 'Done older']);
  });

  it('lists an entry that was planned and later done under the history only', async () => {
    mockedHealthRecordApi.listHealthRecords.mockResolvedValue([
      makeRecord({
        name: 'Fulfilled appointment',
        administeredAt: '2026-01-10T09:00:00.000Z',
        dueAt: '2026-01-08T00:00:00.000Z',
      }),
    ]);

    renderOverview();
    await screen.findByText('Fulfilled appointment');

    expect(rowNamesUnder('History')).toEqual(['Fulfilled appointment']);
    expect(rowNamesUnder('Upcoming & overdue')).toEqual([]);
  });

  it('flags a planned entry whose due day has passed (MED-6)', async () => {
    mockedHealthRecordApi.listHealthRecords.mockResolvedValue([
      makeRecord({ id: 'past', name: 'Overdue one', dueAt: '2026-01-01T00:00:00.000Z' }),
      makeRecord({ id: 'future', name: 'Future one', dueAt: '2026-02-01T00:00:00.000Z' }),
    ]);

    renderOverview();
    await screen.findByText('Overdue one');

    // Exactly one badge — the future appointment must not be flagged.
    expect(screen.getAllByText('Overdue')).toHaveLength(1);
  });

  it('shows an empty state per section', async () => {
    renderOverview();

    expect(await screen.findByText('No appointment planned.')).toBeInTheDocument();
    expect(screen.getByText('Nothing recorded yet.')).toBeInTheDocument();
  });

  it('marks a planned entry as done in one tap, with no confirm dialog (MED-5)', async () => {
    const user = userEvent.setup();
    mockedHealthRecordApi.listHealthRecords.mockResolvedValue([makeRecord()]);
    mockedHealthRecordApi.updateHealthRecord.mockResolvedValue(
      makeRecord({ administeredAt: TODAY.toISOString() }),
    );

    renderOverview();
    await user.click(await screen.findByRole('button', { name: 'Mark as done' }));

    // "Now", not a fixed instant: the point of MED-5 is that the timestamp is
    // the moment of the tap (and stays editable afterwards).
    const [, , , patch] = mockedHealthRecordApi.updateHealthRecord.mock.calls[0];
    expect(Object.keys(patch)).toEqual(['administeredAt']);
    expect(Math.abs(new Date(patch.administeredAt!).getTime() - TODAY.getTime())).toBeLessThan(
      5_000,
    );
  });

  it('asks before deleting, unlike marking as done', async () => {
    const user = userEvent.setup();
    mockedHealthRecordApi.listHealthRecords.mockResolvedValue([makeRecord()]);
    mockedHealthRecordApi.deleteHealthRecord.mockResolvedValue(undefined);

    renderOverview();
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    // A delete is irreversible; a mis-tapped "done" is just an edit away.
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(mockedHealthRecordApi.deleteHealthRecord).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      'r1',
    );
  });

  it('surfaces a failed list load instead of pretending there is nothing', async () => {
    mockedHealthRecordApi.listHealthRecords.mockRejectedValue(new Error('offline'));

    renderOverview();

    expect(await screen.findByText('The entries could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText('No appointment planned.')).not.toBeInTheDocument();
  });
});
