import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { GrowthHome } from './GrowthHome';
import type { ChildSummary } from '../api/child-api';
import type { GrowthMeasurementSummary, GrowthReferenceResponse } from '../api/growth-api';
import * as childApi from '../api/child-api';
import * as growthApi from '../api/growth-api';
import * as householdApi from '../api/household-api';
import * as useAuthModule from '../auth/useAuth';
import { queryClient } from '../lib/query-client';

vi.mock('../api/child-api');
vi.mock('../api/household-api');
vi.mock('../auth/useAuth');
vi.mock('../api/growth-api', async () => {
  const actual = await vi.importActual<typeof growthApi>('../api/growth-api');
  return {
    ...actual,
    listGrowthMeasurements: vi.fn(),
    fetchGrowthReference: vi.fn(),
    deleteGrowthMeasurement: vi.fn(),
  };
});
// The chart is a lazily loaded visx chunk; rendering it here would only
// re-test GrowthChart.spec's ground, and jsdom reports no layout for it.
vi.mock('../components/growth/GrowthChart', () => ({
  default: ({ measure }: { measure: string }) => <div data-testid="growth-chart">{measure}</div>,
}));

const mockedChildApi = vi.mocked(childApi);
const mockedGrowthApi = vi.mocked(growthApi);
const mockedHouseholdApi = vi.mocked(householdApi);
const mockedUseAuth = vi.mocked(useAuthModule.useAuth);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

function makeChild(overrides: Partial<ChildSummary> = {}): ChildSummary {
  return {
    id: CHILD_ID,
    householdId: HOUSEHOLD_ID,
    name: 'Mia',
    birthDate: '2025-01-01T00:00:00.000Z',
    hasPhoto: false,
    sex: 'FEMALE',
    createdAt: '2025-01-02T00:00:00.000Z',
    ...overrides,
  };
}

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
    headCircumferenceMillimeters: 405,
    lengthMeasurementPosition: null,
    effectiveLengthMeasurementPosition: 'LYING',
    lengthOrHeightReferenceUsed: 'LENGTH',
    note: null,
    createdAt: '2025-04-01T12:00:00.000Z',
    updatedAt: '2025-04-01T12:00:00.000Z',
    percentiles: {
      weight: { status: 'COMPUTED', zScore: 0.1, percentile: 54 },
      length: { status: 'COMPUTED', zScore: -0.2, percentile: 42 },
      headCircumference: { status: 'COMPUTED', zScore: 0, percentile: 50 },
    },
    ...overrides,
  };
}

