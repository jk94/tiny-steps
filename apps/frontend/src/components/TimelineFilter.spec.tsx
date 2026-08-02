import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EventType } from '../api/event-api';
import { TimelineFilter } from './TimelineFilter';

const ALL_EVENT_TYPES: EventType[] = ['FEEDING', 'SLEEP', 'DIAPER'];

describe('TimelineFilter', () => {
  it('renders all three type checkboxes, checked when all are enabled', () => {
    render(<TimelineFilter enabledTypes={new Set(ALL_EVENT_TYPES)} onChange={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: 'Feeding' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Sleep' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Diaper' })).toBeChecked();
  });

  it('renders a checkbox unchecked when its type is absent from enabledTypes', () => {
    render(<TimelineFilter enabledTypes={new Set(['FEEDING', 'DIAPER'])} onChange={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: 'Sleep' })).not.toBeChecked();
  });

  it('unchecking a type calls onChange with that type removed from the set', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TimelineFilter enabledTypes={new Set(ALL_EVENT_TYPES)} onChange={onChange} />);

    await user.click(screen.getByRole('checkbox', { name: 'Sleep' }));

    expect(onChange).toHaveBeenCalledWith(new Set(['FEEDING', 'DIAPER']));
  });

  it('checking a previously disabled type calls onChange with it added back', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TimelineFilter enabledTypes={new Set(['FEEDING', 'SLEEP'])} onChange={onChange} />);

    await user.click(screen.getByRole('checkbox', { name: 'Diaper' }));

    expect(onChange).toHaveBeenCalledWith(new Set(['FEEDING', 'SLEEP', 'DIAPER']));
  });
});
