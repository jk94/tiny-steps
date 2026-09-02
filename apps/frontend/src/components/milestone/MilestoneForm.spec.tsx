import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MilestoneForm } from './MilestoneForm';
import type { MilestoneFormOutput } from './MilestoneForm';
import { MAX_PHOTO_BYTES } from '../../lib/photoConstraints';

const BIRTH_DATE = '2025-01-20';

function renderForm(props: Partial<React.ComponentProps<typeof MilestoneForm>> = {}) {
  const onSubmit = vi.fn<(output: MilestoneFormOutput) => Promise<void>>().mockResolvedValue();
  render(<MilestoneForm mode="create" birthDate={BIRTH_DATE} onSubmit={onSubmit} {...props} />);
  return { onSubmit };
}

function imageFile(name: string, { type = 'image/png', size = 1024 } = {}): File {
  const file = new File(['x'], name, { type });
  // `File` has no writable size; jsdom lets it be redefined, which is the only
  // way to exercise the oversized-file branch without allocating 2 MB.
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('MilestoneForm', () => {
  it('shows a preselected template read-only and submits its translated label as the title', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ templateKey: 'FIRST_STEPS' });

    // The label is rendered as text, not as an editable field. (It also
    // appears on the template `Select`'s trigger, hence `getAllByText`.)
    expect(screen.getAllByText('First steps').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(
      screen.getByText('The title comes from the template and cannot be changed.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      templateKey: 'FIRST_STEPS',
      title: 'First steps',
      // Never sent for a template entry — the server derives it.
      category: null,
    });
  });

  it('shows the template category read-only rather than as a choice', () => {
    renderForm({ templateKey: 'FIRST_STEPS' });

    expect(screen.getByText('Motor')).toBeInTheDocument();
    expect(screen.getByText('The category follows from the template.')).toBeInTheDocument();
  });

  it('lets a free entry provide its own title', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText('Title'), 'First trip by train');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      templateKey: null,
      title: 'First trip by train',
    });
  });

  it('refuses a free entry without a title', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Please enter a title.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refuses a date before the birth date (M-6)', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText('Title'), 'Too early');
    const dateInput = screen.getByLabelText('Date');
    await user.clear(dateInput);
    await user.type(dateInput, '2025-01-19');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('The date must not be before the birth date.'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refuses a date in the future (M-6)', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await user.type(screen.getByLabelText('Title'), 'Too late');
    const dateInput = screen.getByLabelText('Date');
    await user.clear(dateInput);
    await user.type(dateInput, tomorrow);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('The date must not be in the future.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('restricts the file picker to the allowed image types', () => {
    // The browser's own filter, which is why the wrong-type branch below can
    // only be reached through a path that bypasses the picker (drag & drop).
    renderForm();

    expect(screen.getByLabelText('Choose photos')).toHaveAttribute(
      'accept',
      'image/jpeg,image/png,image/webp',
    );
  });

  it('keeps valid photos and flags only the oversized one (M-15)', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.upload(screen.getByLabelText('Choose photos'), [
      imageFile('good.png'),
      imageFile('huge.png', { size: MAX_PHOTO_BYTES + 1 }),
    ]);

    // The rejected file stays visible with its own reason rather than being
    // silently dropped — and the valid one beside it is unaffected.
    expect(screen.getByText('good.png')).toBeInTheDocument();
    expect(screen.getByText('huge.png')).toBeInTheDocument();
    expect(screen.getByText('“huge.png” is larger than 2 MB.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Title'), 'With photos');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // A client-rejected file can never be uploaded as-is, so the form blocks
    // the submit until it is removed rather than dropping it silently (M-15).
    expect(
      await screen.findByText(
        'Some photos were rejected. Please remove them or choose different files before saving.',
      ),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Remove “huge.png”' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    // Only the file that passed client-side validation is handed on.
    const { photos } = onSubmit.mock.calls[0][0];
    expect(photos.map((photo) => photo.file.name)).toEqual(['good.png']);
  });

  it('refuses files past the per-milestone ceiling, counting the ones already stored (M-7)', async () => {
    const user = userEvent.setup();
    renderForm({ existingPhotoCount: 9 });

    await user.upload(screen.getByLabelText('Choose photos'), [
      imageFile('a.png'),
      imageFile('b.png'),
      imageFile('c.png'),
    ]);

    // One slot left, so two files are refused — and named as such.
    expect(screen.getByText('a.png')).toBeInTheDocument();
    expect(screen.queryByText('b.png')).not.toBeInTheDocument();
    expect(
      screen.getByText('A milestone can carry at most 10 photos. 2 file(s) were not added.'),
    ).toBeInTheDocument();
  });

  it('lets a queued photo be removed again before submitting', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.upload(screen.getByLabelText('Choose photos'), [imageFile('a.png')]);
    expect(screen.getByText('a.png')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove “a.png”' }));

    expect(screen.queryByText('a.png')).not.toBeInTheDocument();
  });

  it('surfaces a per-file upload failure reported back by the page (M-15)', async () => {
    const file = imageFile('a.png');
    render(
      <MilestoneForm
        mode="edit"
        birthDate={BIRTH_DATE}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        initialValues={{
          templateKey: null,
          title: 'With photos',
          category: null,
          achievedAt: '2025-08-20',
          note: '',
        }}
        photoResults={[
          // A failed *server* attempt: still retryable, so it stays `pending`
          // with a reason attached — this is what the page hands back.
          { id: '1', file, status: 'pending', errorKey: 'milestone.errors.photoUploadError' },
        ]}
      />,
    );

    expect(screen.getByText('a.png')).toBeInTheDocument();
    expect(
      screen.getByText('The photo could not be uploaded. Please try again.'),
    ).toBeInTheDocument();
  });

  it('offers no template/free toggle while editing — the kind of entry is fixed', () => {
    render(
      <MilestoneForm
        mode="edit"
        birthDate={BIRTH_DATE}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        initialValues={{
          templateKey: 'FIRST_STEPS',
          title: 'First steps',
          category: 'MOTOR',
          achievedAt: '2025-08-20',
          note: '',
        }}
      />,
    );

    expect(screen.queryByRole('button', { name: 'From a template' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Free entry' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('keeps the user on the form when the submit fails (M-15)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('offline'));
    render(<MilestoneForm mode="create" birthDate={BIRTH_DATE} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Title'), 'Anything');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Re-enabled rather than stuck in a pending state, so the user can retry.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled());
    expect(screen.getByLabelText('Title')).toHaveValue('Anything');
  });
});
