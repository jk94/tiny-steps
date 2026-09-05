import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { MilestoneEdit } from './MilestoneEdit';
import type { MilestoneSummary } from '../api/milestone-api';
import * as childApi from '../api/child-api';
import * as milestoneApi from '../api/milestone-api';
import * as householdApi from '../api/household-api';
import type { HouseholdRole } from '../lib/householdPermissions';
import { queryClient } from '../lib/query-client';
import { clearPhotoRetryQueue, stashPhotoRetryQueue } from '../milestone/photoRetryHandoff';

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
vi.mock('../api/household-api');

const mockedChildApi = vi.mocked(childApi);
const mockedMilestoneApi = vi.mocked(milestoneApi);
const mockedHouseholdApi = vi.mocked(householdApi);

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

/**
 * Resolves the household query `useHouseholdRole` shares with `HouseholdDetail`.
 * Defaults to `OWNER` — the role the pre-existing photo-delete tests assume.
 */
function givenHouseholdRole(role: HouseholdRole = 'OWNER') {
  mockedHouseholdApi.fetchHousehold.mockResolvedValue({
    id: HOUSEHOLD_ID,
    name: 'Team Müller',
    role,
    createdAt: '2025-01-01T00:00:00.000Z',
  });
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
    givenHouseholdRole();
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
    clearPhotoRetryQueue();
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

  it('retries only the handed-over failed file, never re-uploading the stored one (M-15)', async () => {
    const user = userEvent.setup();
    // The milestone already carries the photo that uploaded on the create page.
    mockedMilestoneApi.fetchMilestone.mockResolvedValue(
      makeMilestone({
        templateKey: null,
        category: null,
        photos: [{ id: 'p1', sortIndex: 0, mimeType: 'image/png' }],
      }),
    );
    mockedMilestoneApi.updateMilestone.mockResolvedValue(makeMilestone());
    mockedMilestoneApi.uploadMilestonePhoto.mockResolvedValue({
      id: 'p2',
      sortIndex: 1,
      mimeType: 'image/png',
    });

    stashPhotoRetryQueue(MILESTONE_ID, [
      { id: '1', file: new File(['x'], 'ok.png', { type: 'image/png' }), status: 'done' },
      {
        id: '2',
        file: new File(['x'], 'bad.png', { type: 'image/png' }),
        status: 'pending',
        errorKey: 'milestone.errors.photoUploadError',
      },
    ]);

    renderPage();

    // Only the still-failing file is listed for retry; the succeeded one is not.
    expect(await screen.findByText('bad.png')).toBeInTheDocument();
    expect(screen.queryByText('ok.png')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(mockedMilestoneApi.uploadMilestonePhoto).toHaveBeenCalledTimes(1);
    });
    // The retry fully succeeded, so it returns to the timeline (not the edit page).
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(BASE_PATH);
    });
  });

  it('surfaces a failed load instead of an empty form', async () => {
    mockedMilestoneApi.fetchMilestone.mockRejectedValue(new Error('offline'));

    renderPage();

    expect(
      await screen.findByText('Something went wrong. Please try again later.'),
    ).toBeInTheDocument();
  });

  describe('role-dependent photo deletion', () => {
    const withPhoto = () =>
      mockedMilestoneApi.fetchMilestone.mockResolvedValue(
        makeMilestone({ photos: [{ id: 'p1', sortIndex: 0, mimeType: 'image/png' }] }),
      );

    it.each(['OWNER', 'CO_PARENT'] as const)(
      'offers a %s the photo delete action',
      async (role) => {
        givenHouseholdRole(role);
        withPhoto();

        renderPage();

        expect(await screen.findByRole('button', { name: 'Delete photo' })).toBeInTheDocument();
      },
    );

    it.each(['CAREGIVER', 'OBSERVER'] as const)(
      'hides the photo delete action from a %s, since the endpoint has no ownership exception',
      async (role) => {
        givenHouseholdRole(role);
        withPhoto();

        renderPage();

        // The form still loads — only the delete affordance is withheld.
        await screen.findByRole('button', { name: 'Save changes' });
        await waitFor(() => {
          expect(screen.queryByRole('button', { name: 'Delete photo' })).not.toBeInTheDocument();
        });
        expect(mockedMilestoneApi.deleteMilestonePhoto).not.toHaveBeenCalled();
      },
    );
  });
});
