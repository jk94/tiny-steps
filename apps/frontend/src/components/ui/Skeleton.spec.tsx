import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('is decorative — always aria-hidden and exposes no role', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el).not.toHaveAttribute('role');
  });

  it('defaults to the rect shape', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass('rounded-md');
  });

  it('applies the shape variant class', () => {
    const { container } = render(<Skeleton shape="circle" />);
    expect(container.firstChild).toHaveClass('rounded-full');
    expect(container.firstChild).not.toHaveClass('rounded-md');
  });

  it('merges consumer sizing className', () => {
    const { container } = render(<Skeleton className="h-8 w-32" />);
    expect(container.firstChild).toHaveClass('h-8', 'w-32');
  });
});
