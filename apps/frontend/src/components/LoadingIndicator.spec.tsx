import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { LoadingIndicator } from './LoadingIndicator';
import i18n from '../i18n';

describe('LoadingIndicator', () => {
  it('renders a loading message', () => {
    render(<LoadingIndicator />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders the German loading message when German is active', async () => {
    await i18n.changeLanguage('de');

    render(<LoadingIndicator />);

    expect(screen.getByText('Lädt…')).toBeInTheDocument();
  });

  it('re-renders with the new language on a live language switch, without remounting', async () => {
    render(<LoadingIndicator />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();

    await act(() => i18n.changeLanguage('de'));

    expect(screen.getByText('Lädt…')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });
});
