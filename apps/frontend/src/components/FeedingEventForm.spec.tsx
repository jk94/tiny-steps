import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedingEventForm } from './FeedingEventForm';
import type { FeedingEventFormInitialValues } from './FeedingEventForm';
import { ApiError } from '../api/http-client';

function renderForm(
  mode: 'create' | 'edit',
  onSubmit: (output: unknown) => Promise<void>,
  initialValues?: FeedingEventFormInitialValues,
) {
  return render(
    <FeedingEventForm mode={mode} onSubmit={onSubmit as never} initialValues={initialValues} />,
  );
}

const OCCURRED_AT_VALUE = '2026-01-01T10:00';

describe('FeedingEventForm (create mode)', () => {
  it('renders the feeding type select, occurred-at, and note fields; type-specific fields hidden until a type is chosen', () => {
    renderForm('create', vi.fn());

    expect(screen.getByLabelText('Feeding type')).toBeInTheDocument();
    expect(screen.getByLabelText('Time')).toBeInTheDocument();
    expect(screen.getByLabelText('Note (optional)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Amount (ml)')).not.toBeInTheDocument();
    expect(screen.queryByText('Side')).not.toBeInTheDocument();
  });

  it('reveals the side radio group and start/end time fields when BREAST is selected', async () => {
    const user = userEvent.setup();
    renderForm('create', vi.fn());

    await user.selectOptions(screen.getByLabelText('Feeding type'), 'Breastfeeding');

    expect(screen.getByText('Side')).toBeInTheDocument();
    expect(screen.getByLabelText('Left')).toBeInTheDocument();
    expect(screen.getByLabelText('Right')).toBeInTheDocument();
    expect(screen.getByLabelText('Start time (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('End time (optional)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Amount (ml)')).not.toBeInTheDocument();
  });

  it('reveals the amount field when BOTTLE is selected', async () => {
    const user = userEvent.setup();
    renderForm('create', vi.fn());

    await user.selectOptions(screen.getByLabelText('Feeding type'), 'Bottle');

    expect(screen.getByLabelText('Amount (ml)')).toBeInTheDocument();
    expect(screen.queryByText('Side')).not.toBeInTheDocument();
  });

  it('reveals no type-specific fields when SOLID is selected', async () => {
    const user = userEvent.setup();
    renderForm('create', vi.fn());

    await user.selectOptions(screen.getByLabelText('Feeding type'), 'Solid food');

    expect(screen.queryByLabelText('Amount (ml)')).not.toBeInTheDocument();
    expect(screen.queryByText('Side')).not.toBeInTheDocument();
  });

  it('blocks submission and shows a validation error when amountMl is missing for BOTTLE', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderForm('create', onSubmit);

    await user.selectOptions(screen.getByLabelText('Feeding type'), 'Bottle');
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: OCCURRED_AT_VALUE } });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(screen.getByText('Please enter an amount in ml.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks submission and shows a validation error when endedAt is before startedAt for BREAST', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderForm('create', onSubmit);

    await user.selectOptions(screen.getByLabelText('Feeding type'), 'Breastfeeding');
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: OCCURRED_AT_VALUE } });
    await user.click(screen.getByLabelText('Left'));
    fireEvent.change(screen.getByLabelText('Start time (optional)'), {
      target: { value: '2026-01-01T10:20' },
    });
    fireEvent.change(screen.getByLabelText('End time (optional)'), {
      target: { value: '2026-01-01T10:00' },
    });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(screen.getByText("The end time can't be before the start time.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a BOTTLE entry with the parsed amountMl as a number', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderForm('create', onSubmit);

    await user.selectOptions(screen.getByLabelText('Feeding type'), 'Bottle');
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: OCCURRED_AT_VALUE } });
    fireEvent.change(screen.getByLabelText('Amount (ml)'), { target: { value: '90' } });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ feedingType: 'BOTTLE', amountMl: 90 }),
    );
  });

  it('submits a BREAST entry with the chosen side', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderForm('create', onSubmit);

    await user.selectOptions(screen.getByLabelText('Feeding type'), 'Breastfeeding');
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: OCCURRED_AT_VALUE } });
    await user.click(screen.getByLabelText('Right'));
    fireEvent.change(screen.getByLabelText('End time (optional)'), {
      target: { value: '2026-01-01T10:20' },
    });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ feedingType: 'BREAST', side: 'RIGHT' }),
    );
  });

  it('blocks submission and shows a validation error when endedAt is missing for a BREAST backfill', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderForm('create', onSubmit);

    await user.selectOptions(screen.getByLabelText('Feeding type'), 'Breastfeeding');
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: OCCURRED_AT_VALUE } });
    await user.click(screen.getByLabelText('Left'));
    fireEvent.change(screen.getByLabelText('Start time (optional)'), {
      target: { value: '2026-01-01T10:00' },
    });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(screen.getByText('Please enter an end time.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the mapped error message when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(400, {}));
    const user = userEvent.setup();
    renderForm('create', onSubmit);

    await user.selectOptions(screen.getByLabelText('Feeding type'), 'Solid food');
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: OCCURRED_AT_VALUE } });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't save your changes. Please check the entered values.",
    );
  });

  it('omits note entirely (not null) when left empty in create mode', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderForm('create', onSubmit);

    await user.selectOptions(screen.getByLabelText('Feeding type'), 'Solid food');
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: OCCURRED_AT_VALUE } });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    const [submittedOutput] = onSubmit.mock.calls[0] as [Record<string, unknown>];
    expect('note' in submittedOutput).toBe(false);
  });
});

describe('FeedingEventForm (edit mode)', () => {
  const initialValues: FeedingEventFormInitialValues = {
    feedingType: 'BOTTLE',
    occurredAt: '2026-01-01T10:00:00.000Z',
    amountMl: 120,
  };

  it('disables the feedingType select', () => {
    renderForm('edit', vi.fn(), initialValues);

    expect(screen.getByLabelText('Feeding type')).toBeDisabled();
  });

  it('pre-fills the type-specific field from initialValues', () => {
    renderForm('edit', vi.fn(), initialValues);

    expect(screen.getByLabelText('Amount (ml)')).toHaveValue(120);
  });

  it('renders the save submit button text', () => {
    renderForm('edit', vi.fn(), initialValues);

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('sends note: null (not omitted, not an empty string) when a pre-filled note is cleared', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderForm('edit', onSubmit, { ...initialValues, note: 'Fussy during feed' });

    await user.clear(screen.getByLabelText('Note (optional)'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ note: null }));
  });

  it('sends the trimmed note text when a pre-filled note is edited, not cleared', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderForm('edit', onSubmit, { ...initialValues, note: 'Fussy' });

    await user.type(screen.getByLabelText('Note (optional)'), ' during feed');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ note: 'Fussy during feed' }));
  });
});
