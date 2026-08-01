import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { OidcProviderButtons } from './OidcProviderButtons';
import * as oidcApi from '../api/oidc-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/oidc-api');

const mockedOidcApi = vi.mocked(oidcApi);

function renderOidcProviderButtons() {
  return render(
    <QueryClientProvider client={queryClient}>
      <OidcProviderButtons />
    </QueryClientProvider>,
  );
}

describe('OidcProviderButtons', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('renders nothing while the providers query is loading', () => {
    mockedOidcApi.fetchOidcProviders.mockReturnValue(new Promise(() => {}));

    const { container } = renderOidcProviderButtons();

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing (and no divider) when zero providers are configured', async () => {
    mockedOidcApi.fetchOidcProviders.mockResolvedValueOnce([]);

    const { container } = renderOidcProviderButtons();

    await waitFor(() => expect(mockedOidcApi.fetchOidcProviders).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the providers fetch is rejected', async () => {
    mockedOidcApi.fetchOidcProviders.mockRejectedValueOnce(new Error('network error'));

    const { container } = renderOidcProviderButtons();

    await waitFor(() => expect(mockedOidcApi.fetchOidcProviders).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a divider once plus one correctly-labeled link per provider', async () => {
    mockedOidcApi.fetchOidcProviders.mockResolvedValueOnce([
      { id: 'keycloak', displayName: 'Keycloak' },
      { id: 'google', displayName: 'Google' },
    ]);

    renderOidcProviderButtons();

    const keycloakLink = await screen.findByRole('link', { name: 'Continue with Keycloak' });
    expect(keycloakLink).toHaveAttribute('href', '/api/auth/oidc/keycloak/login');

    const googleLink = screen.getByRole('link', { name: 'Continue with Google' });
    expect(googleLink).toHaveAttribute('href', '/api/auth/oidc/google/login');

    expect(screen.getAllByText('or continue with')).toHaveLength(1);
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });
});
