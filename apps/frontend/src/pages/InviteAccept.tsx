import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { acceptInvite, previewInvite } from '../api/invite-api';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { Button, Card } from '../components/ui';
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
      // So `HouseholdList` (which reads the shared `['households']` query)
      // picks up the newly joined household immediately, instead of waiting
      // for some unrelated refetch trigger.
      await queryClient.invalidateQueries({ queryKey: ['households'] });
      navigate(`/households/${result.household.id}`, { replace: true });
    },
  });

  if (isAuthLoading) {
    return <LoadingIndicator />;
  }

  if (previewQuery.isLoading) {
    return (
      <section className="mx-auto w-full max-w-sm py-8">
        <Card>
          <Card.Header>
            <h1 className="text-xl font-bold text-foreground">{t('invite.preview.title')}</h1>
          </Card.Header>
          <Card.Body>
            <p className="text-sm text-muted-foreground">{t('invite.preview.loading')}</p>
          </Card.Body>
        </Card>
      </section>
    );
  }

  if (previewQuery.error || !previewQuery.data) {
    return (
      <section className="mx-auto w-full max-w-sm py-8">
        <Card>
          <Card.Header>
            <h1 className="text-xl font-bold text-foreground">{t('invite.preview.title')}</h1>
          </Card.Header>
          <Card.Body>
            <ErrorMessage message={t(mapInviteError(previewQuery.error))} />
          </Card.Body>
        </Card>
      </section>
    );
  }

  const preview = previewQuery.data;

  if (preview.status !== 'valid') {
    return (
      <section className="mx-auto w-full max-w-sm py-8">
        <Card>
          <Card.Header>
            <h1 className="text-xl font-bold text-foreground">{t('invite.preview.title')}</h1>
          </Card.Header>
          <Card.Body>
            <p className="text-sm text-muted-foreground">
              {t(NON_VALID_STATUS_KEY[preview.status])}
            </p>
          </Card.Body>
        </Card>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-sm py-8">
      <Card>
        <Card.Header>
          <h1 className="text-xl font-bold text-foreground">{t('invite.preview.title')}</h1>
        </Card.Header>
        <Card.Body className="flex flex-col gap-2">
          <p className="text-sm">
            {t('invite.preview.validDescription', { householdName: preview.householdName })}
          </p>
          {preview.expiresAt && (
            <p className="text-xs text-muted-foreground">
              {t('invite.preview.expiresAtLabel')}:{' '}
              {new Date(preview.expiresAt).toLocaleDateString()}
            </p>
          )}
        </Card.Body>
        <Card.Footer className="flex-col items-stretch">
          {isAuthenticated ? (
            <>
              <Button
                type="button"
                variant="primary"
                className="w-full"
                onClick={() => acceptMutation.mutate()}
                isLoading={acceptMutation.isPending}
              >
                {t(acceptMutation.isPending ? 'invite.acceptButtonPending' : 'invite.acceptButton')}
              </Button>
              {acceptMutation.isError && (
                <ErrorMessage message={t(mapInviteError(acceptMutation.error))} />
              )}
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{t('invite.guestPrompt')}</p>
              <div className="flex gap-2">
                <Link
                  to="/login"
                  state={{ from: location }}
                  className="flex-1 rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {t('invite.loginLink')}
                </Link>
                <Link
                  to="/register"
                  state={{ from: location }}
                  className="flex-1 rounded-md bg-muted px-4 py-2 text-center text-sm font-medium text-foreground hover:bg-muted/80"
                >
                  {t('invite.registerLink')}
                </Link>
              </div>
            </div>
          )}
        </Card.Footer>
      </Card>
    </section>
  );
}
