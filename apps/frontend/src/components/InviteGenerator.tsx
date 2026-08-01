import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createInvite } from '../api/household-api';
import { ErrorMessage } from './ErrorMessage';
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
    <div>
      <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {t(
          mutation.isPending
            ? 'household.invite.generateButtonPending'
            : 'household.invite.generateButton',
        )}
      </button>

      {mutation.isError && <ErrorMessage message={t(mapHouseholdError(mutation.error))} />}

      {invite && inviteLink && (
        <div>
          <label htmlFor="invite-link">{t('household.invite.linkLabel')}</label>
          <input id="invite-link" type="text" readOnly value={inviteLink} />
          <button type="button" onClick={() => void handleCopy()}>
            {t('household.invite.copyButton')}
          </button>
          {copied && <span>{t('household.invite.copiedConfirmation')}</span>}
          {copyFailed && <ErrorMessage message={t('household.invite.copyFailed')} />}
          <p>
            {t('household.invite.expiresAtLabel')}:{' '}
            {new Date(invite.expiresAt).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
}
