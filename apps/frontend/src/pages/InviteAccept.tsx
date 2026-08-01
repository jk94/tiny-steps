import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { acceptInvite, previewInvite } from '../api/invite-api';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useAuth } from '../auth/useAuth';
import { mapInviteError } from '../household/mapInviteError';
import { queryClient } from '../lib/query-client';

const NON_VALID_STATUS_KEY = {
  invalid: 'invite.preview.invalid',
  expired: 'invite.preview.expired',
  used: 'invite.preview.used',
  revoked: 'invite.preview.revoked',
} as const;

/**
 * Neither `ProtectedRoute` nor `GuestOnlyRoute` — works for both auth
 * states. Always fetches the (unauthenticated-safe) preview on mount; the
 * accept affordance only appears for an authenticated visitor on a
 * `status === 'valid'` invite, a guest instead gets login/register prompts
 * that carry `state: { from: location }` so `Login`/`Register`'s existing
 * post-success redirect brings them straight back here.
 */
export function InviteAccept() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const previewQuery = useQuery({
    queryKey: ['invites', token],
    queryFn: () => previewInvite(token!),
    retry: false,
    enabled: !!token,
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptInvite(token!),
    onSuccess: async (result) => {
      // So `HouseholdSwitcher` (which reads the shared `['households']`
      // query) picks up the newly joined household immediately, instead of
      // waiting for some unrelated refetch trigger.
      await queryClient.invalidateQueries({ queryKey: ['households'] });
      navigate(`/households/${result.household.id}`, { replace: true });
    },
  });

  if (isAuthLoading) {
    return <LoadingIndicator />;
  }

  if (previewQuery.isLoading) {
    return (
      <section>
        <h1>{t('invite.preview.title')}</h1>
        <p>{t('invite.preview.loading')}</p>
      </section>
    );
  }

  if (previewQuery.error || !previewQuery.data) {
    return (
      <section>
        <h1>{t('invite.preview.title')}</h1>
        <ErrorMessage message={t(mapInviteError(previewQuery.error))} />
      </section>
    );
  }

  const preview = previewQuery.data;

  if (preview.status !== 'valid') {
    return (
      <section>
        <h1>{t('invite.preview.title')}</h1>
        <p>{t(NON_VALID_STATUS_KEY[preview.status])}</p>
      </section>
    );
  }

  return (
    <section>
      <h1>{t('invite.preview.title')}</h1>
      <p>{t('invite.preview.validDescription', { householdName: preview.householdName })}</p>
      {preview.expiresAt && (
        <p>
          {t('invite.preview.expiresAtLabel')}: {new Date(preview.expiresAt).toLocaleDateString()}
        </p>
      )}

      {isAuthenticated ? (
        <>
          <button
            type="button"
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
          >
            {t(acceptMutation.isPending ? 'invite.acceptButtonPending' : 'invite.acceptButton')}
          </button>
          {acceptMutation.isError && (
            <ErrorMessage message={t(mapInviteError(acceptMutation.error))} />
          )}
        </>
      ) : (
        <div>
          <p>{t('invite.guestPrompt')}</p>
          <Link to="/login" state={{ from: location }}>
            {t('invite.loginLink')}
          </Link>
          <Link to="/register" state={{ from: location }}>
            {t('invite.registerLink')}
          </Link>
        </div>
      )}
    </section>
  );
}