const availableReference: GrowthReferenceResponse = {
  indicator: 'WEIGHT_FOR_AGE',
  sex: 'FEMALE',
  available: true,
  xUnit: 'DAYS',
  unit: 'GRAMS',
  ageRangeDays: [0, 1826],
  stepDays: 7,
  lengthToHeightBoundaryDays: 731,
  curves: [],
};

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/growth`]}>
        <Routes>
          <Route
            path="/households/:householdId/children/:childId/growth"
            element={<GrowthHome />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GrowthHome', () => {
  beforeEach(() => {
    queryClient.clear();
    mockedUseAuth.mockReturnValue({
      user: {
        id: 'u1',
        email: 'parent@example.com',
        name: 'Bernd',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      updateName: vi.fn(),
      logout: vi.fn(),
    });
    mockedHouseholdApi.fetchHousehold.mockResolvedValue({
      id: 'h1',
      name: 'Team Müller',
      role: 'OWNER',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    mockedChildApi.fetchChild.mockResolvedValue(makeChild());
    mockedGrowthApi.listGrowthMeasurements.mockResolvedValue([makeMeasurement()]);
    mockedGrowthApi.fetchGrowthReference.mockResolvedValue(availableReference);
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

  it('shows the child name in the heading and the chart for the default measure', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Growth — Mia' })).toBeInTheDocument();
    expect(await screen.findByTestId('growth-chart')).toHaveTextContent('WEIGHT');
  });

  it('re-queries the reference bands when another measure tab is selected', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('growth-chart');

    await user.click(screen.getByRole('tab', { name: 'Length/height' }));

    expect(await screen.findByTestId('growth-chart')).toHaveTextContent('LENGTH');
    await vi.waitFor(() =>
      expect(mockedGrowthApi.fetchGrowthReference).toHaveBeenCalledWith(
        HOUSEHOLD_ID,
        CHILD_ID,
        'LENGTH_OR_HEIGHT_FOR_AGE',
      ),
    );
  });

  describe('W-10: the child has no sex on its profile', () => {
    it('explains the missing percentiles and links to the child settings', async () => {
      mockedChildApi.fetchChild.mockResolvedValue(makeChild({ sex: null }));
      mockedGrowthApi.fetchGrowthReference.mockResolvedValue({
        indicator: 'WEIGHT_FOR_AGE',
        sex: null,
        available: false,
        reason: 'CHILD_SEX_NOT_SET',
      });

      renderPage();

      expect(await screen.findByText("Percentiles need the child's sex.")).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Add it in the child profile' })).toHaveAttribute(
        'href',
        `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/settings`,
      );
    });

    it('still renders the trend itself', async () => {
      mockedChildApi.fetchChild.mockResolvedValue(makeChild({ sex: null }));

      renderPage();

      expect(await screen.findByTestId('growth-chart')).toBeInTheDocument();
    });
  });

  describe('W-11: a measurement outside the WHO reference range', () => {
    it('shows the no-reference hint', async () => {
      mockedGrowthApi.listGrowthMeasurements.mockResolvedValue([
        makeMeasurement({
          percentiles: {
            weight: { status: 'UNAVAILABLE', reason: 'AGE_ABOVE_REFERENCE_RANGE' },
            length: null,
            headCircumference: null,
          },
        }),
      ]);

      renderPage();

      expect(
        await screen.findByText(/No WHO reference curves exist for this range/i),
      ).toBeInTheDocument();
    });

    it('shows the same hint for a measurement below the range', async () => {
      mockedGrowthApi.listGrowthMeasurements.mockResolvedValue([
        makeMeasurement({
          percentiles: {
            weight: { status: 'UNAVAILABLE', reason: 'AGE_BELOW_REFERENCE_RANGE' },
            length: null,
            headCircumference: null,
          },
        }),
      ]);

      renderPage();

      expect(
        await screen.findByText(/No WHO reference curves exist for this range/i),
      ).toBeInTheDocument();
    });

    it('shows no hint when everything is inside the range', async () => {
      renderPage();
      await screen.findByTestId('growth-chart');

      expect(
        screen.queryByText(/No WHO reference curves exist for this range/i),
      ).not.toBeInTheDocument();
    });
  });

  it('offers a link to record a new measurement', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: 'Add measurement' })).toHaveAttribute(
      'href',
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/growth/new`,
    );
  });

  it('renders the measurement list alongside the chart', async () => {
    renderPage();

    expect(await screen.findByText('Weight: 6.4 kg')).toBeInTheDocument();
  });

  it('shows the empty-chart copy when nothing has been recorded for the measure', async () => {
    mockedGrowthApi.listGrowthMeasurements.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('No entries for this measure yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('growth-chart')).not.toBeInTheDocument();
  });

  it('shows a skeleton while the child is loading', () => {
    mockedChildApi.fetchChild.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(document.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it('shows an error when the child cannot be loaded', async () => {
    mockedChildApi.fetchChild.mockRejectedValue(new Error('boom'));

    renderPage();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('reports a failed measurement query instead of rendering an empty list', async () => {
    mockedGrowthApi.listGrowthMeasurements.mockRejectedValue(new Error('offline'));

    renderPage();

    expect(
      await screen.findByText('The measurements could not be loaded. Please try again.'),
    ).toBeInTheDocument();
  });
});
