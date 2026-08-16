import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the generic translated title when none is provided', () => {
    render(<EmptyState />);
    // Test language is pinned to English (see src/test/setup.ts).
    expect(screen.getByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument();
  });

  it('renders a custom title and description', () => {
    render(<EmptyState title="No feedings yet" description="Log the first one to see it here." />);
    expect(screen.getByRole('heading', { name: 'No feedings yet' })).toBeInTheDocument();
    expect(screen.getByText('Log the first one to see it here.')).toBeInTheDocument();
  });

  it('renders an action slot', () => {
    render(<EmptyState action={<button type="button">Add child</button>} />);
    expect(screen.getByRole('button', { name: 'Add child' })).toBeInTheDocument();
  });
});
