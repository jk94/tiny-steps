import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GrowthMeasurementForm } from './GrowthMeasurementForm';
import type { GrowthMeasurementFormOutput } from './GrowthMeasurementForm';
import { chooseSelectOption } from '../../test/chooseSelectOption';
import { stubPopupLayoutApis } from '../../test/stubPopupLayoutApis';

// The measurement-method field is a Radix combobox — see the helper's docs.
stubPopupLayoutApis();

const BIRTH_DATE = '2025-01-01';
const MEASURED_AT = '2025-04-01';

function renderForm(
  mode: 'create' | 'edit',
  onSubmit: (output: GrowthMeasurementFormOutput) => Promise<void>,
) {
  return render(<GrowthMeasurementForm mode={mode} birthDate={BIRTH_DATE} onSubmit={onSubmit} />);
}

function setDate(value: string) {
  fireEvent.change(screen.getByLabelText('Measurement date'), { target: { value } });
}

function setWeight(value: string) {
  fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value } });
}

describe('GrowthMeasurementForm', () => {
  describe('W-1: at least one value', () => {
    it('blocks submission and explains why when no value is entered', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      renderForm('create', onSubmit);

      setDate(MEASURED_AT);
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByText('Please enter at least one value.')).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('accepts a measurement carrying only the head circumference (W-2)', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderForm('create', onSubmit);

      setDate(MEASURED_AT);
      fireEvent.change(screen.getByLabelText('Head circumference (cm)'), {
        target: { value: '40.5' },
      });
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ headCircumferenceMillimeters: 405 }),
      );
    });
  });

  describe('W-3: unit conversion', () => {
    it('converts kilograms to whole grams', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderForm('create', onSubmit);

      setDate(MEASURED_AT);
      setWeight('6.2');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ weightGrams: 6200 }));
    });

    it('converts centimetres to whole millimetres', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderForm('create', onSubmit);

      setDate(MEASURED_AT);
      fireEvent.change(screen.getByLabelText('Length/height (cm)'), { target: { value: '61.5' } });
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ lengthMillimeters: 615 }));
    });

    it('omits an empty value in create mode rather than sending null', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderForm('create', onSubmit);

      setDate(MEASURED_AT);
      setWeight('6.2');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      const output = onSubmit.mock.calls[0][0] as GrowthMeasurementFormOutput;
      expect(output.lengthMillimeters).toBeUndefined();
    });

    it('sends an explicit null for an emptied value in edit mode, so it is cleared', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderForm('edit', onSubmit);

      setDate(MEASURED_AT);
      setWeight('6.2');
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      const output = onSubmit.mock.calls[0][0] as GrowthMeasurementFormOutput;
      expect(output.lengthMillimeters).toBeNull();
    });
  });

  describe('W-4: plausibility limits', () => {
    it('rejects an implausibly small weight and names the bounds', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      renderForm('create', onSubmit);

      setDate(MEASURED_AT);
      setWeight('0.05');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByText('The weight must be between 0.2 and 60 kg.')).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('rejects an implausibly large head circumference', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      renderForm('create', onSubmit);

      setDate(MEASURED_AT);
      fireEvent.change(screen.getByLabelText('Head circumference (cm)'), {
        target: { value: '95' },
      });
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(
        screen.getByText('The head circumference must be between 20 and 70 cm.'),
      ).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('W-5: measurement date', () => {
    it('rejects a date in the future', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      renderForm('create', onSubmit);

      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setDate(tomorrow);
      setWeight('6.2');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByText('The date must not be in the future.')).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('rejects a date before the child was born', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      renderForm('create', onSubmit);

      setDate('2024-12-24');
      setWeight('3.4');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByText('The date must not be before the birth date.')).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('constrains the picker itself to the birth date and today', () => {
      renderForm('create', vi.fn());

      const now = new Date();
      const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate(),
      ).padStart(2, '0')}`;
      const input = screen.getByLabelText('Measurement date');
      expect(input).toHaveAttribute('min', BIRTH_DATE);
      expect(input).toHaveAttribute('max', localToday);
    });

    it('submits the picked day verbatim, never a timezone-dependent instant', async () => {
      // Turning the day into an instant here made the stored date drift by a
      // day and could push a measurement taken this morning into the server's
      // "future" — see the calendar-day handling of `Child.birthDate`.
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderForm('create', onSubmit);

      setDate(MEASURED_AT);
      setWeight('6.2');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ measuredAt: '2025-04-01' }));
    });

    it("defaults to the user's local today, not the UTC day", () => {
      renderForm('create', vi.fn());

      const now = new Date();
      const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate(),
      ).padStart(2, '0')}`;
      expect(screen.getByLabelText('Measurement date')).toHaveValue(localToday);
    });
  });

  describe('W-18 / W-19: measurement method', () => {
    it('explains why the toggle exists', () => {
      renderForm('create', vi.fn());

      expect(
        screen.getByText(/distinguishes recumbent length \(up to 24 months\)/i),
      ).toBeInTheDocument();
    });

    it('omits the override when left on automatic', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderForm('create', onSubmit);

      setDate(MEASURED_AT);
      setWeight('6.2');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      const output = onSubmit.mock.calls[0][0] as GrowthMeasurementFormOutput;
      expect(output.lengthMeasurementPosition).toBeUndefined();
    });

    it('sends the chosen override', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderForm('create', onSubmit);

      setDate(MEASURED_AT);
      setWeight('6.2');
      await chooseSelectOption(user, 'Length/height measurement method', 'Measured standing');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ lengthMeasurementPosition: 'STANDING' }),
      );
    });

    it('clears the override in edit mode when switched back to automatic', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderForm('edit', onSubmit);

      setDate(MEASURED_AT);
      setWeight('6.2');
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      const output = onSubmit.mock.calls[0][0] as GrowthMeasurementFormOutput;
      expect(output.lengthMeasurementPosition).toBeNull();
    });
  });

  describe('W-16: a failed save is visible, never faked', () => {
    it('keeps the entered values and re-enables the form when the request rejects', async () => {
      const onSubmit = vi.fn().mockRejectedValue(new Error('offline'));
      const user = userEvent.setup();
      renderForm('create', onSubmit);

      setDate(MEASURED_AT);
      setWeight('6.2');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(onSubmit).toHaveBeenCalled();
      // Still on the form, with the typed values intact and the button usable
      // again — nothing was buffered and no success state was shown.
      expect(screen.getByLabelText('Weight (kg)')).toHaveValue(6.2);
      expect(await screen.findByRole('button', { name: 'Save' })).toBeEnabled();
    });
  });
});
