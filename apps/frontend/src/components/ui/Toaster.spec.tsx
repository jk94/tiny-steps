import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { stubPopupLayoutApis } from '../../test/stubPopupLayoutApis';
import { Toaster } from './Toaster';

// Sonner puts a pointer-capture-based swipe handler on every toast, which
// jsdom cannot satisfy — see the helper's doc comment.
stubPopupLayoutApis();

afterEach(() => {
  // Sonner's queue is module-level state, so it outlives RTL's cleanup.
  act(() => {
    toast.dismiss();
  });
});

/** The rendered `<li>` for a toast carrying the given text. */
function toastElementFor(text: string): HTMLElement {
  const element = screen.getByText(text).closest('[data-sonner-toast]');
  if (!(element instanceof HTMLElement)) {
    throw new Error(`No toast found for "${text}"`);
  }
  return element;
}

describe('Toaster', () => {
  it('renders a toast with its title and description', async () => {
    render(<Toaster />);

    act(() => {
      toast('Saved', { description: 'Your entry was saved.' });
    });

    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Your entry was saved.')).toBeInTheDocument();
  });

  it('distinguishes the success and error variants', async () => {
    render(<Toaster />);

    act(() => {
      toast.success('Entry saved');
      toast.error('Save failed');
    });

    expect(await screen.findByText('Entry saved')).toBeInTheDocument();
    expect(toastElementFor('Entry saved')).toHaveAttribute('data-type', 'success');
    expect(toastElementFor('Save failed')).toHaveAttribute('data-type', 'error');
  });

  it('announces toasts through a single translated, polite live region', async () => {
    render(<Toaster />);

    act(() => {
      toast('Saved');
    });
    expect(await screen.findByText('Saved')).toBeInTheDocument();

    const liveRegion = screen.getByLabelText(/Notifications/);
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toContainElement(toastElementFor('Saved'));
  });

  it('dismisses a toast via the button carrying the translated accessible label', async () => {
    const user = userEvent.setup();
    render(<Toaster />);

    act(() => {
      toast('Saved');
    });
    expect(await screen.findByText('Saved')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));

    // Sonner keeps the node mounted for its exit animation, so the removal is
    // observable as a data attribute rather than an unmount.
    await waitFor(() => {
      expect(toastElementFor('Saved')).toHaveAttribute('data-removed', 'true');
    });
  });

  it('bridges the design tokens onto Sonner’s CSS custom properties', async () => {
    const { baseElement } = render(<Toaster />);
    // Sonner only mounts its styled container once there is something to show.
    act(() => {
      toast('Saved');
    });
    expect(await screen.findByText('Saved')).toBeInTheDocument();

    const style = baseElement.querySelector('[data-sonner-toaster]')?.getAttribute('style') ?? '';
    expect(style).toContain('--normal-bg: var(--rt-color-popover)');
    expect(style).toContain('--success-border: var(--rt-color-success)');
    expect(style).toContain('--error-border: var(--rt-color-destructive)');
  });
});
