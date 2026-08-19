import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemberList } from './MemberList';
import * as householdApi from '../api/household-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/household-api');

const mockedHouseholdApi = vi.mocked(householdApi);

function renderMemberList(householdId = 'h1') {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberList householdId={householdId} />
    </QueryClientProvider>,
  );
}

describe('MemberList', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('shows the loading indicator while the members query is in flight', () => {
    mockedHouseholdApi.listHouseholdMembers.mockReturnValue(new Promise(() => {}));

    renderMemberList();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders every member by email once loaded', async () => {
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValueOnce([
      { userId: 'u1', email: 'alex@example.com' },
      { userId: 'u2', email: 'sam@example.com' },
    ]);

    renderMemberList();

    expect(await screen.findByText('alex@example.com')).toBeInTheDocument();
    expect(screen.getByText('sam@example.com')).toBeInTheDocument();
  });

  it('shows an empty state when the household has no members', async () => {
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValueOnce([]);

    renderMemberList();

    expect(await screen.findByText('No members found.')).toBeInTheDocument();
  });
});
