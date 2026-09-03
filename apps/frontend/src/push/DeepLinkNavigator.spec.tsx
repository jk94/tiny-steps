import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { DeepLinkNavigator } from './DeepLinkNavigator';
import { resetDeepLinkStore, setPendingDeepLink } from './deepLinkStore';

const TARGET = '/households/h1/children/c1/health/r1/edit';

function renderNavigator() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <DeepLinkNavigator />
      <Routes>
        <Route path="/" element={<p>start</p>} />
        <Route path={TARGET} element={<p>target</p>} />
        <Route path="/households/h1/children/c1/health" element={<p>overview</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DeepLinkNavigator', () => {
  afterEach(() => {
    resetDeepLinkStore();
  });

  it('navigates on a tap that arrives while the app is running', async () => {
    renderNavigator();
    expect(screen.getByText('start')).toBeInTheDocument();

    act(() => setPendingDeepLink(TARGET));

    expect(await screen.findByText('target')).toBeInTheDocument();
  });

  it('drains a tap that was recorded before it mounted (cold start)', async () => {
    // The Capacitor listener lives outside React and fires long before the
    // router exists — the whole reason the store is a module-level slot.
    setPendingDeepLink(TARGET);

    renderNavigator();

    expect(await screen.findByText('target')).toBeInTheDocument();
  });

  it('stays put when nothing is pending', () => {
    renderNavigator();

    expect(screen.getByText('start')).toBeInTheDocument();
  });

  it('consumes the tap, so a later re-render does not navigate again', async () => {
    setPendingDeepLink(TARGET);
    const { unmount } = renderNavigator();
    expect(await screen.findByText('target')).toBeInTheDocument();
    unmount();

    renderNavigator();

    expect(screen.getByText('start')).toBeInTheDocument();
  });

  it('honours only the most recent tap', async () => {
    renderNavigator();

    act(() => setPendingDeepLink('/households/h1/children/c1/health'));
    act(() => setPendingDeepLink(TARGET));

    expect(await screen.findByText('target')).toBeInTheDocument();
  });
});
