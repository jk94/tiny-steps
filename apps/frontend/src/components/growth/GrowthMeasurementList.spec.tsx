import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { GrowthMeasurementList } from './GrowthMeasurementList';
import type { GrowthMeasurementSummary } from '../../api/growth-api';
import * as growthApi from '../../api/growth-api';
import * as householdApi from '../../api/household-api';
import { queryClient } from '../../lib/query-client';

vi.mock('../../api/growth-api', async () => {
  const actual = await vi.importActual<typeof growthApi>('../../api/growth-api');
  return { ...actual, deleteGrowthMeasurement: vi.fn() };
});
vi.mock('../../api/household-api');

const mockedGrowthApi = vi.mocked(growthApi);
const mockedHouseholdApi = vi.mocked(householdApi);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const BIRTH_DATE = '2025-01-01T00:00:00.000Z';

function makeMeasurement(
  overrides: Partial<GrowthMeasurementSummary> = {},
): GrowthMeasurementSummary {
  return {
    id: 'm1',
    childId: CHILD_ID,
    userId: 'u1',
    measuredAt: '2025-04-01T12:00:00.000Z',
    ageInDaysAtMeasurement: 90,
    weightGrams: 6400,
    lengthMillimeters: 615,
    headCircumferenceMillimeters: null,
    lengthMeasurementPosition: null,
    effectiveLengthMeasurementPosition: 'LYING',
    lengthOrHeightReferenceUsed: 'LENGTH',
    note: null,
    createdAt: '2025-04-01T12:00:00.000Z',
    updatedAt: '2025-04-01T12:00:00.000Z',
    percentiles: {
      weight: { status: 'COMPUTED', zScore: 0.1, percentile: 54 },
      length: { status: 'UNAVAILABLE', reason: 'CHILD_SEX_NOT_SET' },
      headCircumference: null,
    },
    ...overrides,
  };
}

function renderList(measurements: GrowthMeasurementSummary[], isLoading = false) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <GrowthMeasurementList
          householdId={HOUSEHOLD_ID}
          childId={CHILD_ID}
          birthDate={BIRTH_DATE}
          measurements={measurements}
          isLoading={isLoading}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GrowthMeasurementList', () => {
  beforeEach(() => {
    queryClient.clear();
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValue([
      {
        userId: 'u1',
        email: 'parent@example.com',
        name: null,
        role: 'OWNER',
        joinedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('shows a skeleton while the measurements are loading', () => {
    renderList([], true);

    expect(document.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it('shows an empty state with a call to record the first measurement', () => {
    renderList([]);

    expect(screen.getByText('No measurements yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Record the first measurement' })).toHaveAttribute(
      'href',
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/growth/new`,
    );
  });

  it('renders each recorded value in its display unit', () => {
    renderList([makeMeasurement()]);

    expect(screen.getByText('Weight: 6.4 kg')).toBeInTheDocument();
    expect(screen.getByText('Length/height: 61.5 cm')).toBeInTheDocument();
    // Absent values produce no row at all (W-2).
    expect(screen.queryByText(/Head circumference:/)).not.toBeInTheDocument();
  });

  it('shows the percentile as a badge, or the reason it is unavailable (W-10)', () => {
    renderList([makeMeasurement()]);

    expect(screen.getByText('54th percentile')).toBeInTheDocument();
    expect(screen.getByText("Percentiles need the child's sex.")).toBeInTheDocument();
  });

  it('shows the z-score next to the percentile (W-9)', () => {
    renderList([makeMeasurement()]);

    expect(screen.getByText('z-score 0.10')).toBeInTheDocument();
  });

  it('shows no z-score when the percentile could not be computed', () => {
    renderList([makeMeasurement()]);

    // The length percentile is UNAVAILABLE in the fixture, so there is exactly
    // one z-score on the row (the weight's).
    expect(screen.getAllByText(/z-score/)).toHaveLength(1);
  });

  it('shows the measurement method used for the body measure (W-19)', () => {
    renderList([makeMeasurement({ effectiveLengthMeasurementPosition: 'STANDING' })]);

    expect(screen.getByText('Measured standing')).toBeInTheDocument();
  });

  it('resolves the recording user to their email (W-7)', async () => {
    renderList([makeMeasurement()]);

    expect(await screen.findByText('Recorded by parent@example.com')).toBeInTheDocument();
  });

  it('states the age at measurement time', () => {
    renderList([makeMeasurement()]);

    expect(screen.getByText('3 months old')).toBeInTheDocument();
  });

  it('lists the newest measurement first', () => {
    renderList([
      makeMeasurement({ id: 'older', measuredAt: '2025-02-01T09:00:00.000Z' }),
      makeMeasurement({ id: 'newer', measuredAt: '2025-06-01T09:00:00.000Z' }),
    ]);

    const dates = screen
      .getAllByRole('listitem')
      .map((item) => item.textContent ?? '')
      .filter((text) => text.includes('/2025'));
    expect(dates[0]).toContain('6/1/2025');
  });

  it('links each row to its edit page (W-8)', () => {
    renderList([makeMeasurement()]);

    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/growth/m1/edit`,
    );
  });

  describe('deleting a measurement (W-8)', () => {
    it('asks for confirmation before deleting', async () => {
      const user = userEvent.setup();
      renderList([makeMeasurement()]);

      await user.click(screen.getByRole('button', { name: 'Delete' }));

      expect(await screen.findByText('Delete measurement?')).toBeInTheDocument();
      expect(mockedGrowthApi.deleteGrowthMeasurement).not.toHaveBeenCalled();
    });

    it('hard-deletes on confirmation', async () => {
      const user = userEvent.setup();
      mockedGrowthApi.deleteGrowthMeasurement.mockResolvedValue(undefined);
      renderList([makeMeasurement()]);

      await user.click(screen.getByRole('button', { name: 'Delete' }));
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Delete permanently' }));

      expect(mockedGrowthApi.deleteGrowthMeasurement).toHaveBeenCalledWith(
        HOUSEHOLD_ID,
        CHILD_ID,
        'm1',
      );
    });

    it('surfaces a failed delete instead of pretending it worked (W-16)', async () => {
      const user = userEvent.setup();
      mockedGrowthApi.deleteGrowthMeasurement.mockRejectedValue(new Error('offline'));
      renderList([makeMeasurement()]);

      await user.click(screen.getByRole('button', { name: 'Delete' }));
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Delete permanently' }));

      expect(
        await screen.findByText('The measurement could not be deleted. Please try again.'),
      ).toBeInTheDocument();
    });
  });
});
