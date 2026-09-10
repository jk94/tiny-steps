import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HealthRecordForm } from './HealthRecordForm';
import type { HealthRecordFormInitialValues } from './HealthRecordForm';

const BIRTH_DATE = '2025-01-20';

function renderForm(props: Partial<React.ComponentProps<typeof HealthRecordForm>> = {}): {
  onSubmit: ReturnType<typeof vi.fn>;
} {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<HealthRecordForm mode="create" birthDate={BIRTH_DATE} onSubmit={onSubmit} {...props} />);
  return { onSubmit };
}

function editValues(
  overrides: Partial<HealthRecordFormInitialValues> = {},
): HealthRecordFormInitialValues {
  return {
    kind: 'MEDICATION',
    name: 'Paracetamol',
    administeredAt: '2025-08-20T14:30',
    dueAt: '',
    doseAmount: '5',
    doseUnit: 'ml',
    vaccineBatch: '',
    note: '',
    reminderEnabled: false,
    ...overrides,
  };
}

describe('HealthRecordForm', () => {
  it('swaps the dose fields for the batch field when the kind tab changes', async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByLabelText('Dose (optional)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Vaccine / batch (optional)')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Vaccination' }));

    expect(screen.getByLabelText('Vaccine / batch (optional)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Dose (optional)')).not.toBeInTheDocument();
  });

  it('shows the kind read-only while editing — it cannot be changed', () => {
    renderForm({ mode: 'edit', initialValues: editValues() });

    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByText('The type cannot be changed afterwards.')).toBeInTheDocument();
  });

  it('refuses an entry with neither date (MED-2)', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText('Name'), 'Paracetamol');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Please give either an administration date or a due date.'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refuses a dose without a unit (MED-3)', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText('Name'), 'Vitamin D');
    await user.type(screen.getByLabelText('Due on (optional)'), '2026-01-15');
    await user.type(screen.getByLabelText('Dose (optional)'), '5');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Please give a unit for the dose as well.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refuses an administration before the birth date (MED-6)', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText('Name'), 'Paracetamol');
    await user.type(screen.getByLabelText('Administered at (optional)'), '2025-01-19T10:00');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('The time must not be before the birth date.'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts a due date in the past — that is an overdue entry, not an error', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText('Name'), 'Nachholimpfung');
    await user.type(screen.getByLabelText('Due on (optional)'), '2020-01-01');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ dueAt: '2020-01-01' }));
  });

  it('submits a medication with its dose and an ISO instant', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText('Name'), 'Paracetamol');
    await user.type(screen.getByLabelText('Administered at (optional)'), '2025-08-20T14:30');
    await user.type(screen.getByLabelText('Dose (optional)'), '5');
    await user.type(screen.getByLabelText('Unit'), 'ml');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'MEDICATION',
      name: 'Paracetamol',
      // The local `datetime-local` value is converted to a UTC instant.
      administeredAt: new Date('2025-08-20T14:30').toISOString(),
      dueAt: null,
      doseAmount: 5,
      doseUnit: 'ml',
      vaccineBatch: null,
      note: null,
      reminderEnabled: false,
    });
  });

  it('submits a vaccination with its batch and no dose fields', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.click(screen.getByRole('tab', { name: 'Vaccination' }));
    await user.type(screen.getByLabelText('Name'), '6-in-1 vaccine');
    await user.type(screen.getByLabelText('Due on (optional)'), '2026-01-15');
    await user.type(screen.getByLabelText('Vaccine / batch (optional)'), 'AB1234');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'VACCINATION',
        vaccineBatch: 'AB1234',
        // The server rejects dose fields on a vaccination outright, so they are
        // cleared rather than carried over from the other tab.
        doseAmount: null,
        doseUnit: null,
      }),
    );
  });

  it('clears the dose typed before switching to the vaccination tab', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText('Name'), 'Impfung');
    await user.type(screen.getByLabelText('Due on (optional)'), '2026-01-15');
    await user.type(screen.getByLabelText('Dose (optional)'), '5');
    await user.type(screen.getByLabelText('Unit'), 'ml');
    await user.click(screen.getByRole('tab', { name: 'Vaccination' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ doseAmount: null, doseUnit: null }),
    );
  });

  it('only offers the reminder once there is a due date to fire on', async () => {
    const user = userEvent.setup();
    renderForm();

    expect(
      screen.queryByRole('checkbox', { name: 'Remind me about this appointment' }),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Due on (optional)'), '2026-01-15');

    expect(
      screen.getByRole('checkbox', { name: 'Remind me about this appointment' }),
    ).toBeInTheDocument();
  });

  it('sends an emptied optional as null on edit, so the server clears it', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({
      mode: 'edit',
      initialValues: editValues({ note: 'Bei Fieber' }),
    });

    await user.clear(screen.getByLabelText('Note (optional)'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ note: null }));
  });
});
