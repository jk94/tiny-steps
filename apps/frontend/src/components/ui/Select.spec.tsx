import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { stubPopupLayoutApis } from '../../test/stubPopupLayoutApis';
import { Select } from './Select';

// Radix's Select measures and scrolls its popper; jsdom implements none of
// those APIs — see the helper's doc comment.
stubPopupLayoutApis();

function renderSelect(props: Partial<ComponentProps<typeof Select>> = {}) {
  return render(
    <Select label="Feeding type" placeholder="Choose a type…" {...props}>
      <Select.Item value="BREAST">Breastfeeding</Select.Item>
      <Select.Item value="BOTTLE">Bottle</Select.Item>
      <Select.Item value="SOLID" disabled>
        Solid food
      </Select.Item>
    </Select>,
  );
}

describe('Select', () => {
  it('associates the label with the trigger', () => {
    renderSelect();
    const trigger = screen.getByLabelText('Feeding type');
    expect(trigger).toBe(screen.getByRole('combobox'));
    // The name is the field label, not the trigger's own text — the latter is
    // the combobox's value, mirroring how a native <select> announces.
    expect(trigger).toHaveAccessibleName('Feeding type');
  });

  it('shows the placeholder until something is selected', () => {
    renderSelect();
    expect(screen.getByRole('combobox')).toHaveTextContent('Choose a type…');
  });

  it('renders the selected value on the trigger', () => {
    renderSelect({ defaultValue: 'BOTTLE' });
    expect(screen.getByRole('combobox')).toHaveTextContent('Bottle');
  });

  it('opens the listbox and reports the picked value', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    renderSelect({ onValueChange });

    await user.click(screen.getByRole('combobox'));
    expect(await screen.findByRole('listbox')).toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: 'Bottle' }));

    expect(onValueChange).toHaveBeenCalledWith('BOTTLE');
    expect(screen.getByRole('combobox')).toHaveTextContent('Bottle');
  });

  it('marks a disabled item as unselectable', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    renderSelect({ onValueChange });

    await user.click(screen.getByRole('combobox'));

    const disabledOption = await screen.findByRole('option', { name: 'Solid food' });
    expect(disabledOption).toHaveAttribute('aria-disabled', 'true');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('wires aria-invalid and aria-describedby when errored', () => {
    renderSelect({ error: 'Please choose a feeding type.' });
    const trigger = screen.getByRole('combobox');
    const message = screen.getByRole('alert');

    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger.getAttribute('aria-describedby')).toBe(message.id);
  });

  it('is not marked invalid without an error', () => {
    renderSelect();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'false');
  });
});
