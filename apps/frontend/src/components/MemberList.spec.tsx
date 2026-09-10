import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemberList } from './MemberList';
import * as householdApi from '../api/household-api';
import * as useAuthModule from '../auth/useAuth';
import { ApiError } from '../api/http-client';
import { queryClient } from '../lib/query-client';
import type { HouseholdRole } from '../lib/householdPermissions';
import { stubPopupLayoutApis } from '../test/stubPopupLayoutApis';

vi.mock('../api/household-api');
vi.mock('../auth/useAuth');

// The role picker is a Radix `Select`, whose popper needs layout/pointer APIs
// jsdom doesn't implement.
stubPopupLayoutApis();

const mockedHouseholdApi = vi.mocked(householdApi);
const mockedUseAuth = vi.mocked(useAuthModule.useAuth);

const VIEWER_ID = 'me';

const OWNER_MEMBER = {
  userId: VIEWER_ID,
  email: 'owner@example.com',
  name: 'Alex Owner',
  role: 'OWNER' as const,
  joinedAt: '2026-01-01T00:00:00.000Z',
};

const OTHER_MEMBER = {
  userId: 'u2',
  email: 'sam@example.com',
  name: 'Sam Sitter',
  role: 'CO_PARENT' as const,
  joinedAt: '2026-02-01T00:00:00.000Z',
};

function mockViewer(userId: string | undefined = VIEWER_ID) {
  mockedUseAuth.mockReturnValue({
    user: userId
      ? {
          id: userId,
          email: 'owner@example.com',
          name: 'Alex Owner',
          createdAt: '2026-01-01T00:00:00.000Z',
        }
      : null,
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateName: vi.fn(),
  });
}

function renderMemberList(role: HouseholdRole = 'OWNER') {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberList householdId="h1" role={role} />
    </QueryClientProvider>,
  );
}

/** The row of the member who is not the viewer, i.e. the manageable one. */
async function findOtherMemberRow() {
  const name = await screen.findByText('Sam Sitter');
  return name.closest('li') as HTMLElement;
}

