import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listHouseholdMembers } from '../api/household-api';
import { LoadingIndicator } from './LoadingIndicator';
import { Card, EmptyState } from './ui';

export interface MemberListProps {
  householdId: string;
}

/**
 * Read-only member list within `HouseholdDetail` — every member (any role)
 * may view it, mirroring the backend's `HouseholdMembershipGuard`-only
 * `GET .../members` route (no `@RequireRole`). Email is the only
 * user-identifying field available (see `HouseholdMemberSummary`); there is
 * no per-member role in the response, so only the viewer's own role is shown
 * elsewhere on the page.
 */
export function MemberList({ householdId }: MemberListProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['households', householdId, 'members'],
    queryFn: () => listHouseholdMembers(householdId),
    retry: false,
  });

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
        {t('household.members.title')}
      </h2>
      {isLoading ? (
        <LoadingIndicator />
      ) : !data || data.length === 0 ? (
        <EmptyState description={t('household.members.empty')} />
      ) : (
        <Card>
          <Card.Body className="flex flex-col gap-2">
            <ul className="flex flex-col gap-2">
              {data.map((member) => (
                <li key={member.userId} className="text-sm text-foreground">
                  {member.email}
                </li>
              ))}
            </ul>
          </Card.Body>
        </Card>
      )}
    </section>
  );
}
