import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  changeMemberRole,
  listHouseholdMembers,
  removeMember,
  type HouseholdMemberSummary,
} from '../api/household-api';
import { useAuth } from '../auth/useAuth';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorMessage } from './ErrorMessage';
import { Avatar, Badge, Card, EmptyState, Button, Select, Skeleton } from './ui';
import { householdRoleLabelKey } from '../household/householdRoleLabelKey';
import { mapHouseholdError } from '../household/mapHouseholdError';
import { ALL_ROLES, canWrite, OWNER_ROLES, type HouseholdRole } from '../lib/householdPermissions';

export interface MemberListProps {
  householdId: string;
  /** The *viewer's* role, which decides whether the management controls show. */
  role: HouseholdRole;
}

/**
 * Ranking used only to decide whether a role change is a demotion, so the
 * confirmation can warn more sharply. It is not an authorization model — that
 * lives in `householdPermissions.ts` and, authoritatively, in the backend.
 */
const ROLE_RANK: Record<HouseholdRole, number> = {
  OWNER: 3,
  CO_PARENT: 2,
  CAREGIVER: 1,
  OBSERVER: 0,
};

function isDemotion(from: HouseholdRole, to: HouseholdRole): boolean {
  return ROLE_RANK[to] < ROLE_RANK[from];
}

/**
 * Picks the confirmation wording for a role change. Being made an OWNER gets
 * its own sentence rather than the generic one: it is the only change that
 * hands out household administration, and it is deliberately unreachable
 * through an invite link (`INVITABLE_ROLES`), so the one path that does grant
 * it should say what it grants.
 */
function roleChangeDescriptionKey(from: HouseholdRole, to: HouseholdRole) {
  if (to === 'OWNER') {
    return 'household.members.roleChangeDialog.descriptionPromotionToOwner';
  }
  return isDemotion(from, to)
    ? 'household.members.roleChangeDialog.descriptionDemotion'
    : 'household.members.roleChangeDialog.description';
}

interface PendingRoleChange {
  member: HouseholdMemberSummary;
  nextRole: HouseholdRole;
}

/**
 * Member list within `HouseholdDetail`. Every member (any role) may view it,
 * mirroring the backend's `HouseholdMembershipGuard`-only `GET .../members`
 * route; only an OWNER additionally gets the role-change and remove controls,
 * matching `@RequireRole(...OWNER_ROLES)` on the two write routes. UI gating is
 * UX only — the server stays the authorization boundary, and its structured
 * error codes are surfaced through `mapHouseholdError`.
 *
 * The viewer's own row deliberately shows no controls at all rather than
 * disabled ones: the backend refuses both self-actions outright
 * (`CANNOT_CHANGE_OWN_ROLE`/`CANNOT_REMOVE_SELF`), so there is no state in
 * which they could become available.
 *
 * Both actions are confirmed, including a promotion — a role change is
 * invisible to the person it affects, so an accidental click should never take
 * effect silently.
 */
