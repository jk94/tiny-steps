import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchOidcProviders } from '../api/oidc-api';

const OIDC_PROVIDERS_QUERY_KEY = ['auth', 'oidc', 'providers'] as const;

/**
 * `returnTo` is where the user wanted to go before being sent to log in (the
 * `from` location `ProtectedRoute` passes along, e.g. the Alexa consent page
 * or an invite). The backend only honours same-origin app paths.
 */
function oidcLoginHref(providerId: string, returnTo: string | undefined): string {
  const base = `/api/auth/oidc/${providerId}/login`;
  return returnTo ? `${base}?returnTo=${encodeURIComponent(returnTo)}` : base;
}

/**
 * Renders one login link per configured OIDC provider, or nothing while
 * loading, on error, or when no providers are configured. Each link is a
 * plain `<a href>` navigation (not routed through `apiFetch`) — the login
 * endpoint is a 302 redirect to the IdP that also sets an httpOnly cookie,
 * which only works as a real browser navigation. Styled to match the
 * `Button` `variant="secondary"` look by hand, since `Button` can't render
 * as an anchor.
 */
export function OidcProviderButtons({ returnTo }: { returnTo?: string } = {}) {
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
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-3 text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <p className="text-xs">{t('auth.oidc.dividerLabel')}</p>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="flex flex-col gap-2">
        {data.map((provider) => (
          <a
            key={provider.id}
            href={oidcLoginHref(provider.id, returnTo)}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-muted px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
          >
            {t('auth.oidc.continueWithProvider', { provider: provider.displayName })}
          </a>
        ))}
      </div>
    </div>
  );
}
