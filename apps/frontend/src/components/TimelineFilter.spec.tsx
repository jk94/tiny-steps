import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimelineFilter } from './TimelineFilter';

describe('TimelineFilter', () => {
  it('renders all three type checkboxes, checked by default', () => {
    render(<TimelineFilter onChange={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: 'Feeding' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Sleep' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Diaper' })).toBeChecked();
  });

  it('unchecking a type calls onChange with that type removed from the set', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TimelineFilter onChange={onChange} />);

    await user.click(screen.getByRole('checkbox', { name: 'Sleep' }));

    expect(screen.getByRole('checkbox', { name: 'Sleep' })).not.toBeChecked();
    expect(onChange).toHaveBeenCalledWith(new Set(['FEEDING', 'DIAPER']));
  });

  it('re-checking a previously unchecked type calls onChange with it added back', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TimelineFilter onChange={onChange} />);

    await user.click(screen.getByRole('checkbox', { name: 'Diaper' }));
    await user.click(screen.getByRole('checkbox', { name: 'Diaper' }));

    expect(screen.getByRole('checkbox', { name: 'Diaper' })).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(new Set(['FEEDING', 'SLEEP', 'DIAPER']));
  });
});
