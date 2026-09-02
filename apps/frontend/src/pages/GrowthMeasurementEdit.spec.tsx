import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { GrowthMeasurementEdit } from './GrowthMeasurementEdit';
import type { ChildSummary } from '../api/child-api';
import type { GrowthMeasurementSummary } from '../api/growth-api';
import * as childApi from '../api/child-api';
import * as growthApi from '../api/growth-api';
import { queryClient } from '../lib/query-client';
import { stubPopupLayoutApis } from '../test/stubPopupLayoutApis';

stubPopupLayoutApis();

vi.mock('../api/child-api');
vi.mock('../api/growth-api', async () => {
  const actual = await vi.importActual<typeof growthApi>('../api/growth-api');
  return { ...actual, fetchGrowthMeasurement: vi.fn(), updateGrowthMeasurement: vi.fn() };
});

const mockedChildApi = vi.mocked(childApi);
const mockedGrowthApi = vi.mocked(growthApi);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const MEASUREMENT_ID = 'm1';

const child: ChildSummary = {
  id: CHILD_ID,
  householdId: HOUSEHOLD_ID,
  name: 'Mia',
  birthDate: '2025-01-01T00:00:00.000Z',
  hasPhoto: false,
  sex: 'FEMALE',
  createdAt: '2025-01-02T00:00:00.000Z',
};

function makeMeasurement(
  overrides: Partial<GrowthMeasurementSummary> = {},
): GrowthMeasurementSummary {
  return {
    id: MEASUREMENT_ID,
    childId: CHILD_ID,
    userId: 'u1',
    measuredAt: '2025-04-01T12:00:00.000Z',
    ageInDaysAtMeasurement: 90,
    weightGrams: 6400,
    lengthMillimeters: 615,
    headCircumferenceMillimeters: null,
    lengthMeasurementPosition: 'STANDING',
    effectiveLengthMeasurementPosition: 'STANDING',
    lengthOrHeightReferenceUsed: 'HEIGHT',
    note: 'U4',
    createdAt: '2025-04-01T12:00:00.000Z',
    updatedAt: '2025-04-01T12:00:00.000Z',
    ...overrides,
    percentiles: {
      weight: { status: 'COMPUTED', zScore: 0.1, percentile: 54 },
      length: { status: 'COMPUTED', zScore: -0.2, percentile: 42 },
      headCircumference: null,
    },
  };
}

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[
          `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/growth/${MEASUREMENT_ID}/edit`,
        ]}
      >
        <Routes>
          <Route
            path="/households/:householdId/children/:childId/growth/:measurementId/edit"
            element={<GrowthMeasurementEdit />}
          />
          <Route
            path="/households/:householdId/children/:childId/growth"
            element={<p>Growth overview</p>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GrowthMeasurementEdit', () => {
  beforeEach(() => {
    queryClient.clear();
    mockedChildApi.fetchChild.mockResolvedValue(child);
    mockedGrowthApi.fetchGrowthMeasurement.mockResolvedValue(makeMeasurement());
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('pre-fills the stored values in their display units', async () => {
    renderPage();

    expect(await screen.findByLabelText('Weight (kg)')).toHaveValue(6.4);
    expect(screen.getByLabelText('Length/height (cm)')).toHaveValue(61.5);
    expect(screen.getByLabelText('Measurement date')).toHaveValue('2025-04-01');
  });

  it('pre-selects the stored override, not the effective method (W-18)', async () => {
    renderPage();

    expect(
      await screen.findByRole('combobox', { name: 'Length/height measurement method' }),
    ).toHaveTextContent('Measured standing');
  });

  it('leaves the method on automatic when no override was stored', async () => {
    mockedGrowthApi.fetchGrowthMeasurement.mockResolvedValue(
      makeMeasurement({ lengthMeasurementPosition: null }),
    );

    renderPage();

    expect(
      await screen.findByRole('combobox', { name: 'Length/height measurement method' }),
    ).toHaveTextContent('Automatic (by age)');
  });

  it('PATCHes the changed value and returns to the overview', async () => {
    const user = userEvent.setup();
    mockedGrowthApi.updateGrowthMeasurement.mockResolvedValue(makeMeasurement());

    renderPage();
    fireEvent.change(await screen.findByLabelText('Weight (kg)'), { target: { value: '6.6' } });
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(mockedGrowthApi.updateGrowthMeasurement).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      MEASUREMENT_ID,
      expect.objectContaining({ weightGrams: 6600 }),
    );
    expect(await screen.findByText('Growth overview')).toBeInTheDocument();
  });

  it('clears an emptied value with an explicit null', async () => {
    const user = userEvent.setup();
    mockedGrowthApi.updateGrowthMeasurement.mockResolvedValue(makeMeasurement());

    renderPage();
    fireEvent.change(await screen.findByLabelText('Length/height (cm)'), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(mockedGrowthApi.updateGrowthMeasurement).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      MEASUREMENT_ID,
      expect.objectContaining({ lengthMillimeters: null }),
    );
  });

  it('keeps the user on the form and reports a failed save (W-16)', async () => {
    const user = userEvent.setup();
    mockedGrowthApi.updateGrowthMeasurement.mockRejectedValue(new Error('offline'));

    renderPage();
    fireEvent.change(await screen.findByLabelText('Weight (kg)'), { target: { value: '6.6' } });
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The measurement could not be saved.',
    );
    expect(screen.queryByText('Growth overview')).not.toBeInTheDocument();
  });

  it('reports a measurement that cannot be loaded', async () => {
    mockedGrowthApi.fetchGrowthMeasurement.mockRejectedValue(new Error('gone'));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The measurements could not be loaded.',
    );
  });
});
