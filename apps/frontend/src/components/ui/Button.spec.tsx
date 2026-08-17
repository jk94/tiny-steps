import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it.each(['primary', 'secondary', 'ghost', 'destructive'] as const)(
    'renders the %s variant without throwing',
    (variant) => {
      render(<Button variant={variant}>Save</Button>);
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    },
  );

  it('fires onClick when clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Save</Button>);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('blocks interaction and marks aria-busy while loading', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button isLoading onClick={onClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('svg')).not.toBeNull();

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('respects an explicit disabled prop', () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('forwards its ref to the underlying button element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Save</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  describe('asChild', () => {
    it('renders the child element with the button styling merged in', () => {
      render(
        <Button asChild variant="ghost" className="custom">
          <a href="/households">Households</a>
        </Button>,
      );

      const link = screen.getByRole('link', { name: 'Households' });
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(link).toHaveClass('custom', 'inline-flex');
      expect(link).toHaveAttribute('data-slot', 'button');
    });

    it('mirrors the loading state onto aria-disabled, since a link ignores `disabled`', () => {
      render(
        <Button asChild isLoading>
          <a href="/households">Households</a>
        </Button>,
      );

      const link = screen.getByRole('link', { name: 'Households' });
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link).toHaveAttribute('aria-busy', 'true');
      expect(link).not.toHaveAttribute('disabled');
      expect(link.querySelector('svg')).not.toBeNull();
    });
  });
});
