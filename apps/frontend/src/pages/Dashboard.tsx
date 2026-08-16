import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Card } from '../components/ui';

/**
 * Generic landing screen after sign-in. Deliberately stays a static
 * welcome card, not a per-child "home" dashboard — there's no "currently
 * selected child" concept anywhere in the app (multi-household,
 * multi-child by design), so building that would mean inventing new
 * state/routing rather than restyling what's already here.
 */
export function Dashboard() {
  const { t } = useTranslation();
  return (
    <section className="mx-auto w-full max-w-lg">
      <Card>
        <Card.Body className="flex flex-col gap-3">
          <h1 className="text-xl font-bold text-foreground">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('dashboard.description')}</p>
          <Link
            to="/households"
            className="inline-flex h-9 w-fit items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t('nav.householdsLink')}
          </Link>
        </Card.Body>
      </Card>
    </section>
  );
}
