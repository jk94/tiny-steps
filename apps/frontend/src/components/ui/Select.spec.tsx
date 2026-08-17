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
    // `pointerEventsCheck` is disabled because the visual guard is a Tailwind
    // class (`data-[disabled]:pointer-events-none`) and no stylesheet is
    // applied in jsdom, so the check would reject the click below on styling
    // grounds. The point of this test is the layer underneath: that the
    // primitive ignores the interaction even if the event does arrive.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderSelect({ onValueChange });

    await user.click(screen.getByRole('combobox'));

    const disabledOption = await screen.findByRole('option', { name: 'Solid food' });
    expect(disabledOption).toHaveAttribute('aria-disabled', 'true');

    // Actually attempt the selection — asserting only that onValueChange was
    // never called, without clicking first, would pass no matter what the
    // component does.
    await user.click(disabledOption);

    expect(onValueChange).not.toHaveBeenCalled();
    // The listbox stays open, since nothing was selected.
    expect(screen.getByRole('listbox')).toBeInTheDocument();
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
