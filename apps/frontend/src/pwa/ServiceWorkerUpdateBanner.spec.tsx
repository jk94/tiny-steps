import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceWorkerUpdateBanner } from './ServiceWorkerUpdateBanner';

const mockSetNeedRefresh = vi.fn();
const mockUpdateServiceWorker = vi.fn().mockResolvedValue(undefined);
let needRefresh = false;

// vite-plugin-pwa's Vite plugin resolves this virtual module at dev/build
// time only — it doesn't exist under Vitest, so it must be mocked (see
// vite-plugin-pwa's own source, which explicitly notes this).
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [needRefresh, mockSetNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: mockUpdateServiceWorker,
  }),
}));

describe('ServiceWorkerUpdateBanner', () => {
  beforeEach(() => {
    needRefresh = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no update is pending', () => {
    render(<ServiceWorkerUpdateBanner />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the update prompt when needRefresh is true', () => {
    needRefresh = true;

    render(<ServiceWorkerUpdateBanner />);

    expect(screen.getByText('A new version is available.')).toBeInTheDocument();
  });

  it('calls updateServiceWorker(true) when Reload is clicked', async () => {
    needRefresh = true;
    const user = userEvent.setup();

    render(<ServiceWorkerUpdateBanner />);
    await user.click(screen.getByRole('button', { name: 'Reload' }));

    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('dismisses without updating when Dismiss is clicked', async () => {
    needRefresh = true;
    const user = userEvent.setup();

    render(<ServiceWorkerUpdateBanner />);
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(mockSetNeedRefresh).toHaveBeenCalledWith(false);
    expect(mockUpdateServiceWorker).not.toHaveBeenCalled();
  });
});
