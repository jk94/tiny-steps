import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createInvite } from '../api/household-api';
import { ErrorMessage } from './ErrorMessage';
import { Button, Card, Input, Select } from './ui';
import { householdRoleLabelKey } from '../household/householdRoleLabelKey';
import { mapHouseholdError } from '../household/mapHouseholdError';
import {
  canWrite,
  INVITABLE_ROLES,
  OWNER_ROLES,
  type HouseholdRole,
} from '../lib/householdPermissions';

export interface InviteGeneratorProps {
  householdId: string;
  role: HouseholdRole;
}

/** Default target role, matching the backend's default for a body-less invite. */
const DEFAULT_INVITE_ROLE: HouseholdRole = 'CO_PARENT';

const ROLE_DESCRIPTION_KEYS = {
  CO_PARENT: 'household.invite.roleDescription.coParent',
  CAREGIVER: 'household.invite.roleDescription.caregiver',
  OBSERVER: 'household.invite.roleDescription.observer',
} as const;

function roleDescriptionKey(role: HouseholdRole) {
  // OWNER is not invitable, so it has no description; fall back to the default
  // rather than rendering a raw key if that ever changes.
  return ROLE_DESCRIPTION_KEYS[role as keyof typeof ROLE_DESCRIPTION_KEYS] ?? null;
}

/**
 * OWNER-only "generate invite link" control, including the role the link will
 * grant (ROL-8: chosen by the inviting owner, never by the invitee). Renders
 * nothing at all for any other role — the server-side 403 (also mapped below
 * as a defense-in-depth fallback, e.g. a stale role in a second open tab) is
 * the real boundary, this is purely UI gating.
 *
 * Each choice is explained inline, because "Carer" vs "Viewer" is not
 * self-explanatory and picking the wrong one silently over- or under-grants
 * access.
 */
export function InviteGenerator({ householdId, role }: InviteGeneratorProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [selectedRole, setSelectedRole] = useState<HouseholdRole>(DEFAULT_INVITE_ROLE);
  const mutation = useMutation({
    mutationFn: () => createInvite(householdId, selectedRole),
    onSuccess: () => {
      setCopied(false);
      setCopyFailed(false);
    },
  });

  if (!canWrite(role, OWNER_ROLES)) {
    return null;
  }

  const selectedRoleDescriptionKey = roleDescriptionKey(selectedRole);

  const invite = mutation.data;
  const inviteLink = invite ? `${window.location.origin}/invites/${invite.token}` : null;

  const handleCopy = async () => {
    if (!inviteLink) {
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      // Non-secure origin, denied permission, or an older browser without
      // Clipboard API support — the link stays visible/selectable in the
      // `<input>` below as the fallback, so surface this instead of leaving
      // an unhandled rejection with no feedback.
      setCopyFailed(true);
      setCopied(false);
    }
  };

  return (
    <Card>
      <Card.Body className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Select
            id="invite-role"
            label={t('household.invite.roleSelectLabel')}
            value={selectedRole}
            onValueChange={(value) => setSelectedRole(value as HouseholdRole)}
          >
            {INVITABLE_ROLES.map((invitableRole) => (
              <Select.Item key={invitableRole} value={invitableRole}>
                {t(householdRoleLabelKey(invitableRole))}
              </Select.Item>
            ))}
          </Select>
          {selectedRoleDescriptionKey && (
            <p className="text-xs text-muted-foreground">{t(selectedRoleDescriptionKey)}</p>
          )}
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={() => mutation.mutate()}
          isLoading={mutation.isPending}
        >
          {t(
            mutation.isPending
              ? 'household.invite.generateButtonPending'
              : 'household.invite.generateButton',
          )}
        </Button>

        {mutation.isError && <ErrorMessage message={t(mapHouseholdError(mutation.error))} />}

        {invite && inviteLink && (
          <div className="flex flex-col gap-2">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  id="invite-link"
                  label={t('household.invite.linkLabel')}
                  readOnly
                  value={inviteLink}
                />
              </div>
              <Button type="button" variant="secondary" onClick={() => void handleCopy()}>
                {t('household.invite.copyButton')}
              </Button>
            </div>
            {copied && (
              <span className="text-sm text-success">
                {t('household.invite.copiedConfirmation')}
              </span>
            )}
            {copyFailed && <ErrorMessage message={t('household.invite.copyFailed')} />}
            <p className="text-xs text-muted-foreground">
              {t('household.invite.expiresAtLabel')}:{' '}
              {new Date(invite.expiresAt).toLocaleDateString()}
            </p>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
