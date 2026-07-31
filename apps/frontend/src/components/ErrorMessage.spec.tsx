import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorMessage } from './ErrorMessage';

describe('ErrorMessage', () => {
  it('renders the given message with an alert role', () => {
    render(<ErrorMessage message="Something went wrong" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });
});
