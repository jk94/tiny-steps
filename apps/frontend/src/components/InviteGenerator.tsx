import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createInvite } from '../api/household-api';
import { ErrorMessage } from './ErrorMessage';
import { Button, Card, Input } from './ui';
import { mapHouseholdError } from '../household/mapHouseholdError';

export interface InviteGeneratorProps {
  householdId: string;
  role: 'OWNER' | 'CO_PARENT';
}

/**
 * OWNER-only "generate invite link" control. Renders nothing at all for a
 * CO_PARENT — the server-side 403 (also mapped below as a defense-in-depth
 * fallback, e.g. a stale role in a second open tab) is the real boundary,
 * this is purely UI gating (see the plan's role-based-UI decision).
 */
export function InviteGenerator({ householdId, role }: InviteGeneratorProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const mutation = useMutation({
    mutationFn: () => createInvite(householdId),
    onSuccess: () => {
      setCopied(false);
      setCopyFailed(false);
    },
  });

  if (role !== 'OWNER') {
    return null;
  }

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
