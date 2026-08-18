import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiaperEventForm } from './DiaperEventForm';
import type { DiaperEventFormInitialValues } from './DiaperEventForm';
import { ApiError } from '../api/http-client';
import { chooseSelectOption } from '../test/chooseSelectOption';
import { stubPopupLayoutApis } from '../test/stubPopupLayoutApis';

// The diaper-type field is a Radix combobox — see the helper's doc comment.
stubPopupLayoutApis();

function renderForm(
  mode: 'create' | 'edit',
  onSubmit: (output: unknown) => Promise<void>,
  initialValues?: DiaperEventFormInitialValues,
) {
  return render(
    <DiaperEventForm mode={mode} onSubmit={onSubmit as never} initialValues={initialValues} />,
  );
}

const OCCURRED_AT_VALUE = '2026-01-01T10:00';

describe('DiaperEventForm (create mode)', () => {
  it('renders the diaperType select, occurred-at, and note fields', () => {
    renderForm('create', vi.fn());

    expect(screen.getByLabelText('Diaper type')).toBeInTheDocument();
    expect(screen.getByLabelText('Time')).toBeInTheDocument();
    expect(screen.getByLabelText('Consistency note (optional)')).toBeInTheDocument();
  });

  it('blocks submission and shows a validation error when diaperType is missing', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderForm('create', onSubmit);

    fireEvent.change(screen.getByLabelText('Time'), { target: { value: OCCURRED_AT_VALUE } });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(screen.getByText('Please choose a diaper type.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks submission and shows a validation error when occurredAt is missing', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderForm('create', onSubmit);

    await chooseSelectOption(user, 'Diaper type', 'Pee');
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(screen.getByText('Please enter a time.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks submission and shows a validation error when note exceeds 500 characters', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderForm('create', onSubmit);

    await chooseSelectOption(user, 'Diaper type', 'Pee');
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: OCCURRED_AT_VALUE } });
    fireEvent.change(screen.getByLabelText('Consistency note (optional)'), {
      target: { value: 'a'.repeat(501) },
    });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(screen.getByText('The note must be at most 500 characters long.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a PEE entry with the expected output shape', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderForm('create', onSubmit);

    await chooseSelectOption(user, 'Diaper type', 'Pee');
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: OCCURRED_AT_VALUE } });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ diaperType: 'PEE', occurredAt: expect.any(String) }),
    );
  });

  it('submits a BOTH entry including the note when provided', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderForm('create', onSubmit);

    await chooseSelectOption(user, 'Diaper type', 'Both');
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: OCCURRED_AT_VALUE } });
    fireEvent.change(screen.getByLabelText('Consistency note (optional)'), {
      target: { value: 'Slight rash' },
    });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ diaperType: 'BOTH', note: 'Slight rash' }),
    );
  });

  it('shows the mapped error message when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(400, {}));
    const user = userEvent.setup();
    renderForm('create', onSubmit);

    await chooseSelectOption(user, 'Diaper type', 'Stool');
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

    await chooseSelectOption(user, 'Diaper type', 'Pee');
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: OCCURRED_AT_VALUE } });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    const [submittedOutput] = onSubmit.mock.calls[0] as [Record<string, unknown>];
    expect('note' in submittedOutput).toBe(false);
  });
});

describe('DiaperEventForm (edit mode)', () => {
  const initialValues: DiaperEventFormInitialValues = {
    diaperType: 'STOOL',
    occurredAt: '2026-01-01T10:00:00.000Z',
    note: 'Loose stool',
  };

  it('pre-fills the fields from initialValues', () => {
    renderForm('edit', vi.fn(), initialValues);

    // The combobox trigger shows the selected option's label, not its value.
    expect(screen.getByLabelText('Diaper type')).toHaveTextContent('Stool');
    expect(screen.getByLabelText('Consistency note (optional)')).toHaveValue('Loose stool');
  });

  // Deliberate structural divergence from FeedingEventForm: the diaperType
  // select stays enabled in edit mode (diaperType is editable via PATCH,
  // see UpdateDiaperEventDto's doc comment), unlike feedingType which is
  // immutable and disabled in edit mode.
  it('does NOT disable the diaperType select in edit mode', () => {
    renderForm('edit', vi.fn(), initialValues);

    expect(screen.getByLabelText('Diaper type')).toBeEnabled();
  });

  it('renders the save submit button text', () => {
    renderForm('edit', vi.fn(), initialValues);

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('submits a changed diaperType in edit mode', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderForm('edit', onSubmit, initialValues);

    await chooseSelectOption(user, 'Diaper type', 'Both');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ diaperType: 'BOTH' }));
  });

  it('sends note: null (not omitted, not an empty string) when a pre-filled note is cleared', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderForm('edit', onSubmit, initialValues);

    await user.clear(screen.getByLabelText('Consistency note (optional)'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ note: null }));
  });

  it('sends the edited note text when a pre-filled note is edited, not cleared', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderForm('edit', onSubmit, initialValues);

    await user.type(screen.getByLabelText('Consistency note (optional)'), ', slight rash');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ note: 'Loose stool, slight rash' }),
    );
  });
});
