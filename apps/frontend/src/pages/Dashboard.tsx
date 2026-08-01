import { useTranslation } from 'react-i18next';

/**
 * Placeholder dashboard. Real tracking/event views land in Phase 2.
 */
export function Dashboard() {
  const { t } = useTranslation();
  return (
    <section>
      <h1>{t('dashboard.title')}</h1>
      <p>{t('dashboard.description')}</p>
    </section>
  );
}
