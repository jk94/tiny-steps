import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('renders header, body, and footer content', () => {
    render(
      <Card>
        <Card.Header>Last feeding</Card.Header>
        <Card.Body>2 hours ago</Card.Body>
        <Card.Footer>
          <button type="button">Details</button>
        </Card.Footer>
      </Card>,
    );

    expect(screen.getByText('Last feeding')).toBeInTheDocument();
    expect(screen.getByText('2 hours ago')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
  });

  it('spreads native attributes onto the root', () => {
    render(
      <Card data-testid="stat-card" aria-label="Statistics">
        <Card.Body>content</Card.Body>
      </Card>,
    );
    expect(screen.getByTestId('stat-card')).toHaveAttribute('aria-label', 'Statistics');
  });

  it('lets a consumer className win over the default surface classes', () => {
    render(
      <Card data-testid="stat-card" className="rounded-none bg-muted">
        <Card.Body>content</Card.Body>
      </Card>,
    );
    const card = screen.getByTestId('stat-card');
    expect(card).toHaveClass('rounded-none', 'bg-muted');
    expect(card).not.toHaveClass('rounded-lg', 'bg-card');
  });
});