export function MemberList({ householdId, role }: MemberListProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<HouseholdMemberSummary | null>(null);

  const membersQueryKey = ['households', householdId, 'members'];
  const { data, isLoading } = useQuery({
    queryKey: membersQueryKey,
    queryFn: () => listHouseholdMembers(householdId),
    retry: false,
  });

  // No realtime broadcast exists for membership changes, so the list is
  // refreshed by invalidation alone.
  const invalidateMembers = () => queryClient.invalidateQueries({ queryKey: membersQueryKey });

  // The confirmation is closed on failure as well as on success: it is a Radix
  // modal, which `aria-hidden`s the rest of the page, so an error rendered
  // behind it would be both invisible and unreachable by assistive tech.
  const roleChangeMutation = useMutation({
    mutationFn: ({ member, nextRole }: PendingRoleChange) =>
      changeMemberRole(householdId, member.userId, nextRole),
    onSuccess: () => invalidateMembers(),
    onSettled: () => setPendingRoleChange(null),
  });

  const removalMutation = useMutation({
    mutationFn: (member: HouseholdMemberSummary) => removeMember(householdId, member.userId),
    onSuccess: () => invalidateMembers(),
    onSettled: () => setPendingRemoval(null),
  });

  /**
   * Opening either confirmation clears whatever failed last time, so a stale
   * message from the previous attempt can't be read as the result of this one.
   */
  const clearPreviousFailure = () => {
    roleChangeMutation.reset();
    removalMutation.reset();
  };

  const canManageMembers = canWrite(role, OWNER_ROLES);
  const mutationError = roleChangeMutation.error ?? removalMutation.error;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
        {t('household.members.title')}
      </h2>
      {isLoading ? (
        <Card aria-hidden="true">
          <Card.Body className="flex flex-col gap-2">
            <Skeleton shape="text" className="w-40" />
            <Skeleton shape="text" className="w-32" />
          </Card.Body>
        </Card>
      ) : !data || data.length === 0 ? (
        <EmptyState description={t('household.members.empty')} />
      ) : (
        <Card>
          <Card.Body>
            <ul className="flex flex-col gap-4">
              {data.map((member) => {
                const displayName = member.name ?? member.email;
                const isSelf = member.userId === user?.id;

                return (
                  <li key={member.userId} className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <Avatar name={displayName} size="sm" aria-hidden="true" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-foreground">{displayName}</span>
                        {member.name && (
                          <span className="truncate text-xs text-muted-foreground">
                            {member.email}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {t('household.members.joinedAtLabel')}:{' '}
                          {new Date(member.joinedAt).toLocaleDateString(i18n.language)}
                        </span>
                      </div>
                      <Badge size="sm" className="ml-auto">
                        {t(householdRoleLabelKey(member.role))}
                      </Badge>
                    </div>

                    {canManageMembers && !isSelf && (
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Select
                            id={`member-role-${member.userId}`}
                            label={t('household.members.roleLabel')}
                            value={member.role}
                            onValueChange={(value) => {
                              clearPreviousFailure();
                              setPendingRoleChange({
                                member,
                                nextRole: value as HouseholdRole,
                              });
                            }}
                          >
                            {/* All four roles, OWNER included: unlike an invite
                                link (`INVITABLE_ROLES`), promoting a known
                                member is how ownership is shared or handed
                                over — see `ChangeMemberRoleDto`. */}
                            {ALL_ROLES.map((targetRole) => (
                              <Select.Item key={targetRole} value={targetRole}>
                                {t(householdRoleLabelKey(targetRole))}
                              </Select.Item>
                            ))}
                          </Select>
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            clearPreviousFailure();
                            setPendingRemoval(member);
                          }}
                        >
                          {t('household.members.removeButton')}
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card.Body>
        </Card>
      )}

      {mutationError !== null && <ErrorMessage message={t(mapHouseholdError(mutationError))} />}

      {pendingRoleChange && (
        <ConfirmDialog
          isOpen
          title={t('household.members.roleChangeDialog.title')}
          description={t(
            roleChangeDescriptionKey(pendingRoleChange.member.role, pendingRoleChange.nextRole),
            {
              name: pendingRoleChange.member.name ?? pendingRoleChange.member.email,
              role: t(householdRoleLabelKey(pendingRoleChange.nextRole)),
            },
          )}
          confirmLabel={t('household.members.roleChangeDialog.confirmButton')}
          cancelLabel={t('household.members.roleChangeDialog.cancelButton')}
          onConfirm={() => roleChangeMutation.mutate(pendingRoleChange)}
          onCancel={() => setPendingRoleChange(null)}
          isConfirming={roleChangeMutation.isPending}
        />
      )}

      {pendingRemoval && (
        <ConfirmDialog
          isOpen
          title={t('household.members.removeDialog.title')}
          description={t('household.members.removeDialog.description', {
            name: pendingRemoval.name ?? pendingRemoval.email,
          })}
          confirmLabel={t('household.members.removeDialog.confirmButton')}
          cancelLabel={t('household.members.removeDialog.cancelButton')}
          onConfirm={() => removalMutation.mutate(pendingRemoval)}
          onCancel={() => setPendingRemoval(null)}
          isConfirming={removalMutation.isPending}
        />
      )}
    </section>
  );
}
