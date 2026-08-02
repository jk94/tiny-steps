import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SleepEventForm } from './SleepEventForm';
import type { SleepEventFormInitialValues } from './SleepEventForm';
import { ApiError } from '../api/http-client';

function renderForm(
  mode: 'create' | 'edit',
  onSubmit: (output: unknown) => Promise<void>,
  initialValues?: SleepEventFormInitialValues,
) {
  return render(
    <SleepEventForm mode={mode} onSubmit={onSubmit as never} initialValues={initialValues} />,
  );
}

const OCCURRED_AT_VALUE = '2026-01-01T20:00';

describe('SleepEventForm (create mode)', () => {
  it('renders the occurred-at and end-time fields, with no separate start-time field', () => {
    renderForm('create', vi.fn());

    expect(screen.getByLabelText('Time')).toBeInTheDocument();
    expect(screen.getByLabelText('End time (optional)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Start time (optional)')).not.toBeInTheDocument();
  });

  it('blocks submission and shows a validation error when occurredAt is missing', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderForm('create', onSubmit);

    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(screen.getByText('Please enter a time.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks submission and shows a validation error when endedAt is missing (create-only requirement)', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderForm('create', onSubmit);

    fireEvent.change(screen.getByLabelText('Time'), { target: { value: OCCURRED_AT_VALUE } });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(screen.getByText('Please enter an end time.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks submission and shows a validation error when endedAt is before occurredAt', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderForm('create', onSubmit);

    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '2026-01-01T20:20' } });
    fireEvent.change(screen.getByLabelText('End time (optional)'), {
      target: { value: '2026-01-01T20:00' },
    });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(screen.getByText("The end time can't be before the start time.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a fully-backfilled entry with startedAt mirroring occurredAt', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderForm('create', onSubmit);

    fireEvent.change(screen.getByLabelText('Time'), { target: { value: OCCURRED_AT_VALUE } });
    fireEvent.change(screen.getByLabelText('End time (optional)'), {
      target: { value: '2026-01-01T20:30' },
    });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(onSubmit).toHaveBeenCalledWith({
      occurredAt: new Date(OCCURRED_AT_VALUE).toISOString(),
      startedAt: new Date(OCCURRED_AT_VALUE).toISOString(),
      endedAt: new Date('2026-01-01T20:30').toISOString(),
    });
  });

  it('shows the mapped error message when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(400, {}));
    const user = userEvent.setup();
    renderForm('create', onSubmit);

    fireEvent.change(screen.getByLabelText('Time'), { target: { value: OCCURRED_AT_VALUE } });
    fireEvent.change(screen.getByLabelText('End time (optional)'), {
      target: { value: '2026-01-01T20:30' },
    });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't save your changes. Please check the entered values.",
    );
  });
});

describe('SleepEventForm (edit mode)', () => {
  const initialValues: SleepEventFormInitialValues = {
    occurredAt: '2026-01-01T20:00:00.000Z',
  };

  it('allows an empty endedAt (an in-progress timer stays editable)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderForm('edit', onSubmit, initialValues);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Round-tripping the pre-filled ISO timestamp through the
    // datetime-local input and back must reproduce the original value —
    // deliberately not hardcoding a local-time string here, since the
    // local<->UTC conversion depends on the test runner's timezone.
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        occurredAt: initialValues.occurredAt,
        startedAt: initialValues.occurredAt,
      }),
    );
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('endedAt');
  });

  it('renders the save submit button text, with no separate start-time field', () => {
    renderForm('edit', vi.fn(), initialValues);

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Start time (optional)')).not.toBeInTheDocument();
  });

  it('mirrors startedAt to the updated occurredAt when only occurredAt is changed', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderForm('edit', onSubmit, initialValues);

    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '2026-01-01T21:00' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        occurredAt: new Date('2026-01-01T21:00').toISOString(),
        startedAt: new Date('2026-01-01T21:00').toISOString(),
      }),
    );
  });
});
