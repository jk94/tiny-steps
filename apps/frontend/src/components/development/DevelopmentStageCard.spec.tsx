import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { DevelopmentStageCard } from './DevelopmentStageCard';
import * as developmentContent from '../../development/developmentContent';
import i18n from '../../i18n';
import { queryClient } from '../../lib/query-client';
import { fixtureDevelopmentContent } from '../../test/developmentContentFixture';

vi.mock('../../development/developmentContent', async () => {
  const actual = await vi.importActual<typeof developmentContent>(
    '../../development/developmentContent',
  );
  return { ...actual, loadDevelopmentContent: vi.fn() };
});

const mockedContent = vi.mocked(developmentContent);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const DEVELOPMENT_PATH = `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/development`;

function renderCard(birthDate: string, now: Date) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DevelopmentStageCard
          householdId={HOUSEHOLD_ID}
          childId={CHILD_ID}
          birthDate={birthDate}
          now={now}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DevelopmentStageCard', () => {
  beforeEach(() => {
    queryClient.clear();
    mockedContent.loadDevelopmentContent.mockResolvedValue(fixtureDevelopmentContent);
  });

  it("shows the current week's title and teaser as one link to the detail screen", async () => {
    // Born 2026-01-01, viewed on day 77 -> Lebenswoche 12.
    renderCard('2026-01-01', new Date(2026, 2, 19, 9, 0));

    const link = await screen.findByRole('link', { name: /Title week-12/ });
    expect(link).toHaveAttribute('href', DEVELOPMENT_PATH);
    expect(link).toHaveTextContent('Teaser week-12');
    expect(link).toHaveTextContent('Week 12');
    expect(link).toHaveTextContent('Read more');
  });

  it('switches to months after the first birthday', async () => {
    renderCard('2025-01-01', new Date(2026, 6, 15, 9, 0));

    expect(await screen.findByText('Title month-19')).toBeInTheDocument();
    expect(screen.getByText('Month 19')).toBeInTheDocument();
  });

  it('shows a closing note with a browse link from the third birthday on', () => {
    renderCard('2023-01-01', new Date(2026, 0, 1, 9, 0));

    expect(screen.getByText('The first three years are done')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse the calendar' })).toHaveAttribute(
      'href',
      DEVELOPMENT_PATH,
    );
  });

  it('renders nothing when the content cannot be loaded', async () => {
    mockedContent.loadDevelopmentContent.mockRejectedValue(new Error('chunk load failed'));
    const { container } = renderCard('2026-01-01', new Date(2026, 2, 19, 9, 0));

    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('loads the calendar of the active UI language', async () => {
    await i18n.changeLanguage('de');
    renderCard('2026-01-01', new Date(2026, 2, 19, 9, 0));

    expect(await screen.findByText('Lebenswoche 12')).toBeInTheDocument();
    expect(mockedContent.loadDevelopmentContent).toHaveBeenCalledWith('de');
  });
});
