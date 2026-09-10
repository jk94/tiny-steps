import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
import type { HouseholdRole } from '../lib/householdPermissions';
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
/** The signed-in user — also the default author of `makeMeasurement()`. */
const CURRENT_USER_ID = 'u1';
/** Another household member, so a measurement can be made "foreign". */
const OTHER_USER_ID = 'u2';

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

/** Resolves the household query `useHouseholdRole` reads the page's role from. */
function givenHouseholdRole(role: HouseholdRole = 'OWNER') {
  mockedHouseholdApi.fetchHousehold.mockResolvedValue({
    id: HOUSEHOLD_ID,
    name: 'Team Müller',
    role,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
}

/** Signs a user in, so the ownership half of the edit check has an id to compare. */
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

describe('GrowthHome', () => {
  beforeEach(() => {
    queryClient.clear();
    givenSignedInUser();
    givenHouseholdRole();
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

    it('scopes the hint to the active measure, not any out-of-range slot', async () => {
      const user = userEvent.setup();
      // Head circumference is beyond the reference range; weight and length
      // are fully computed — a common pattern once a toddler stops having its
      // head measured.
      mockedGrowthApi.listGrowthMeasurements.mockResolvedValue([
        makeMeasurement({
          percentiles: {
            weight: { status: 'COMPUTED', zScore: 0.1, percentile: 54 },
            length: { status: 'COMPUTED', zScore: -0.2, percentile: 42 },
            headCircumference: { status: 'UNAVAILABLE', reason: 'AGE_ABOVE_REFERENCE_RANGE' },
          },
        }),
      ]);

      renderPage();
      await screen.findByTestId('growth-chart');

      // The default WEIGHT tab has no out-of-range weight data, so no hint.
      expect(
        screen.queryByText(/No WHO reference curves exist for this range/i),
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole('tab', { name: 'Head circumference' }));

      expect(
        await screen.findByText(/No WHO reference curves exist for this range/i),
      ).toBeInTheDocument();
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

  describe('role-dependent actions', () => {
    it.each(['OWNER', 'CO_PARENT', 'CAREGIVER'] as const)(
      'offers the "add measurement" link to a %s',
      async (role) => {
        givenHouseholdRole(role);

        renderPage();

        expect(await screen.findByRole('link', { name: 'Add measurement' })).toBeInTheDocument();
      },
    );

    it('hides the "add measurement" link from an OBSERVER while keeping the trend readable', async () => {
      givenHouseholdRole('OBSERVER');

      renderPage();

      expect(await screen.findByText('Weight: 6.4 kg')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Add measurement' })).not.toBeInTheDocument();
    });

    it('drops the empty-state call to action for an OBSERVER but keeps the statement', async () => {
      givenHouseholdRole('OBSERVER');
      mockedGrowthApi.listGrowthMeasurements.mockResolvedValue([]);

      renderPage();

      expect(await screen.findByText('No measurements yet')).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'Record the first measurement' }),
      ).not.toBeInTheDocument();
    });

    // Proves the page actually threads `role` and `currentUserId` into the
    // list: with OWNER (the default above) the ownership half short-circuits,
    // so a hardcoded role or an undefined user id would go unnoticed.
    it('lets a CAREGIVER edit only their own measurement', async () => {
      givenHouseholdRole('CAREGIVER');
      mockedGrowthApi.listGrowthMeasurements.mockResolvedValue([
        makeMeasurement({ id: 'own', userId: CURRENT_USER_ID }),
        makeMeasurement({ id: 'foreign', userId: OTHER_USER_ID }),
      ]);

      renderPage();

      const editLinks = await screen.findAllByRole('link', { name: 'Edit' });
      expect(editLinks).toHaveLength(1);
      expect(editLinks[0]).toHaveAttribute(
        'href',
        `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/growth/own/edit`,
      );
      // Role-only, no ownership exception — a CAREGIVER deletes nothing.
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('renders no per-row action container at all for an OBSERVER', async () => {
      const actionContainer = 'span.items-center.gap-3';

      // Sanity-check the selector: an OWNER does get the container…
      renderPage();
      await screen.findByText('Weight: 6.4 kg');
      expect(document.querySelector(actionContainer)).not.toBeNull();

      cleanup();
      queryClient.clear();
      givenHouseholdRole('OBSERVER');

      renderPage();

      // The row itself is still there…
      expect(await screen.findByText('Weight: 6.4 kg')).toBeInTheDocument();
      // …but nothing actionable, and no empty wrapper holding the row's gap.
      expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
      expect(document.querySelector(actionContainer)).toBeNull();
    });
  });
});
