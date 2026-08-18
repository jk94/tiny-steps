import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { FeedingQuickEntry } from './FeedingQuickEntry';
import * as feedingApi from '../api/feeding-api';
import * as useAuthModule from '../auth/useAuth';
import { ApiError } from '../api/http-client';
import { queryClient } from '../lib/query-client';

vi.mock('../api/feeding-api');
vi.mock('../auth/useAuth');

const mockedFeedingApi = vi.mocked(feedingApi);
const mockedUseAuth = vi.mocked(useAuthModule.useAuth);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const USER_ID = 'u1';

function mockAuthUser() {
  mockedUseAuth.mockReturnValue({
    user: {
      id: USER_ID,
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
}

const summary: feedingApi.FeedingEventSummary = {
  id: 'e1',
  childId: CHILD_ID,
  userId: 'u1',
  type: 'FEEDING',
  feedingType: 'BREAST',
  occurredAt: '2026-01-01T10:00:00.000Z',
  startedAt: '2026-01-01T10:00:00.000Z',
  endedAt: null,
  durationSeconds: null,
  side: 'LEFT',
  amountMl: null,
  note: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
};

function renderQuickEntry() {
  return render(
    <QueryClientProvider client={queryClient}>
      <FeedingQuickEntry householdId={HOUSEHOLD_ID} childId={CHILD_ID} />
    </QueryClientProvider>,
  );
}

describe('FeedingQuickEntry', () => {
  beforeEach(() => {
    queryClient.clear();
    mockAuthUser();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('creates a BREAST/LEFT entry with a single tap', async () => {
    mockedFeedingApi.createFeedingEventOptimistic.mockResolvedValueOnce(summary);
    const user = userEvent.setup();
    renderQuickEntry();

    await user.click(screen.getByRole('button', { name: 'Breastfeed left' }));

    expect(mockedFeedingApi.createFeedingEventOptimistic).toHaveBeenCalledTimes(1);
    expect(mockedFeedingApi.createFeedingEventOptimistic).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      USER_ID,
      {
        feedingType: 'BREAST',
        side: 'LEFT',
      },
    );
  });

  it('creates a BREAST/RIGHT entry with a single tap', async () => {
    mockedFeedingApi.createFeedingEventOptimistic.mockResolvedValueOnce(summary);
    const user = userEvent.setup();
    renderQuickEntry();

    await user.click(screen.getByRole('button', { name: 'Breastfeed right' }));

    expect(mockedFeedingApi.createFeedingEventOptimistic).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      USER_ID,
      {
        feedingType: 'BREAST',
        side: 'RIGHT',
      },
    );
  });

  it('creates a SOLID entry with a single tap', async () => {
    mockedFeedingApi.createFeedingEventOptimistic.mockResolvedValueOnce(summary);
    const user = userEvent.setup();
    renderQuickEntry();

    await user.click(screen.getByRole('button', { name: 'Solid food' }));

    expect(mockedFeedingApi.createFeedingEventOptimistic).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      USER_ID,
      {
        feedingType: 'SOLID',
      },
    );
  });

  it('does not call create on the first bottle tap, only reveals ml presets', async () => {
    const user = userEvent.setup();
    renderQuickEntry();

    await user.click(screen.getByRole('button', { name: 'Bottle' }));

    expect(mockedFeedingApi.createFeedingEventOptimistic).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '90 ml' })).toBeInTheDocument();
  });

  it('creates a BOTTLE entry with the chosen amount on the second tap', async () => {
    mockedFeedingApi.createFeedingEventOptimistic.mockResolvedValueOnce(summary);
    const user = userEvent.setup();
    renderQuickEntry();

    await user.click(screen.getByRole('button', { name: 'Bottle' }));
    await user.click(screen.getByRole('button', { name: '90 ml' }));

    expect(mockedFeedingApi.createFeedingEventOptimistic).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      USER_ID,
      {
        feedingType: 'BOTTLE',
        amountMl: 90,
      },
    );
  });

  it('invalidates the feeding-events queries on success', async () => {
    mockedFeedingApi.createFeedingEventOptimistic.mockResolvedValueOnce(summary);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();
    renderQuickEntry();

    await user.click(screen.getByRole('button', { name: 'Solid food' }));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['households', HOUSEHOLD_ID, 'children', CHILD_ID, 'feeding-events'],
    });
  });

  it('shows a mapped error message when create fails with a 409 (timer conflict)', async () => {
    mockedFeedingApi.createFeedingEventOptimistic.mockRejectedValueOnce(new ApiError(409, {}));
    const user = userEvent.setup();
    renderQuickEntry();

    await user.click(screen.getByRole('button', { name: 'Breastfeed left' }));

    expect(
      await screen.findByText('A breastfeeding timer is already running for this child.'),
    ).toBeInTheDocument();
  });
});
