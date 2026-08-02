import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { TimeSinceCard } from './TimeSinceCard';

describe('TimeSinceCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the no-entries state (not a crash or "NaN") when lastEventAt is null', () => {
    render(<TimeSinceCard eventType="FEEDING" lastEventAt={null} />);

    expect(screen.getByText('Last feeding')).toBeInTheDocument();
    expect(screen.getByText('No entries yet')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('shows minutes-ago for a recent event, and the right title per event type', () => {
    render(<TimeSinceCard eventType="SLEEP" lastEventAt="2026-01-01T11:45:00.000Z" />);

    expect(screen.getByText('Last sleep')).toBeInTheDocument();
    expect(screen.getByText('15 min ago')).toBeInTheDocument();
  });

  it('shows hours-ago once the event is over an hour old', () => {
    render(<TimeSinceCard eventType="DIAPER" lastEventAt="2026-01-01T09:00:00.000Z" />);

    expect(screen.getByText('Last diaper change')).toBeInTheDocument();
    expect(screen.getByText('3h ago')).toBeInTheDocument();
  });

  it('advances the displayed figure on tick alone, with no new data arriving', () => {
    render(<TimeSinceCard eventType="FEEDING" lastEventAt="2026-01-01T11:45:00.000Z" />);
    expect(screen.getByText('15 min ago')).toBeInTheDocument();

    act(() => {
      vi.setSystemTime(new Date('2026-01-01T12:20:00.000Z'));
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByText('35 min ago')).toBeInTheDocument();
  });
});
