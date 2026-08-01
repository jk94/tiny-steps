import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { createHousehold } from '../api/household-api';
import { ErrorMessage } from '../components/ErrorMessage';
import { mapHouseholdError, type HouseholdErrorKey } from '../household/mapHouseholdError';
import { queryClient } from '../lib/query-client';

const MAX_NAME_LENGTH = 120;

type NameErrorKey = 'household.validation.nameRequired' | 'household.validation.nameTooLong';

/**
 * Single-use inline create form (unlike `ChildForm`, not extracted into a
 * shared component — there's only ever this one call site). Client
 * validation mirrors the backend's `CreateHouseholdDto`
 * (`@IsNotEmpty() @MaxLength(120)`).
 */
export function HouseholdCreate() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [nameErrorKey, setNameErrorKey] = useState<NameErrorKey | null>(null);
  const [formErrorKey, setFormErrorKey] = useState<HouseholdErrorKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (name.trim().length === 0) {
      setNameErrorKey('household.validation.nameRequired');
      setFormErrorKey(null);
      return;
    }
    if (name.length > MAX_NAME_LENGTH) {
      setNameErrorKey('household.validation.nameTooLong');
      setFormErrorKey(null);
      return;
    }

    setNameErrorKey(null);
    setFormErrorKey(null);
    setIsSubmitting(true);
    try {
      const household = await createHousehold(name);
      // So `HouseholdSwitcher` (which reads the shared `['households']`
      // query) picks up the newly created household immediately, instead of
      // waiting for some unrelated refetch trigger.
      await queryClient.invalidateQueries({ queryKey: ['households'] });
      navigate(`/households/${household.id}`, { replace: true });
    } catch (err) {
      setFormErrorKey(mapHouseholdError(err));
      setIsSubmitting(false);
    }
  };

  return (
    <section>
      <h1>{t('household.create.title')}</h1>
      <form noValidate onSubmit={(event) => void handleSubmit(event)}>
        <div>
          <label htmlFor="household-name">{t('household.create.nameLabel')}</label>
          <input
            id="household-name"
            type="text"
            required
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (nameErrorKey) {
                setNameErrorKey(null);
              }
            }}
            aria-invalid={!!nameErrorKey}
            aria-describedby={nameErrorKey ? 'household-name-error' : undefined}
            disabled={isSubmitting}
          />
          {nameErrorKey && (
            <div id="household-name-error">
              <ErrorMessage message={t(nameErrorKey)} />
            </div>
          )}
        </div>

        {formErrorKey && <ErrorMessage message={t(formErrorKey)} />}

        <button type="submit" disabled={isSubmitting}>
          {t(
            isSubmitting ? 'household.create.submitButtonPending' : 'household.create.submitButton',
          )}
        </button>
      </form>
    </section>
  );
}
