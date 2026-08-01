import { useTranslation } from 'react-i18next';

/** Minimal, shared loading state — no UI kit in this project yet. */
export function LoadingIndicator() {
  const { t } = useTranslation();
  return <p>{t('common.loading')}</p>;
}
