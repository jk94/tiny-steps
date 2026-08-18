import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders its children text', () => {
    render(<Badge>Saving…</Badge>);
    expect(screen.getByText('Saving…')).toBeInTheDocument();
  });

  it.each([
    'default',
    'success',
    'warning',
    'destructive',
    'feeding',
    'feeding-breast',
    'feeding-bottle',
    'feeding-solid',
    'sleep',
    'diaper',
    'diaper-pee',
    'diaper-stool',
    'diaper-both',
  ] as const)('renders the %s variant without throwing', (variant) => {
    render(<Badge variant={variant}>label</Badge>);
    expect(screen.getByText('label')).toBeInTheDocument();
  });

  it('is purely presentational — never exposes an interactive role', () => {
    render(<Badge variant="destructive">Not saved</Badge>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('merges a consumer-provided className over its defaults', () => {
    render(<Badge className="px-8">label</Badge>);
    expect(screen.getByText('label')).toHaveClass('px-8');
  });
});
