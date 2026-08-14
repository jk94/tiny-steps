import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { ConflictNoticeBanner } from './ConflictNoticeBanner';
import { recordConflictNotice } from '../offline/conflictNotices';
import { queryClient } from '../lib/query-client';

function renderBanner() {
  return render(
    <QueryClientProvider client={queryClient}>
      <ConflictNoticeBanner />
    </QueryClientProvider>,
  );
}

describe('ConflictNoticeBanner', () => {
  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('renders nothing when there are no conflict notices', () => {
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a notice recorded via recordConflictNotice', async () => {
    renderBanner();

    recordConflictNotice('FEEDING', 'server-1');

    expect(
      await screen.findByText(
        'Your change was overridden because this entry was updated elsewhere in the meantime.',
      ),
    ).toBeInTheDocument();
  });

  it('dismisses a notice when its close button is clicked', async () => {
    const user = userEvent.setup();
    renderBanner();
    recordConflictNotice('SLEEP', 'server-2');
    const message = await screen.findByText(
      'Your change was overridden because this entry was updated elsewhere in the meantime.',
    );
    expect(message).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss notice' }));

    expect(
      screen.queryByText(
        'Your change was overridden because this entry was updated elsewhere in the meantime.',
      ),
    ).not.toBeInTheDocument();
  });

  it('collapses repeated conflicts for the same event into a single notice', async () => {
    renderBanner();

    recordConflictNotice('DIAPER', 'server-3');
    recordConflictNotice('DIAPER', 'server-3');

    expect(await screen.findAllByRole('button', { name: 'Dismiss notice' })).toHaveLength(1);
  });
});
