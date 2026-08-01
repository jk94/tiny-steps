import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { listChildren } from '../api/child-api';
import { ChildPhoto } from './ChildPhoto';
import { LoadingIndicator } from './LoadingIndicator';

export interface ChildListProps {
  householdId: string;
  role: 'OWNER' | 'CO_PARENT';
}

/**
 * Children list within `HouseholdDetail`. "Add child" is OWNER-only (child
 * creation is restricted server-side to OWNER — see `ChildController`),
 * completely hidden rather than disabled for a CO_PARENT.
 */
export function ChildList({ householdId, role }: ChildListProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['households', householdId, 'children'],
    queryFn: () => listChildren(householdId),
    retry: false,
  });

  return (
    <section>
      <h2>{t('child.list.title')}</h2>
      {role === 'OWNER' && (
        <Link to={`/households/${householdId}/children/new`}>{t('child.list.addLink')}</Link>
      )}
      {isLoading ? (
        <LoadingIndicator />
      ) : !data || data.length === 0 ? (
        <p>{t('child.list.empty')}</p>
      ) : (
        <ul>
          {data.map((child) => (
            <li key={child.id}>
              <Link to={`/households/${householdId}/children/${child.id}`}>
                <ChildPhoto
                  childId={child.id}
                  householdId={householdId}
                  hasPhoto={child.hasPhoto}
                  name={child.name}
                />
                <span>{child.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
