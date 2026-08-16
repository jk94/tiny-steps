import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './Select';

function renderSelect(props: Partial<ComponentProps<typeof Select>> = {}) {
  return render(
    <Select label="Feeding type" defaultValue="" {...props}>
      <option value="" disabled>
        Choose a type…
      </option>
      <option value="BREAST">Breastfeeding</option>
      <option value="BOTTLE">Bottle</option>
    </Select>,
  );
}

describe('Select', () => {
  it('associates the label with the native select', () => {
    renderSelect();
    expect(screen.getByLabelText('Feeding type')).toBeInstanceOf(HTMLSelectElement);
  });

  it('selects an option', async () => {
    const user = userEvent.setup();
    renderSelect();
    const select = screen.getByLabelText('Feeding type');
    await user.selectOptions(select, 'BOTTLE');
    expect(select).toHaveValue('BOTTLE');
  });

  it('wires aria-invalid and aria-describedby when errored', () => {
    renderSelect({ error: 'Please choose a feeding type.' });
    const select = screen.getByLabelText('Feeding type');
    const message = screen.getByRole('alert');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select.getAttribute('aria-describedby')).toBe(message.id);
  });
});
