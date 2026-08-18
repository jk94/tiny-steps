import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { createHousehold } from '../api/household-api';
import { ErrorMessage } from '../components/ErrorMessage';
import { Button, Card, Input } from '../components/ui';
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
      // So `HouseholdList` (which reads the shared `['households']` query)
      // picks up the newly created household immediately, instead of waiting
      // for some unrelated refetch trigger.
      await queryClient.invalidateQueries({ queryKey: ['households'] });
      navigate(`/households/${household.id}`, { replace: true });
    } catch (err) {
      setFormErrorKey(mapHouseholdError(err));
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-sm">
      <Card>
        <Card.Body className="flex flex-col gap-4">
          <h1 className="text-xl font-bold text-foreground">{t('household.create.title')}</h1>
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(event) => void handleSubmit(event)}
          >
            <Input
              id="household-name"
              label={t('household.create.nameLabel')}
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
              error={nameErrorKey ? t(nameErrorKey) : undefined}
              disabled={isSubmitting}
            />

            {formErrorKey && <ErrorMessage message={t(formErrorKey)} />}

            <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
              {t(
                isSubmitting
                  ? 'household.create.submitButtonPending'
                  : 'household.create.submitButton',
              )}
            </Button>
          </form>
        </Card.Body>
      </Card>
    </section>
  );
}
