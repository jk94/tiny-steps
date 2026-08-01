import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchOidcProviders } from '../api/oidc-api';

const OIDC_PROVIDERS_QUERY_KEY = ['auth', 'oidc', 'providers'] as const;

/**
 * Renders one login link per configured OIDC provider, or nothing while
 * loading, on error, or when no providers are configured. Each link is a
 * plain `<a href>` navigation (not routed through `apiFetch`) — the login
 * endpoint is a 302 redirect to the IdP that also sets an httpOnly cookie,
 * which only works as a real browser navigation.
 */
export function OidcProviderButtons() {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: OIDC_PROVIDERS_QUERY_KEY,
    queryFn: fetchOidcProviders,
    retry: false,
    // The provider list is static server config loaded once at backend
    // startup; treat it as immutable for the page lifetime to avoid
    // redundant refetches whenever Login/Register remounts.
    staleTime: Infinity,
  });

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="oidc-provider-buttons">
      <p>{t('auth.oidc.dividerLabel')}</p>
      {data.map((provider) => (
        <a key={provider.id} href={`/api/auth/oidc/${provider.id}/login`}>
          {t('auth.oidc.continueWithProvider', { provider: provider.displayName })}
        </a>
      ))}
    </div>
  );
}
