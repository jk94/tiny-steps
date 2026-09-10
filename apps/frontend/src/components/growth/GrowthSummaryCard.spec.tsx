import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { GrowthSummaryCard } from './GrowthSummaryCard';
import type { GrowthMeasurementSummary } from '../../api/growth-api';
import * as growthApi from '../../api/growth-api';
import * as householdApi from '../../api/household-api';
import type { HouseholdRole } from '../../lib/householdPermissions';
import { queryClient } from '../../lib/query-client';

vi.mock('../../api/growth-api', async () => {
  const actual = await vi.importActual<typeof growthApi>('../../api/growth-api');
  return { ...actual, listGrowthMeasurements: vi.fn() };
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
    lengthMillimeters: null,
    headCircumferenceMillimeters: null,
    lengthMeasurementPosition: null,
    effectiveLengthMeasurementPosition: null,
    lengthOrHeightReferenceUsed: null,
    note: null,
    createdAt: '2025-04-01T12:00:00.000Z',
    updatedAt: '2025-04-01T12:00:00.000Z',
    percentiles: {
      weight: { status: 'COMPUTED', zScore: 0.1, percentile: 54 },
      length: null,
      headCircumference: null,
    },
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
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <GrowthSummaryCard householdId={HOUSEHOLD_ID} childId={CHILD_ID} birthDate={BIRTH_DATE} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GrowthSummaryCard (W-15)', () => {
  beforeEach(() => {
    queryClient.clear();
    givenHouseholdRole();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('shows the latest measurement with its value, percentile and age', async () => {
    mockedGrowthApi.listGrowthMeasurements.mockResolvedValue([
      makeMeasurement({ id: 'older', measuredAt: '2025-02-01T12:00:00.000Z', weightGrams: 5000 }),
      makeMeasurement(),
    ]);

    renderCard();

    expect(await screen.findByText('Weight: 6.4 kg')).toBeInTheDocument();
    expect(screen.getByText('54th percentile')).toBeInTheDocument();
    expect(screen.getByText('z-score 0.10')).toBeInTheDocument();
    expect(screen.getByText('3 months old')).toBeInTheDocument();
    // The older measurement is not shown — only the latest one.
    expect(screen.queryByText('Weight: 5 kg')).not.toBeInTheDocument();
  });

  it('links to the full growth trend', async () => {
    mockedGrowthApi.listGrowthMeasurements.mockResolvedValue([makeMeasurement()]);

    renderCard();

    expect(await screen.findByRole('link', { name: 'View trend' })).toHaveAttribute(
      'href',
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/growth`,
    );
  });

  it('shows an empty state with a call to record a measurement', async () => {
    mockedGrowthApi.listGrowthMeasurements.mockResolvedValue([]);

    renderCard();

    expect(await screen.findByText('No measurement recorded yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Record a measurement' })).toHaveAttribute(
      'href',
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/growth/new`,
    );
  });

  it('keeps the empty-state statement but drops the call to action for an OBSERVER', async () => {
    givenHouseholdRole('OBSERVER');
    mockedGrowthApi.listGrowthMeasurements.mockResolvedValue([]);

    renderCard();

    expect(await screen.findByText('No measurement recorded yet.')).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Record a measurement' })).not.toBeInTheDocument(),
    );
  });

  it('renders nothing at all when the query fails, so the overview still works', async () => {
    mockedGrowthApi.listGrowthMeasurements.mockRejectedValue(new Error('offline'));

    const { container } = renderCard();

    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('shows a skeleton while loading', () => {
    mockedGrowthApi.listGrowthMeasurements.mockReturnValue(new Promise(() => {}));

    renderCard();

    expect(document.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });
});
