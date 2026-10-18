import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { loadDevelopmentContent, toDevelopmentLocale } from './developmentContent';

/**
 * The development calendar in the current UI language. Goes through React
 * Query purely for its loading/error state and caching — the content is static
 * for the lifetime of a build, so it never goes stale, and switching the
 * language just selects the other locale's cache entry.
 */
export function useDevelopmentContent() {
  const { i18n } = useTranslation();
  const locale = toDevelopmentLocale(i18n.resolvedLanguage ?? i18n.language);

  return useQuery({
    queryKey: ['development-content', locale],
    queryFn: () => loadDevelopmentContent(locale),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
