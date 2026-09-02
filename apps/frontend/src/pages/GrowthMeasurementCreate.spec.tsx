import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { GrowthMeasurementCreate } from './GrowthMeasurementCreate';
import type { ChildSummary } from '../api/child-api';
import * as childApi from '../api/child-api';
import * as growthApi from '../api/growth-api';
import { queryClient } from '../lib/query-client';
import { stubPopupLayoutApis } from '../test/stubPopupLayoutApis';

stubPopupLayoutApis();

vi.mock('../api/child-api');
vi.mock('../api/growth-api', async () => {
  const actual = await vi.importActual<typeof growthApi>('../api/growth-api');
  return { ...actual, createGrowthMeasurement: vi.fn() };
});

const mockedChildApi = vi.mocked(childApi);
const mockedGrowthApi = vi.mocked(growthApi);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

const child: ChildSummary = {
  id: CHILD_ID,
  householdId: HOUSEHOLD_ID,
  name: 'Mia',
  birthDate: '2025-01-01T00:00:00.000Z',
  hasPhoto: false,
  sex: 'FEMALE',
  createdAt: '2025-01-02T00:00:00.000Z',
};

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[`/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/growth/new`]}
      >
        <Routes>
          <Route
            path="/households/:householdId/children/:childId/growth/new"
            element={<GrowthMeasurementCreate />}
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

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(await screen.findByLabelText('Measurement date'), {
    target: { value: '2025-04-01' },
  });
  fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '6.2' } });
  await user.click(screen.getByRole('button', { name: 'Save' }));
}

describe('GrowthMeasurementCreate', () => {
  beforeEach(() => {
    queryClient.clear();
    mockedChildApi.fetchChild.mockResolvedValue(child);
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('sends the converted base-unit values and returns to the growth overview', async () => {
    const user = userEvent.setup();
    mockedGrowthApi.createGrowthMeasurement.mockResolvedValue({} as never);

    renderPage();
    await fillAndSubmit(user);

    expect(mockedGrowthApi.createGrowthMeasurement).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      expect.objectContaining({ weightGrams: 6200 }),
    );
    expect(await screen.findByText('Growth overview')).toBeInTheDocument();
  });

  it('constrains the date picker to the child birth date (W-5)', async () => {
    renderPage();

    expect(await screen.findByLabelText('Measurement date')).toHaveAttribute('min', '2025-01-01');
  });

  it('keeps the user on the form and reports a failed save (W-16)', async () => {
    const user = userEvent.setup();
    mockedGrowthApi.createGrowthMeasurement.mockRejectedValue(new Error('offline'));

    renderPage();
    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The measurement could not be saved.',
    );
    expect(screen.queryByText('Growth overview')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(6.2);
  });

  it('reports a child that cannot be loaded', async () => {
    mockedChildApi.fetchChild.mockRejectedValue(new Error('boom'));

    renderPage();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
