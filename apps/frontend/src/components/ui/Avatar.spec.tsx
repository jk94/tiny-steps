import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';

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

  it('renders the image with the name as alt text when src loads', () => {
    render(<Avatar name="Ada Lovelace" src="/photo.jpg" />);
    const img = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('src', '/photo.jpg');
  });

  it('falls back to initials when the image fails to load', () => {
    render(<Avatar name="Ada Lovelace" src="/broken.jpg" />);
    fireEvent.error(screen.getByRole('img', { name: 'Ada Lovelace' }));
    const fallback = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(fallback.tagName).toBe('SPAN');
    expect(fallback).toHaveTextContent('AL');
  });
});
