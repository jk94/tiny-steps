import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { listChildren } from '../api/child-api';
import { ChildPhoto } from './ChildPhoto';
import { LoadingIndicator } from './LoadingIndicator';
import { Card, EmptyState } from './ui';
import { cn } from '../lib/cn';

export interface ChildListProps {
  householdId: string;
  role: 'OWNER' | 'CO_PARENT';
}

const EVENT_TYPE_PILL = 'bg-feeding text-feeding-foreground';
const PILL_CLASS = 'rounded-full px-2.5 py-1 text-xs font-medium hover:opacity-90';

/**
 * Children list within `HouseholdDetail`. "Add child" is OWNER-only (child
 * creation is restricted server-side to OWNER — see `ChildController`),
 * completely hidden rather than disabled for a CO_PARENT. Each child row is
 * the entry point into that child's routes — there's no other UI to pick a
 * "current child". The whole row opens that child's home dashboard
 * (`ChildHome`), which links onward to the daily timeline, via the
 * "stretched link" pattern (the photo/name `Link` covers the full card through
 * an absolutely-positioned `::after`) rather than a `Card`-level `onClick` —
 * a `<div onClick>` is a mouse/touch-only target with no keyboard/screen-reader
 * equivalent, whereas one real, fully-sized `<Link>` is reachable both ways.
 * The per-type pills below sit above the stretched link (`relative z-10`) so
 * they keep navigating to their own destination (Export/Settings live on the
 * settings page and per-child nav instead, not duplicated here), styled using
 * the same per-event-type colors as `Badge`.
 */
export function ChildList({ householdId, role }: ChildListProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['households', householdId, 'children'],
    queryFn: () => listChildren(householdId),
    retry: false,
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-foreground">{t('child.list.title')}</h2>
        {role === 'OWNER' && (
          <Link
            to={`/households/${householdId}/children/new`}
            className="text-sm font-medium text-primary hover:underline"
          >
            {t('child.list.addLink')}
          </Link>
        )}
      </div>
      {isLoading ? (
        <LoadingIndicator />
      ) : !data || data.length === 0 ? (
        <EmptyState description={t('child.list.empty')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((child) => (
            <li key={child.id}>
              <Card className="relative hover:bg-muted/50">
                <Card.Body className="flex flex-col gap-3">
                  <Link
                    to={`/households/${householdId}/children/${child.id}`}
                    className="flex items-center gap-3 after:absolute after:inset-0 after:content-['']"
                  >
                    <ChildPhoto
                      childId={child.id}
                      householdId={householdId}
                      hasPhoto={child.hasPhoto}
                      name={child.name}
                      size="sm"
                      aria-hidden="true"
                    />
                    <span className="font-semibold text-foreground">{child.name}</span>
                  </Link>
                  <div className="relative z-10 flex flex-wrap gap-1.5">
                    <Link
                      to={`/households/${householdId}/children/${child.id}/feeding`}
                      className={cn(PILL_CLASS, EVENT_TYPE_PILL)}
                    >
                      {t('child.list.feedingLink')}
                    </Link>
                    <Link
                      to={`/households/${householdId}/children/${child.id}/sleep`}
                      className={cn(PILL_CLASS, 'bg-sleep text-sleep-foreground')}
                    >
                      {t('child.list.sleepLink')}
                    </Link>
                    <Link
                      to={`/households/${householdId}/children/${child.id}/diaper`}
                      className={cn(PILL_CLASS, 'bg-diaper text-diaper-foreground')}
                    >
                      {t('child.list.diaperLink')}
                    </Link>
                  </div>
                </Card.Body>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
