import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { FeedingEventList } from '../components/FeedingEventList';
import { FeedingQuickEntry } from '../components/FeedingQuickEntry';
import * as httpClient from '../api/http-client';
import * as useAuthModule from '../auth/useAuth';
import { queryClient } from '../lib/query-client';

// Only the underlying HTTP call is mocked — the offline engine (IndexedDB
// buffer + merge query) and both real components run for real, so this exercises
// the roadmap's "input isn't lost" scenario end to end. `ApiError` is kept real.
vi.mock('../api/http-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/http-client')>();
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('../auth/useAuth');

const mockedApiFetch = vi.mocked(httpClient.apiFetch);
const mockedUseAuth = vi.mocked(useAuthModule.useAuth);

const BREAST_LEFT_ENTRY = 'Breastfeeding (left)';
const EMPTY_MESSAGE = 'No feeding entries recorded yet.';
const FAILED_BADGE_LABEL = "Saving failed — this entry hasn't reached the server yet";

function mockAuthUser() {
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
}

function renderFeedingScreen(householdId: string, childId: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FeedingQuickEntry householdId={householdId} childId={childId} />
        <FeedingEventList householdId={householdId} childId={childId} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('optimistic feeding entry (integration)', () => {
  beforeEach(() => {
    queryClient.clear();
    mockAuthUser();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('shows a new entry immediately, before the create request settles', async () => {
    // The list GET resolves empty; the create POST never settles, so the entry
    // can only be visible thanks to the optimistic IndexedDB buffer.
    mockedApiFetch.mockImplementation((_path, options) => {
      if (options?.method === 'POST') {
        return new Promise(() => {});
      }
      return Promise.resolve([]);
    });
    const user = userEvent.setup();
    // Distinct ids per test keep the shared fake-indexeddb store isolated.
    renderFeedingScreen('h-int-1', 'c-int-1');

    expect(await screen.findByText(EMPTY_MESSAGE)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Breastfeed left' }));

    expect(await screen.findByText(BREAST_LEFT_ENTRY)).toBeInTheDocument();
  });

  it('keeps the new entry visible even after the create request fails', async () => {
    mockedApiFetch.mockImplementation((_path, options) => {
      if (options?.method === 'POST') {
        return Promise.reject(new httpClient.ApiError(500, {}));
      }
      return Promise.resolve([]);
    });
    const user = userEvent.setup();
    renderFeedingScreen('h-int-2', 'c-int-2');

    await user.click(await screen.findByRole('button', { name: 'Breastfeed left' }));

    // The entry stays even though the request rejected — the whole point of the
    // local buffer is that the input isn't lost on a failed sync.
    expect(await screen.findByText(BREAST_LEFT_ENTRY)).toBeInTheDocument();

    // ...and it must be visibly marked as failed, so the user isn't misled into
    // thinking a not-actually-saved entry reached the server.
    expect(await screen.findByLabelText(FAILED_BADGE_LABEL)).toBeInTheDocument();
  });
});
