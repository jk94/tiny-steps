import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChildForm } from './ChildForm';
import { ApiError } from '../api/http-client';
import { stubImageLoading } from '../test/stubImageLoading';

// ChildForm renders the existing photo via ChildPhoto, which is backed by
// the Radix-based Avatar primitive — its image load is async in a real
// browser, so jsdom needs this stub to resolve synchronously in tests.
stubImageLoading();

function renderChildForm(
  mode: 'create' | 'edit',
  onSubmit: (formData: FormData) => Promise<void>,
  initialValues?: ChildFormInitialValuesArg,
) {
  return render(<ChildForm mode={mode} onSubmit={onSubmit} initialValues={initialValues} />);
}

type ChildFormInitialValuesArg = {
  name: string;
  birthDate: string;
  childId: string;
  householdId: string;
  hasPhoto: boolean;
};

describe('ChildForm (create mode)', () => {
  it('renders labeled name/birthDate/photo fields', () => {
    renderChildForm('create', vi.fn());

    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Birth date')).toBeInTheDocument();
    expect(screen.getByLabelText('Photo (optional)')).toBeInTheDocument();
  });

  it('renders the create submit button text', () => {
    renderChildForm('create', vi.fn());

    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it('blocks submission and shows a validation error when name is empty', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderChildForm('create', onSubmit);

    fireEvent.change(screen.getByLabelText('Birth date'), { target: { value: '2020-01-01' } });
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(screen.getByText('Please enter a name.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks submission and shows a validation error when name exceeds 120 characters', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderChildForm('create', onSubmit);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'a'.repeat(121) } });
    fireEvent.change(screen.getByLabelText('Birth date'), { target: { value: '2020-01-01' } });
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(screen.getByText('The name must be at most 120 characters long.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks submission and shows a validation error when birth date is empty', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderChildForm('create', onSubmit);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alex' } });
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(screen.getByText('Please enter a birth date.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks submission and shows a validation error when birth date is in the future', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderChildForm('create', onSubmit);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText('Birth date'), { target: { value: '2099-01-01' } });
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(screen.getByText("Birth date can't be in the future.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks submission and shows a validation error for a too-large photo', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderChildForm('create', onSubmit);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText('Birth date'), { target: { value: '2020-01-01' } });
    const oversizedPhoto = new File([new Uint8Array(3 * 1024 * 1024)], 'photo.png', {
      type: 'image/png',
    });
    await user.upload(screen.getByLabelText('Photo (optional)'), oversizedPhoto);
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(screen.getByText('The photo must be at most 2 MB.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks submission and shows a validation error for an invalid photo type', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderChildForm('create', onSubmit);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText('Birth date'), { target: { value: '2020-01-01' } });
    // `userEvent.upload()` itself respects the input's `accept` attribute
    // (silently refusing a mismatched file, like a real browser's picker
    // would), so it can't reach this state — dispatch a raw `change` event
    // instead to exercise the JS-level type check itself (the actual
    // defense: a renamed extension, drag-and-drop, or a browser that
    // doesn't enforce `accept`).
    const photoInput = screen.getByLabelText('Photo (optional)') as HTMLInputElement;
    const invalidPhoto = new File(['x'], 'photo.gif', { type: 'image/gif' });
    Object.defineProperty(photoInput, 'files', { value: [invalidPhoto], configurable: true });
    fireEvent.change(photoInput);
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(screen.getByText('Please choose a JPEG, PNG, or WebP image.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits FormData with name/birthDate and omits photo when none selected', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderChildForm('create', onSubmit);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText('Birth date'), { target: { value: '2020-01-01' } });
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const formData = onSubmit.mock.calls[0][0] as FormData;
    expect(formData.get('name')).toBe('Alex');
    expect(formData.get('birthDate')).toBe('2020-01-01');
    expect(formData.has('photo')).toBe(false);
  });

  it('submits FormData including the selected photo', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderChildForm('create', onSubmit);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText('Birth date'), { target: { value: '2020-01-01' } });
    const photo = new File(['x'], 'photo.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Photo (optional)'), photo);
    await user.click(screen.getByRole('button', { name: 'Create' }));

    const formData = onSubmit.mock.calls[0][0] as FormData;
    expect(formData.get('photo')).toBe(photo);
  });

  it('shows the mapped error message when onSubmit rejects with a 400', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(400, {}));
    const user = userEvent.setup();
    renderChildForm('create', onSubmit);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText('Birth date'), { target: { value: '2020-01-01' } });
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't save your changes. Please check the name, birth date, and photo.",
    );
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
  });

  it('clears a field-level error as soon as the user edits that field', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderChildForm('create', onSubmit);

    fireEvent.change(screen.getByLabelText('Birth date'), { target: { value: '2020-01-01' } });
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByText('Please enter a name.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Name'), 'Alex');

    expect(screen.queryByText('Please enter a name.')).not.toBeInTheDocument();
  });

  it('disables the submit button and shows pending text while onSubmit is in flight', async () => {
    let resolveSubmit: () => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const user = userEvent.setup();
    renderChildForm('create', onSubmit);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText('Birth date'), { target: { value: '2020-01-01' } });
    await user.click(screen.getByRole('button', { name: 'Create' }));

    const pendingButton = await screen.findByRole('button', { name: 'Creating…' });
    expect(pendingButton).toBeDisabled();

    resolveSubmit!();
  });
});

describe('ChildForm (edit mode)', () => {
  const initialValues: ChildFormInitialValuesArg = {
    name: 'Alex',
    birthDate: '2020-01-01',
    childId: 'c1',
    householdId: 'h1',
    hasPhoto: false,
  };

  it('pre-fills the name and birth date fields from initialValues', () => {
    renderChildForm('edit', vi.fn(), initialValues);

    expect(screen.getByLabelText('Name')).toHaveValue('Alex');
    expect(screen.getByLabelText('Birth date')).toHaveValue('2020-01-01');
  });

  it('renders the save submit button text', () => {
    renderChildForm('edit', vi.fn(), initialValues);

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('shows the "add photo" placeholder when the child has no existing photo', () => {
    renderChildForm('edit', vi.fn(), initialValues);

    expect(screen.getByText('Add photo')).toBeInTheDocument();
  });

  it('renders the existing photo via ChildPhoto when the child has one', async () => {
    renderChildForm('edit', vi.fn(), { ...initialValues, hasPhoto: true });

    // Avatar's initials fallback also carries `role="img"` (with the same
    // `name` as its accessible label), so a role query can't tell it apart
    // from the real `<img>` — query by alt text instead, which only the
    // actual image element has (matches the precedent in ChildPhoto.spec.tsx).
    // The image load resolves on a microtask (see stubImageLoading), so this
    // must await: on the first synchronous check, only the fallback exists.
    const img = (await screen.findByAltText('Alex')) as HTMLImageElement;
    expect(img.src).toContain('/children/c1/photo');
  });
});

describe('ChildForm photo dropzone', () => {
  it('shows the "add photo" placeholder when creating with no photo selected', () => {
    renderChildForm('create', vi.fn());

    expect(screen.getByText('Add photo')).toBeInTheDocument();
  });

  it('replaces the placeholder with a preview once a photo is selected', async () => {
    const user = userEvent.setup();
    const { container } = renderChildForm('create', vi.fn());

    const photo = new File(['x'], 'photo.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Photo (optional)'), photo);

    expect(screen.queryByText('Add photo')).not.toBeInTheDocument();
    // Decorative preview (`alt=""`), so queried directly rather than via role.
    expect(container.querySelector('label[for="child-photo"] img')).toBeInTheDocument();
  });
});
