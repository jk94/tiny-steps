import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { stubImageLoading } from '../../test/stubImageLoading';
import { Avatar } from './Avatar';

// Radix owns the image load/error state machine, which jsdom can't drive on
// its own — see the helper's doc comment.
stubImageLoading();

describe('Avatar', () => {
  it('renders initials from a two-word name when no src is given', () => {
    render(<Avatar name="Ada Lovelace" />);
    const avatar = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(avatar).toHaveTextContent('AL');
  });

  it('renders the first two letters for a single-word name', () => {
    render(<Avatar name="Mila" />);
    expect(screen.getByRole('img', { name: 'Mila' })).toHaveTextContent('MI');
  });

  it('renders the image with the name as alt text once it loads', async () => {
    render(<Avatar name="Ada Lovelace" src="/photo.jpg" />);

    // Query by alt text, not by role: the initials fallback is also an
    // accessible `img`, so a role query would match it before the image swaps in.
    const img = await screen.findByAltText('Ada Lovelace');
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('src', '/photo.jpg');
    expect(screen.queryByText('AL')).not.toBeInTheDocument();
  });

  it('shows the initials fallback while the image is still loading', () => {
    render(<Avatar name="Ada Lovelace" src="/photo.jpg" />);

    const fallback = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(fallback.tagName).toBe('SPAN');
    expect(fallback).toHaveTextContent('AL');
  });

  it('keeps the initials fallback when the image fails to load', async () => {
    render(<Avatar name="Ada Lovelace" src="/broken.jpg" />);
    // Flush the stub's microtask-scheduled `error` event (and React's state
    // update for it) before asserting that no image ever appeared.
    await act(async () => {});

    const fallback = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(fallback.tagName).toBe('SPAN');
    expect(fallback).toHaveTextContent('AL');
    expect(screen.queryByAltText('Ada Lovelace')).not.toBeInTheDocument();
  });
});
