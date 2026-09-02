import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { MilestoneEdit } from './MilestoneEdit';
import type { MilestoneSummary } from '../api/milestone-api';
import * as childApi from '../api/child-api';
import * as milestoneApi from '../api/milestone-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/child-api', async () => {
  const actual = await vi.importActual<typeof childApi>('../api/child-api');
  return { ...actual, fetchChild: vi.fn() };
});
vi.mock('../api/milestone-api', async () => {
  const actual = await vi.importActual<typeof milestoneApi>('../api/milestone-api');
  return {
    ...actual,
    fetchMilestone: vi.fn(),
    updateMilestone: vi.fn(),
    deleteMilestonePhoto: vi.fn(),
    uploadMilestonePhoto: vi.fn(),
  };
});

const mockedChildApi = vi.mocked(childApi);
const mockedMilestoneApi = vi.mocked(milestoneApi);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const MILESTONE_ID = 'm1';
const BASE_PATH = `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/milestones`;

function makeMilestone(overrides: Partial<MilestoneSummary> = {}): MilestoneSummary {
  return {
    id: MILESTONE_ID,
    childId: CHILD_ID,
    userId: 'u1',
    templateKey: 'FIRST_STEPS',
    title: 'First steps',
    category: 'MOTOR',
    achievedAt: '2025-08-20T00:00:00.000Z',
    ageInDaysAtMilestone: 212,
    ageInMonthsAtMilestone: 7,
    note: null,
    createdAt: '2025-08-21T09:00:00.000Z',
    updatedAt: '2025-08-21T09:00:00.000Z',
    photos: [],
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`${BASE_PATH}/${MILESTONE_ID}/edit`]}>
        <Routes>
          <Route
            path="/households/:householdId/children/:childId/milestones/:milestoneId/edit"
            element={
              <>
                <MilestoneEdit />
                <LocationProbe />
              </>
            }
          />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MilestoneEdit', () => {
  beforeEach(() => {
    queryClient.clear();
    mockedChildApi.fetchChild.mockResolvedValue({
      id: CHILD_ID,
      householdId: HOUSEHOLD_ID,
      name: 'Mia',
      birthDate: '2025-01-20T00:00:00.000Z',
      hasPhoto: false,
      sex: null,
      createdAt: '2025-01-21T00:00:00.000Z',
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('never sends the title or category of a template entry', async () => {
    const user = userEvent.setup();
    mockedMilestoneApi.fetchMilestone.mockResolvedValue(makeMilestone());
    mockedMilestoneApi.updateMilestone.mockResolvedValue(makeMilestone());

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(mockedMilestoneApi.updateMilestone).toHaveBeenCalled());
    const payload = mockedMilestoneApi.updateMilestone.mock.calls[0][3];
    // Both are owned by the catalog; the server rejects them outright.
    expect(payload).not.toHaveProperty('title');
    expect(payload).not.toHaveProperty('category');
    expect(payload).toMatchObject({ achievedAt: '2025-08-20' });
  });

  it('sends the edited title of a free entry', async () => {
    const user = userEvent.setup();
    mockedMilestoneApi.fetchMilestone.mockResolvedValue(
      makeMilestone({ templateKey: null, category: null, title: 'First trip by train' }),
    );
    mockedMilestoneApi.updateMilestone.mockResolvedValue(makeMilestone());

    renderPage();

    const titleInput = await screen.findByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'First train ride');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(mockedMilestoneApi.updateMilestone).toHaveBeenCalled());
    expect(mockedMilestoneApi.updateMilestone.mock.calls[0][3]).toMatchObject({
      title: 'First train ride',
    });
  });

  it('deletes a single stored photo after confirmation (M-9)', async () => {
    const user = userEvent.setup();
    mockedMilestoneApi.fetchMilestone.mockResolvedValue(
      makeMilestone({ photos: [{ id: 'p1', sortIndex: 0, mimeType: 'image/png' }] }),
    );
    mockedMilestoneApi.deleteMilestonePhoto.mockResolvedValue(undefined);

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Delete photo' }));
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));

    await waitFor(() => {
      expect(mockedMilestoneApi.deleteMilestonePhoto).toHaveBeenCalledWith(
        HOUSEHOLD_ID,
        CHILD_ID,
        MILESTONE_ID,
        'p1',
      );
    });
  });

  it('stays on the page when a photo upload fails, rather than claiming success (M-15)', async () => {
    const user = userEvent.setup();
    mockedMilestoneApi.fetchMilestone.mockResolvedValue(
      makeMilestone({ templateKey: null, category: null }),
    );
    mockedMilestoneApi.updateMilestone.mockResolvedValue(makeMilestone());
    mockedMilestoneApi.uploadMilestonePhoto.mockRejectedValue(new Error('offline'));

    renderPage();

    await user.upload(await screen.findByLabelText('Choose photos'), [
      new File(['x'], 'a.png', { type: 'image/png' }),
    ]);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('The photo could not be uploaded. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(`${BASE_PATH}/${MILESTONE_ID}/edit`);
  });

  it('surfaces a failed load instead of an empty form', async () => {
    mockedMilestoneApi.fetchMilestone.mockRejectedValue(new Error('offline'));

    renderPage();

    expect(
      await screen.findByText('Something went wrong. Please try again later.'),
    ).toBeInTheDocument();
  });
});
