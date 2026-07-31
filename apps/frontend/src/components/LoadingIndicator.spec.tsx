import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingIndicator } from './LoadingIndicator';

describe('LoadingIndicator', () => {
  it('renders a loading message', () => {
    render(<LoadingIndicator />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });
});
