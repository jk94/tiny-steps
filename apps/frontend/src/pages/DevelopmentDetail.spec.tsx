import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { DevelopmentDetail } from './DevelopmentDetail';
import * as childApi from '../api/child-api';
import * as householdApi from '../api/household-api';
import * as developmentContent from '../development/developmentContent';
import type { HouseholdRole } from '../lib/householdPermissions';
import { queryClient } from '../lib/query-client';
import { fixtureDevelopmentContent } from '../test/developmentContentFixture';

vi.mock('../api/child-api');
vi.mock('../api/household-api');
vi.mock('../development/developmentContent', async () => {
  const actual = await vi.importActual<typeof developmentContent>(
    '../development/developmentContent',
  );
  return { ...actual, loadDevelopmentContent: vi.fn() };
});

const mockedChildApi = vi.mocked(childApi);
const mockedHouseholdApi = vi.mocked(householdApi);
const mockedContent = vi.mocked(developmentContent);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const BASE_PATH = `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}`;

function givenChild(birthDate: string) {
  mockedChildApi.fetchChild.mockResolvedValue({
    id: CHILD_ID,
    householdId: HOUSEHOLD_ID,
    name: 'Alex',
    birthDate: `${birthDate}T00:00:00.000Z`,
    hasPhoto: false,
    sex: null,
    createdAt: '2026-01-02T00:00:00.000Z',
  });
}

function givenRole(role: HouseholdRole) {
  mockedHouseholdApi.fetchHousehold.mockResolvedValue({
    id: HOUSEHOLD_ID,
    name: 'Team Müller',
    role,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
}

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/households/:householdId/children/:childId/development"
            element={<DevelopmentDetail />}
          />
          <Route
            path="/households/:householdId/children/:childId/development/:stageKey"
            element={<DevelopmentDetail />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DevelopmentDetail', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // Child born 2026-01-01 -> day 77 -> Lebenswoche 12.
    vi.setSystemTime(new Date(2026, 2, 19, 9, 0, 0));
    // jsdom implements no scrolling; the page resets scroll on every stage.
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    queryClient.clear();
    givenChild('2026-01-01');
    givenRole('OWNER');
    mockedContent.loadDevelopmentContent.mockResolvedValue(fixtureDevelopmentContent);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows the child's current stage without a stage key", async () => {
    renderAt(`${BASE_PATH}/development`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Title week-12' })).toBeVisible();
    expect(screen.getByText('Week 12')).toBeInTheDocument();
    expect(screen.getByText('This is where Alex is now')).toBeInTheDocument();
    expect(screen.getByText('Body week-12 one')).toBeInTheDocument();
    expect(screen.getByText('Body week-12 two')).toBeInTheDocument();
    expect(screen.getByText('Tip week-12 one')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /current stage/ })).not.toBeInTheDocument();
  });

  it('links sources out in a new tab and flags their language', async () => {
    renderAt(`${BASE_PATH}/development`);

    const source = await screen.findByRole('link', { name: /Entwicklung im 1. Lebensjahr/ });
    expect(source).toHaveAttribute(
      'href',
      'https://www.kindergesundheit-info.de/themen/entwicklung/0-12-monate/',
    );
    expect(source).toHaveAttribute('target', '_blank');
    expect(source).toHaveAttribute('rel', 'noopener noreferrer');
    // A German source in an English UI is labelled; an English one is not.
    expect(screen.getByText(/kindergesundheit-info\.de \(BIÖG\) · in German/)).toBeInTheDocument();
    expect(screen.getByText('CDC – Learn the Signs. Act Early.')).toBeInTheDocument();
  });

  it('shows a requested stage and offers a way back to the current one', async () => {
    renderAt(`${BASE_PATH}/development/month-18`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Title month-18' })).toBeVisible();
    expect(screen.getByText('Month 18 · 17 months old')).toBeInTheDocument();
    expect(screen.queryByText('This is where Alex is now')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Alex’s current stage' })).toHaveAttribute(
      'href',
      `${BASE_PATH}/development`,
    );
  });

  it('pages to the neighbouring stages, across the week/month boundary', async () => {
    renderAt(`${BASE_PATH}/development/week-52`);

    const nav = await screen.findByRole('navigation', { name: 'Browse the development calendar' });
    expect(within(nav).getByRole('link', { name: 'Previous: Week 51' })).toHaveAttribute(
      'href',
      `${BASE_PATH}/development/week-51`,
    );
    expect(within(nav).getByRole('link', { name: 'Next: Month 13' })).toHaveAttribute(
      'href',
      `${BASE_PATH}/development/month-13`,
    );
  });

  it('has no previous link on the first stage and no next link on the last', async () => {
    const { unmount } = renderAt(`${BASE_PATH}/development/week-1`);
    const firstNav = await screen.findByRole('navigation');
    expect(within(firstNav).queryByRole('link', { name: /^Previous/ })).not.toBeInTheDocument();
    unmount();

    renderAt(`${BASE_PATH}/development/month-36`);
    const lastNav = await screen.findByRole('navigation');
    expect(within(lastNav).queryByRole('link', { name: /^Next/ })).not.toBeInTheDocument();
  });

  it('offers matching milestone templates to roles that may record entries', async () => {
    renderAt(`${BASE_PATH}/development/week-6`);

    expect(await screen.findByRole('link', { name: 'First smile' })).toHaveAttribute(
      'href',
      `${BASE_PATH}/milestones/new?templateKey=FIRST_SMILE`,
    );
  });

  it('hides the milestone shortcut from read-only observers', async () => {
    givenRole('OBSERVER');
    renderAt(`${BASE_PATH}/development/week-6`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Title week-6' })).toBeVisible();
    // Let the household query settle so the role is known before asserting absence.
    await vi.waitFor(() => expect(mockedHouseholdApi.fetchHousehold).toHaveBeenCalled());
    expect(screen.queryByText('Already happened?')).not.toBeInTheDocument();
  });

  it('falls back to the last stage with a closing note past the third birthday', async () => {
    givenChild('2022-06-01');
    renderAt(`${BASE_PATH}/development`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Title month-36' })).toBeVisible();
    expect(screen.getByText(/Alex is already older than three/)).toBeInTheDocument();
  });

  it('rejects a stage key outside the calendar', async () => {
    renderAt(`${BASE_PATH}/development/week-53`);

    expect(
      await screen.findByText('This stage doesn’t exist in the development calendar.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveAttribute(
      'href',
      BASE_PATH,
    );
  });

  it('reports a content load failure instead of an empty page', async () => {
    mockedContent.loadDevelopmentContent.mockRejectedValue(new Error('chunk load failed'));
    renderAt(`${BASE_PATH}/development`);

    expect(
      await screen.findByText(/The development calendar couldn’t be loaded/),
    ).toBeInTheDocument();
  });

  it('resets the scroll position when paging', async () => {
    renderAt(`${BASE_PATH}/development/week-3`);

    await screen.findByRole('heading', { level: 1, name: 'Title week-3' });
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });
  });
});
