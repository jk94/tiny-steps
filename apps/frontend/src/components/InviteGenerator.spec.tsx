import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { InviteGenerator } from './InviteGenerator';
import * as householdApi from '../api/household-api';
import { ApiError } from '../api/http-client';
import { queryClient } from '../lib/query-client';

vi.mock('../api/household-api');

const mockedHouseholdApi = vi.mocked(householdApi);

function renderInviteGenerator(role: 'OWNER' | 'CO_PARENT') {
  return render(
    <QueryClientProvider client={queryClient}>
      <InviteGenerator householdId="h1" role={role} />
    </QueryClientProvider>,
  );
}

describe('InviteGenerator', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('renders nothing for a CO_PARENT', () => {
    const { container } = renderInviteGenerator('CO_PARENT');

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the generate button for an OWNER', () => {
    renderInviteGenerator('OWNER');

    expect(screen.getByRole('button', { name: 'Generate invite link' })).toBeInTheDocument();
  });

  it('generates an invite and displays the link + expiry on success', async () => {
    mockedHouseholdApi.createInvite.mockResolvedValueOnce({
      token: 'raw-token-123',
      expiresAt: '2026-01-08T00:00:00.000Z',
    });
    const user = userEvent.setup();
    renderInviteGenerator('OWNER');

    await user.click(screen.getByRole('button', { name: 'Generate invite link' }));

    const linkInput = await screen.findByLabelText('Invite link');
    expect(linkInput).toHaveValue(`${window.location.origin}/invites/raw-token-123`);
  });

  it('copies the invite link to the clipboard and shows a confirmation', async () => {
    mockedHouseholdApi.createInvite.mockResolvedValueOnce({
      token: 'raw-token-123',
      expiresAt: '2026-01-08T00:00:00.000Z',
    });
    // `userEvent.setup()` installs its own Clipboard API stub on
    // `navigator.clipboard` (jsdom has no real implementation) — spy on its
    // `writeText` rather than replacing the object ourselves, since `setup()`
    // unconditionally overwrites whatever's there.
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');
    renderInviteGenerator('OWNER');

    await user.click(screen.getByRole('button', { name: 'Generate invite link' }));
    await screen.findByLabelText('Invite link');
    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    expect(writeTextSpy).toHaveBeenCalledWith(`${window.location.origin}/invites/raw-token-123`);
    expect(await screen.findByText('Copied!')).toBeInTheDocument();
  });

  it('shows an error message instead of the confirmation when the clipboard write fails', async () => {
    mockedHouseholdApi.createInvite.mockResolvedValueOnce({
      token: 'raw-token-123',
      expiresAt: '2026-01-08T00:00:00.000Z',
    });
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(
      new Error('Clipboard permission denied'),
    );
    renderInviteGenerator('OWNER');

    await user.click(screen.getByRole('button', { name: 'Generate invite link' }));
    const linkInput = await screen.findByLabelText('Invite link');
    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    expect(
      await screen.findByText('Copy failed. Please copy the link manually.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
    // The link stays visible/selectable as the manual-copy fallback.
    expect(linkInput).toHaveValue(`${window.location.origin}/invites/raw-token-123`);
  });

  it('shows a mapped error message when generating an invite fails', async () => {
    mockedHouseholdApi.createInvite.mockRejectedValueOnce(new ApiError(403, {}));
    const user = userEvent.setup();
    renderInviteGenerator('OWNER');

    await user.click(screen.getByRole('button', { name: 'Generate invite link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only the household owner can perform this action.',
    );
  });
});
