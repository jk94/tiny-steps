import { useTranslation } from 'react-i18next';

/** Shared loading state, styled with the design-system's muted text token. */
export function LoadingIndicator() {
  const { t } = useTranslation();
  return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
}
