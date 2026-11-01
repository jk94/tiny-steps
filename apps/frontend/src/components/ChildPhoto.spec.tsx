import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChildPhoto } from './ChildPhoto';
import { bumpPhotoCacheBust, getPhotoCacheBust } from '../child/childPhotoCacheBust';
import { stubImageLoading } from '../test/stubImageLoading';

// `Avatar` (and therefore `ChildPhoto`) only commits the `<img>` once the
// browser reports it as decoded — see the helper's doc comment.
stubImageLoading();

describe('ChildPhoto', () => {
  it('renders initials as an accessible placeholder (no <img>) when hasPhoto is false', () => {
    render(<ChildPhoto childId="c1" householdId="h1" hasPhoto={false} name="Alex" />);

    expect(screen.queryByRole('img', { name: 'Alex' })).toHaveAccessibleName('Alex');
    expect(screen.queryByRole('img')?.tagName).not.toBe('IMG');
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('renders an <img> with the child name as its accessible name when hasPhoto is true', async () => {
    render(<ChildPhoto childId="c1" householdId="h1" hasPhoto={true} name="Alex" />);

    // Query by alt text: the initials fallback is also an accessible `img`, so
    // a role query would match it before the photo has loaded.
    expect((await screen.findByAltText('Alex')).tagName).toBe('IMG');
    expect(screen.getByRole('img', { name: 'Alex' }).tagName).toBe('IMG');
  });

  it('builds the src as a plain path including the current photo cache-bust value', async () => {
    bumpPhotoCacheBust('c1');
    const expectedCacheBust = getPhotoCacheBust('c1');

    render(<ChildPhoto childId="c1" householdId="h1" hasPhoto={true} name="Alex" />);

    expect(await screen.findByAltText('Alex')).toHaveAttribute(
      'src',
      `/api/households/h1/children/c1/photo?v=${expectedCacheBust}`,
    );
  });

  it('shows the baby illustration instead of initials when asked to and there is no photo', () => {
    render(
      <ChildPhoto
        childId="c1"
        householdId="h1"
        hasPhoto={false}
        name="Alex"
        illustrationFallback
      />,
    );

    expect(screen.getByRole('img', { name: 'Alex' })).toBeInTheDocument();
    expect(screen.queryByText('AL')).not.toBeInTheDocument();
    expect(document.querySelector('svg[viewBox="0 0 120 120"]')).not.toBeNull();
  });

  it('still prefers the real photo over the illustration', async () => {
    render(<ChildPhoto childId="c1" householdId="h1" hasPhoto name="Alex" illustrationFallback />);

    expect((await screen.findByAltText('Alex')).tagName).toBe('IMG');
  });
});
