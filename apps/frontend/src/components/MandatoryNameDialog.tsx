import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { NameForm } from './NameForm';
import { Dialog } from './ui';

/**
 * Blocks the app until the signed-in user supplies a display name. Needed
 * because `name` only became mandatory after the fact: accounts created
 * earlier, and OIDC logins whose ID token carried no `name` claim, have none,
 * and the column stays nullable so those rows remain valid.
 *
 * Deliberately undismissable — no ✕ (`hideCloseButton`), no ESC
 * (`onEscapeKeyDown` suppressed), and `Dialog` already ignores backdrop
 * clicks. There is no local open state either: `Layout` mounts this only while
 * `user.name` is falsy, so the successful submit's cache update is what
 * unmounts it.
 */
export function MandatoryNameDialog() {
  const { t } = useTranslation();
  const { updateName } = useAuth();

  return (
    <Dialog
      isOpen
      // Never called in practice — every dismissal route is suppressed — but
      // `Dialog` requires a handler.
      onOpenChange={() => {}}
      onEscapeKeyDown={(event) => event.preventDefault()}
      hideCloseButton
    >
      <Dialog.Header>
        <Dialog.Title>{t('mandatoryNameDialog.title')}</Dialog.Title>
        <Dialog.Description>{t('mandatoryNameDialog.description')}</Dialog.Description>
      </Dialog.Header>
      <Dialog.Body>
        <NameForm
          initialName=""
          label={t('mandatoryNameDialog.nameLabel')}
          submitLabel={t('mandatoryNameDialog.submitButton')}
          submitPendingLabel={t('mandatoryNameDialog.submitButtonPending')}
          errorMessage={t('mandatoryNameDialog.error')}
          onSubmit={updateName}
        />
      </Dialog.Body>
    </Dialog>
  );
}
