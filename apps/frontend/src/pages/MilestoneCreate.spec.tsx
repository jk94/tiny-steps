import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { MilestoneCreate } from './MilestoneCreate';
import { ApiError } from '../api/http-client';
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
  return { ...actual, createMilestone: vi.fn(), uploadMilestonePhoto: vi.fn() };
});

const mockedChildApi = vi.mocked(childApi);
const mockedMilestoneApi = vi.mocked(milestoneApi);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const BASE_PATH = `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/milestones`;

const created: MilestoneSummary = {
  id: 'm1',
  childId: CHILD_ID,
  userId: 'u1',
  templateKey: null,
  title: 'First trip by train',
  category: null,
  achievedAt: '2025-08-20T00:00:00.000Z',
  ageInDaysAtMilestone: 212,
  ageInMonthsAtMilestone: 7,
  note: null,
  createdAt: '2025-08-21T09:00:00.000Z',
  updatedAt: '2025-08-21T09:00:00.000Z',
  photos: [],
};

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}

function renderPage(initialEntry = `${BASE_PATH}/new`) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/households/:householdId/children/:childId/milestones/new"
            element={
              <>
                <MilestoneCreate />
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

function imageFile(name: string): File {
  return new File(['x'], name, { type: 'image/png' });
}

describe('MilestoneCreate', () => {
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

  it('creates the milestone and returns to the timeline', async () => {
    const user = userEvent.setup();
    mockedMilestoneApi.createMilestone.mockResolvedValue(created);

    renderPage();

    await user.type(await screen.findByLabelText('Title'), 'First trip by train');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(BASE_PATH);
    });
    expect(mockedMilestoneApi.createMilestone).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      expect.objectContaining({ title: 'First trip by train', templateKey: undefined }),
    );
  });

  it('prefills the template from the catalog link (M-12)', async () => {
    renderPage(`${BASE_PATH}/new?templateKey=FIRST_STEPS`);

    // Rendered read-only from the catalog translation, not as a text field.
    expect(
      await screen.findByText('The title comes from the template and cannot be changed.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  });

  it('omits the category for a template entry — the server derives it', async () => {
    const user = userEvent.setup();
    mockedMilestoneApi.createMilestone.mockResolvedValue(created);

    renderPage(`${BASE_PATH}/new?templateKey=FIRST_STEPS`);

    await user.click(await screen.findByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockedMilestoneApi.createMilestone).toHaveBeenCalled());
    expect(mockedMilestoneApi.createMilestone.mock.calls[0][2]).toMatchObject({
      templateKey: 'FIRST_STEPS',
      category: undefined,
    });
  });

  it('keeps the user on the form when the save fails, faking no success (M-15)', async () => {
    const user = userEvent.setup();
    mockedMilestoneApi.createMilestone.mockRejectedValue(
      new ApiError(409, { code: 'MILESTONE_TEMPLATE_ALREADY_RECORDED' }),
    );

    renderPage();

    await user.type(await screen.findByLabelText('Title'), 'Anything');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('This milestone has already been recorded for this child.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(`${BASE_PATH}/new`);
  });

  it('uploads the queued photos after the milestone exists', async () => {
    const user = userEvent.setup();
    mockedMilestoneApi.createMilestone.mockResolvedValue(created);
    mockedMilestoneApi.uploadMilestonePhoto.mockResolvedValue({
      id: 'p1',
      sortIndex: 0,
      mimeType: 'image/png',
    });

    renderPage();

    await user.type(await screen.findByLabelText('Title'), 'With a photo');
    await user.upload(screen.getByLabelText('Choose photos'), [imageFile('a.png')]);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockedMilestoneApi.uploadMilestonePhoto).toHaveBeenCalledWith(
        HOUSEHOLD_ID,
        CHILD_ID,
        created.id,
        expect.any(File),
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(BASE_PATH);
    });
  });

  it('moves to the edit page instead of the timeline when a photo upload fails (M-15)', async () => {
    const user = userEvent.setup();
    mockedMilestoneApi.createMilestone.mockResolvedValue(created);
    mockedMilestoneApi.uploadMilestonePhoto.mockRejectedValue(new Error('offline'));

    renderPage();

    await user.type(await screen.findByLabelText('Title'), 'With a photo');
    await user.upload(screen.getByLabelText('Choose photos'), [imageFile('a.png')]);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // The milestone exists, so going back would strand it — the user lands on
    // its edit page rather than on a screen implying everything worked.
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(`${BASE_PATH}/${created.id}/edit`);
    });
  });
});
