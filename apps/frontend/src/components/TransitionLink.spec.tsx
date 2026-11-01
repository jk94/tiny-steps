import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { TransitionLink } from './TransitionLink';
import * as viewTransition from '../lib/viewTransition';

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

function renderLink() {
  return render(
    <MemoryRouter initialEntries={['/start']}>
      <TransitionLink to="/target">Go</TransitionLink>
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TransitionLink', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is a real link with an href', () => {
    renderLink();

    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', '/target');
  });

  it('navigates normally where view transitions are unavailable', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(viewTransition, 'navigateWithViewTransition');
    renderLink();

    await user.click(screen.getByRole('link', { name: 'Go' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/target');
    expect(spy).not.toHaveBeenCalled();
  });

  it('routes a plain click through a view transition where available', async () => {
    const user = userEvent.setup();
    vi.spyOn(viewTransition, 'canUseViewTransitions').mockReturnValue(true);
    const spy = vi
      .spyOn(viewTransition, 'navigateWithViewTransition')
      .mockImplementation((navigate) => navigate());
    renderLink();

    await user.click(screen.getByRole('link', { name: 'Go' }));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location')).toHaveTextContent('/target');
  });

  it('leaves a modifier click (open in new tab) to the browser', async () => {
    const user = userEvent.setup();
    vi.spyOn(viewTransition, 'canUseViewTransitions').mockReturnValue(true);
    const spy = vi.spyOn(viewTransition, 'navigateWithViewTransition');
    renderLink();

    await user.keyboard('{Control>}');
    await user.click(screen.getByRole('link', { name: 'Go' }));
    await user.keyboard('{/Control}');

    expect(spy).not.toHaveBeenCalled();
  });
});
