import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { NameForm } from '../components/NameForm';
import { Card } from '../components/ui';

/**
 * Lets the signed-in user change their display name — the counterpart to the
 * one-off `MandatoryNameDialog`, reachable any time from the header.
 *
 * Save feedback follows `NotificationSettings`' existing pattern (an inline
 * `role="status"` line plus an inline error) rather than a toast, so the app's
 * two settings-style forms behave the same way.
 */
export function Profile() {
  const { t } = useTranslation();
  const { user, updateName } = useAuth();
  const [isSaved, setIsSaved] = useState(false);

  return (
    <section className="mx-auto w-full max-w-sm">
      <h1 className="mb-4 text-xl font-bold text-foreground">{t('profile.title')}</h1>
      <Card>
        <Card.Body className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t('profile.description')}</p>
          <NameForm
            // `user` is non-null here (this route sits behind ProtectedRoute),
            // but a legacy account can still have no name yet.
            initialName={user?.name ?? ''}
            label={t('profile.nameLabel')}
            submitLabel={t('profile.saveButton')}
            submitPendingLabel={t('profile.saveButtonPending')}
            errorMessage={t('profile.saveError')}
            onSubmit={async (name) => {
              setIsSaved(false);
              await updateName(name);
              setIsSaved(true);
            }}
          >
            {isSaved && (
              <p role="status" className="text-sm text-success">
                {t('profile.saveSuccess')}
              </p>
            )}
          </NameForm>
        </Card.Body>
      </Card>
    </section>
  );
}
