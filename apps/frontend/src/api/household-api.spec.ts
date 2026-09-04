import { afterEach, describe, expect, it, vi } from 'vitest';
import * as httpClient from './http-client';
import {
  changeMemberRole,
  createHousehold,
  createInvite,
  fetchHousehold,
  listHouseholdMembers,
  listHouseholds,
  removeMember,
} from './household-api';

const MEMBER = {
  userId: 'user-1',
  email: 'parent@example.com',
  name: 'Alex',
  role: 'CO_PARENT' as const,
  joinedAt: '2026-01-01T00:00:00.000Z',
};

vi.mock('./http-client', async () => {
  const actual = await vi.importActual<typeof httpClient>('./http-client');
  return { ...actual, apiFetch: vi.fn() };
});

const mockedApiFetch = vi.mocked(httpClient.apiFetch);

describe('household-api', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('createHousehold POSTs the name to /households', async () => {
    const household = {
      id: '1',
      name: 'Team Müller',
      role: 'OWNER' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    mockedApiFetch.mockResolvedValueOnce(household);

    const result = await createHousehold('Team Müller');

    expect(mockedApiFetch).toHaveBeenCalledWith('/households', {
      method: 'POST',
      body: { name: 'Team Müller' },
    });
    expect(result).toEqual(household);
  });

  it('listHouseholds GETs /households', async () => {
    const households = [
      {
        id: '1',
        name: 'Team Müller',
        role: 'OWNER' as const,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    mockedApiFetch.mockResolvedValueOnce(households);

    const result = await listHouseholds();

    expect(mockedApiFetch).toHaveBeenCalledWith('/households');
    expect(result).toEqual(households);
  });

  it('fetchHousehold GETs /households/:householdId', async () => {
    const household = {
      id: '1',
      name: 'Team Müller',
      role: 'CO_PARENT' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    mockedApiFetch.mockResolvedValueOnce(household);

    const result = await fetchHousehold('1');

    expect(mockedApiFetch).toHaveBeenCalledWith('/households/1');
    expect(result).toEqual(household);
  });

  it('createInvite POSTs to /households/:householdId/invites', async () => {
    const invite = { token: 'raw-token', expiresAt: '2026-01-08T00:00:00.000Z' };
    mockedApiFetch.mockResolvedValueOnce(invite);

    const result = await createInvite('1');

    expect(mockedApiFetch).toHaveBeenCalledWith('/households/1/invites', {
      method: 'POST',
      body: undefined,
    });
    expect(result).toEqual(invite);
  });

  it('createInvite sends the requested role when one is given', async () => {
    mockedApiFetch.mockResolvedValueOnce({ token: 'raw-token', expiresAt: '2026-01-08' });

    await createInvite('1', 'OBSERVER');

    expect(mockedApiFetch).toHaveBeenCalledWith('/households/1/invites', {
      method: 'POST',
      body: { role: 'OBSERVER' },
    });
  });

  it('listHouseholdMembers GETs /households/:householdId/members', async () => {
    mockedApiFetch.mockResolvedValueOnce([MEMBER]);

    const result = await listHouseholdMembers('1');

    expect(mockedApiFetch).toHaveBeenCalledWith('/households/1/members');
    expect(result).toEqual([MEMBER]);
  });

  it('changeMemberRole PATCHes the role to /households/:householdId/members/:userId', async () => {
    const updated = { ...MEMBER, role: 'CAREGIVER' as const };
    mockedApiFetch.mockResolvedValueOnce(updated);

    const result = await changeMemberRole('1', 'user-1', 'CAREGIVER');

    expect(mockedApiFetch).toHaveBeenCalledWith('/households/1/members/user-1', {
      method: 'PATCH',
      body: { role: 'CAREGIVER' },
    });
    expect(result).toEqual(updated);
  });

  it('removeMember DELETEs /households/:householdId/members/:userId', async () => {
    mockedApiFetch.mockResolvedValueOnce(undefined);

    await removeMember('1', 'user-1');

    expect(mockedApiFetch).toHaveBeenCalledWith('/households/1/members/user-1', {
      method: 'DELETE',
    });
  });
});