describe('MemberList', () => {
  beforeEach(() => {
    queryClient.clear();
    mockViewer();
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValue([OWNER_MEMBER, OTHER_MEMBER]);
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('shows the loading skeleton while the members query is in flight', () => {
    mockedHouseholdApi.listHouseholdMembers.mockReturnValue(new Promise(() => {}));

    renderMemberList();

    expect(document.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it('shows an empty state when the household has no members', async () => {
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValue([]);

    renderMemberList();

    expect(await screen.findByText('No members found.')).toBeInTheDocument();
  });

  it('renders each member with their name, email and role badge', async () => {
    renderMemberList();

    const row = await findOtherMemberRow();
    expect(within(row).getByText('sam@example.com')).toBeInTheDocument();
    expect(within(row).getByText(/Member since/)).toBeInTheDocument();
    // Scoped to the badge: the role picker's trigger renders the same label.
    expect(row.querySelector('[data-slot="badge"]')).toHaveTextContent('Member');
  });

  it('falls back to the email as the display name when a member has none', async () => {
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValue([{ ...OTHER_MEMBER, name: null }]);

    renderMemberList();

    expect(await screen.findByText('sam@example.com')).toBeInTheDocument();
  });

  it('hides the management controls from a non-owner', async () => {
    renderMemberList('CO_PARENT');

    await screen.findByText('Sam Sitter');
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Role' })).not.toBeInTheDocument();
  });

  it("hides the management controls on the owner's own row", async () => {
    renderMemberList();

    const ownRow = (await screen.findByText('Alex Owner')).closest('li') as HTMLElement;
    expect(within(ownRow).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(within(ownRow).queryByRole('combobox', { name: 'Role' })).not.toBeInTheDocument();
  });

  it('offers the management controls to an owner on every other row', async () => {
    renderMemberList();

    const row = await findOtherMemberRow();
    expect(within(row).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(within(row).getByRole('combobox', { name: 'Role' })).toBeInTheDocument();
  });

  it('asks for confirmation before removing a member, and only then calls the API', async () => {
    mockedHouseholdApi.removeMember.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderMemberList();

    const row = await findOtherMemberRow();
    await user.click(within(row).getByRole('button', { name: 'Remove' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Sam Sitter loses access/)).toBeInTheDocument();
    expect(mockedHouseholdApi.removeMember).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    expect(mockedHouseholdApi.removeMember).toHaveBeenCalledWith('h1', 'u2');
  });

  it('keeps the member when the removal is cancelled', async () => {
    const user = userEvent.setup();
    renderMemberList();

    const row = await findOtherMemberRow();
    await user.click(within(row).getByRole('button', { name: 'Remove' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }),
    );

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockedHouseholdApi.removeMember).not.toHaveBeenCalled();
  });

  it('warns more sharply when the new role takes permissions away', async () => {
    const user = userEvent.setup();
    renderMemberList();

    const row = await findOtherMemberRow();
    await user.click(within(row).getByRole('combobox', { name: 'Role' }));
    await user.click(await screen.findByRole('option', { name: 'Viewer' }));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/will get the "Viewer" role and lose permissions/),
    ).toBeInTheDocument();
    expect(mockedHouseholdApi.changeMemberRole).not.toHaveBeenCalled();
  });

  it('confirms a promotion too, without the demotion warning', async () => {
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValue([
      OWNER_MEMBER,
      { ...OTHER_MEMBER, role: 'OBSERVER' },
    ]);
    const user = userEvent.setup();
    renderMemberList();

    const row = await findOtherMemberRow();
    await user.click(within(row).getByRole('combobox', { name: 'Role' }));
    await user.click(await screen.findByRole('option', { name: 'Carer' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Sam Sitter will get the "Carer" role.')).toBeInTheDocument();
  });

  it('offers OWNER as a target role, unlike an invite link', async () => {
    const user = userEvent.setup();
    renderMemberList();

    const row = await findOtherMemberRow();
    await user.click(within(row).getByRole('combobox', { name: 'Role' }));

    const ownerOption = await screen.findByRole('option', { name: 'Owner' });
    expect(ownerOption).toBeInTheDocument();
    expect(ownerOption).not.toHaveAttribute('data-disabled');
  });

  it('hands over ownership, explaining what the new owner gains', async () => {
    mockedHouseholdApi.changeMemberRole.mockResolvedValueOnce({
      ...OTHER_MEMBER,
      role: 'OWNER',
    });
    const user = userEvent.setup();
    renderMemberList();

    const row = await findOtherMemberRow();
    await user.click(within(row).getByRole('combobox', { name: 'Role' }));
    await user.click(await screen.findByRole('option', { name: 'Owner' }));

    const dialog = await screen.findByRole('dialog');
    // A promotion, so no demotion warning — but the added administration
    // rights are spelled out.
    expect(
      within(dialog).getByText(/able to manage members and the household/),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/lose permissions/)).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Change role' }));

    expect(mockedHouseholdApi.changeMemberRole).toHaveBeenCalledWith('h1', 'u2', 'OWNER');
  });

  it('changes the role and refreshes the list once confirmed', async () => {
    mockedHouseholdApi.changeMemberRole.mockResolvedValueOnce({
      ...OTHER_MEMBER,
      role: 'CAREGIVER',
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();
    renderMemberList();

    const row = await findOtherMemberRow();
    await user.click(within(row).getByRole('combobox', { name: 'Role' }));
    await user.click(await screen.findByRole('option', { name: 'Carer' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Change role' }),
    );

    expect(mockedHouseholdApi.changeMemberRole).toHaveBeenCalledWith('h1', 'u2', 'CAREGIVER');
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['households', 'h1', 'members'] }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('surfaces the last-owner conflict instead of a generic failure', async () => {
    mockedHouseholdApi.changeMemberRole.mockRejectedValueOnce(
      new ApiError(409, { code: 'LAST_OWNER_CANNOT_BE_DEMOTED' }),
    );
    const user = userEvent.setup();
    renderMemberList();

    const row = await findOtherMemberRow();
    await user.click(within(row).getByRole('combobox', { name: 'Role' }));
    await user.click(await screen.findByRole('option', { name: 'Viewer' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Change role' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "This is the household's last owner. Make someone else an owner first.",
    );
    // The confirmation must be gone: it is a modal that `aria-hidden`s the
    // page, so an error left behind it would be unreadable.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('drops a previous failure when the next action is started', async () => {
    mockedHouseholdApi.changeMemberRole.mockRejectedValueOnce(new ApiError(500, {}));
    const user = userEvent.setup();
    renderMemberList();

    const row = await findOtherMemberRow();
    await user.click(within(row).getByRole('combobox', { name: 'Role' }));
    await user.click(await screen.findByRole('option', { name: 'Viewer' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Change role' }),
    );
    await screen.findByRole('alert');

    await user.click(within(row).getByRole('button', { name: 'Remove' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('surfaces a failed removal', async () => {
    mockedHouseholdApi.removeMember.mockRejectedValueOnce(
      new ApiError(409, { code: 'LAST_OWNER_CANNOT_BE_REMOVED' }),
    );
    const user = userEvent.setup();
    renderMemberList();

    const row = await findOtherMemberRow();
    await user.click(within(row).getByRole('button', { name: 'Remove' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "This is the household's last owner. Make someone else an owner first.",
    );
  });
});
