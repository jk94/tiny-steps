import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChildPhoto } from './ChildPhoto';
import { bumpPhotoCacheBust, getPhotoCacheBust } from '../child/childPhotoCacheBust';

describe('ChildPhoto', () => {
  it('renders initials as an accessible placeholder (no <img>) when hasPhoto is false', () => {
    render(<ChildPhoto childId="c1" householdId="h1" hasPhoto={false} name="Alex" />);

    expect(screen.queryByRole('img', { name: 'Alex' })).toHaveAccessibleName('Alex');
    expect(screen.queryByRole('img')?.tagName).not.toBe('IMG');
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('renders an <img> with the child name as its accessible name when hasPhoto is true', () => {
    render(<ChildPhoto childId="c1" householdId="h1" hasPhoto={true} name="Alex" />);

    expect(screen.getByRole('img', { name: 'Alex' }).tagName).toBe('IMG');
  });

  it('builds the src as a plain path including the current photo cache-bust value', () => {
    bumpPhotoCacheBust('c1');
    const expectedCacheBust = getPhotoCacheBust('c1');

    render(<ChildPhoto childId="c1" householdId="h1" hasPhoto={true} name="Alex" />);

    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      `/api/households/h1/children/c1/photo?v=${expectedCacheBust}`,
    );
  });
});
