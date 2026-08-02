import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { DiaperQuickEntry } from './DiaperQuickEntry';
import * as diaperApi from '../api/diaper-api';
import { ApiError } from '../api/http-client';
import { queryClient } from '../lib/query-client';

vi.mock('../api/diaper-api');

const mockedDiaperApi = vi.mocked(diaperApi);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

const summary: diaperApi.DiaperEventSummary = {
  id: 'e1',
  childId: CHILD_ID,
  userId: 'u1',
  type: 'DIAPER',
  diaperType: 'PEE',
  occurredAt: '2026-01-01T10:00:00.000Z',
  note: null,
  createdAt: '2026-01-01T10:00:00.000Z',
};

function renderQuickEntry() {
  return render(
    <QueryClientProvider client={queryClient}>
      <DiaperQuickEntry householdId={HOUSEHOLD_ID} childId={CHILD_ID} />
    </QueryClientProvider>,
  );
}

describe('DiaperQuickEntry', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('creates a PEE entry with a single tap', async () => {
    mockedDiaperApi.createDiaperEvent.mockResolvedValueOnce(summary);
    const user = userEvent.setup();
    renderQuickEntry();

    await user.click(screen.getByRole('button', { name: 'Pee' }));

    expect(mockedDiaperApi.createDiaperEvent).toHaveBeenCalledTimes(1);
    expect(mockedDiaperApi.createDiaperEvent).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, {
      diaperType: 'PEE',
    });
  });

  it('creates a STOOL entry with a single tap', async () => {
    mockedDiaperApi.createDiaperEvent.mockResolvedValueOnce(summary);
    const user = userEvent.setup();
    renderQuickEntry();

    await user.click(screen.getByRole('button', { name: 'Stool' }));

    expect(mockedDiaperApi.createDiaperEvent).toHaveBeenCalledTimes(1);
    expect(mockedDiaperApi.createDiaperEvent).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, {
      diaperType: 'STOOL',
    });
  });

  it('creates a BOTH entry with a single tap', async () => {
    mockedDiaperApi.createDiaperEvent.mockResolvedValueOnce(summary);
    const user = userEvent.setup();
    renderQuickEntry();

    await user.click(screen.getByRole('button', { name: 'Both' }));

    expect(mockedDiaperApi.createDiaperEvent).toHaveBeenCalledTimes(1);
    expect(mockedDiaperApi.createDiaperEvent).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, {
      diaperType: 'BOTH',
    });
  });

  it('invalidates the diaper-events queries on success', async () => {
    mockedDiaperApi.createDiaperEvent.mockResolvedValueOnce(summary);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();
    renderQuickEntry();

    await user.click(screen.getByRole('button', { name: 'Pee' }));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['households', HOUSEHOLD_ID, 'children', CHILD_ID, 'diaper-events'],
    });
  });

  it('shows a mapped error message when create fails', async () => {
    mockedDiaperApi.createDiaperEvent.mockRejectedValueOnce(new ApiError(400, {}));
    const user = userEvent.setup();
    renderQuickEntry();

    await user.click(screen.getByRole('button', { name: 'Pee' }));

    expect(
      await screen.findByText("Couldn't save your changes. Please check the entered values."),
    ).toBeInTheDocument();
  });
});
