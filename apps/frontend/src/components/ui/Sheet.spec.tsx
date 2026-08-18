import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sheet } from './Sheet';

function renderSheet(isOpen: boolean, props: Partial<Parameters<typeof Sheet>[0]> = {}) {
  const onOpenChange = props.onOpenChange ?? vi.fn();
  const utils = render(
    <Sheet isOpen={isOpen} aria-label="Main menu" {...props} onOpenChange={onOpenChange}>
      <a href="/">Dashboard</a>
      <button type="button">Log out</button>
    </Sheet>,
  );
  return { ...utils, onOpenChange };
}

describe('Sheet', () => {
  it('renders nothing while closed', () => {
    renderSheet(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('renders its children in a portaled dialog when opened', () => {
    renderSheet(true);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('names itself from aria-label', () => {
    renderSheet(true);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Main menu');
  });

  it('moves focus into the panel on open (focus trap)', () => {
    renderSheet(true);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('calls onOpenChange(false) when the close button is clicked', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderSheet(true);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) on ESC', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderSheet(true);

    await user.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // Deliberately the opposite of `Dialog`, which never dismisses on an
  // outside click — see the Sheet doc comment for why.
  it('dismisses when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderSheet(true);

    const overlay = document.querySelector('[data-slot="sheet-overlay"]');
    expect(overlay).not.toBeNull();
    await user.click(overlay as Element);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('anchors the panel to the right edge', () => {
    renderSheet(true);

    const panel = screen.getByRole('dialog');
    expect(panel).toHaveAttribute('data-side', 'right');
    expect(panel.className).toContain('right-0');
    expect(panel.className).toContain('inset-y-0');
  });

  // Keyframe animations, not a CSS transition: Radix's Presence defers
  // unmounting only for an `animationend` event, so a transition-based exit
  // would be cut off before it could play. jsdom applies no stylesheets, so
  // this asserts the wiring (classes + gating attribute), not the playback.
  it('drives its slide from data-state-gated keyframe animations', () => {
    renderSheet(true);

    const panel = screen.getByRole('dialog');
    expect(panel).toHaveAttribute('data-state', 'open');
    expect(panel.className).toContain('data-[state=open]:animate-slide-in-from-right');
    expect(panel.className).toContain('data-[state=closed]:animate-slide-out-to-right');
    expect(panel.className).not.toContain('transition-transform');
  });

  it('unmounts the panel when isOpen goes back to false', () => {
    const { rerender } = renderSheet(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    rerender(
      <Sheet isOpen={false} onOpenChange={vi.fn()} aria-label="Main menu">
        <a href="/">Dashboard</a>
      </Sheet>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
