import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { EventType } from '../api/event-api';
import { TimeSinceBadgeCard } from './TimeSinceBadgeCard';

describe('TimeSinceBadgeCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['FEEDING', 'Last feeding', 'bg-feeding-bottle'],
    ['SLEEP', 'Last sleep', 'bg-sleep'],
    ['DIAPER', 'Last diaper change', 'bg-diaper-pee'],
  ] as [EventType, string, string][])(
    "renders the %s title and an elapsed-time badge in that type's color",
    (eventType, expectedTitle, expectedColorClass) => {
      render(<TimeSinceBadgeCard eventType={eventType} lastEventAt="2026-01-01T10:40:00.000Z" />);

      expect(screen.getByText(expectedTitle)).toBeInTheDocument();
      expect(screen.getByText('1h ago')).toHaveClass(expectedColorClass);
    },
  );

  it('renders the no-entries copy instead of a badge when lastEventAt is null', () => {
    render(<TimeSinceBadgeCard eventType="FEEDING" lastEventAt={null} />);

    expect(screen.getByText('Last feeding')).toBeInTheDocument();
    expect(screen.getByText('No entries yet')).toBeInTheDocument();
    expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('advances the badge figure on tick alone, with no new data arriving', () => {
    render(<TimeSinceBadgeCard eventType="SLEEP" lastEventAt="2026-01-01T11:45:00.000Z" />);
    expect(screen.getByText('15 min ago')).toBeInTheDocument();

    act(() => {
      vi.setSystemTime(new Date('2026-01-01T12:20:00.000Z'));
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByText('35 min ago')).toBeInTheDocument();
  });
});
