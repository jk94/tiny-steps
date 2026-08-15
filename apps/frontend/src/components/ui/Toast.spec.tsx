import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ToastOptions } from './Toast';
import { ToastProvider } from './ToastProvider';
import { useToast } from './useToast';

function Trigger({ options }: { options: ToastOptions }) {
  const { toast } = useToast();
  return (
    <button type="button" onClick={() => toast(options)}>
      notify
    </button>
  );
}

function renderWithProvider(options: ToastOptions, duration?: number) {
  return render(
    <ToastProvider duration={duration}>
      <Trigger options={options} />
    </ToastProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast / ToastProvider', () => {
  it('enqueues and shows a toast with its title and description', async () => {
    const user = userEvent.setup();
    renderWithProvider({ title: 'Saved', description: 'Your entry was saved.' });

    await user.click(screen.getByRole('button', { name: 'notify' }));

    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Your entry was saved.')).toBeInTheDocument();
  });

  it('uses role="status" for info/success variants', async () => {
    const user = userEvent.setup();
    renderWithProvider({ title: 'Saved', variant: 'success' });

    await user.click(screen.getByRole('button', { name: 'notify' }));

    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });

  it('uses role="alert" for the destructive variant', async () => {
    const user = userEvent.setup();
    renderWithProvider({ title: 'Save failed', variant: 'destructive' });

    await user.click(screen.getByRole('button', { name: 'notify' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Save failed');
  });

  it('removes a toast when its dismiss button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProvider({ title: 'Saved' });

    await user.click(screen.getByRole('button', { name: 'notify' }));
    expect(screen.getByText('Saved')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('auto-dismisses after the configured duration', () => {
    vi.useFakeTimers();
    renderWithProvider({ title: 'Saved' }, 1000);

    fireEvent.click(screen.getByRole('button', { name: 'notify' }));
    expect(screen.getByText('Saved')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('throws when useToast is used outside a ToastProvider', () => {
    function Orphan() {
      useToast();
      return null;
    }
    expect(() => render(<Orphan />)).toThrow('useToast must be used within a ToastProvider');
  });
});
