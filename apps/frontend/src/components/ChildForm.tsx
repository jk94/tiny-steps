import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { buildChildFormData } from '../api/child-api';
import { ALLOWED_PHOTO_MIME_TYPES, MAX_PHOTO_BYTES } from '../child/childPhotoConstraints';
import { mapChildError, type ChildErrorKey } from '../child/mapChildError';
import { ChildPhoto } from './ChildPhoto';
import { ErrorMessage } from './ErrorMessage';

const MAX_NAME_LENGTH = 120;

/** `<input type="date">` max attribute + the JS not-in-the-future check. */
function todayAsIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

type FieldErrorKeys = {
  name?: 'child.validation.nameRequired' | 'child.validation.nameTooLong';
  birthDate?: 'child.validation.birthDateRequired' | 'child.validation.birthDateFuture';
  photo?: 'child.validation.photoTooLarge' | 'child.validation.photoInvalidType';
};

export interface ChildFormInitialValues {
  name: string;
  birthDate: string;
  childId: string;
  householdId: string;
  hasPhoto: boolean;
}

export interface ChildFormProps {
  mode: 'create' | 'edit';
  initialValues?: ChildFormInitialValues;
  onSubmit: (formData: FormData) => Promise<void>;
}

export function ChildForm({ mode, initialValues, onSubmit }: ChildFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialValues?.name ?? '');
  const [birthDate, setBirthDate] = useState(initialValues?.birthDate ?? '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [fieldErrorKeys, setFieldErrorKeys] = useState<FieldErrorKeys>({});
  const [formErrorKey, setFormErrorKey] = useState<ChildErrorKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): FieldErrorKeys => {
    const errors: FieldErrorKeys = {};

    if (name.trim().length === 0) {
      errors.name = 'child.validation.nameRequired';
    } else if (name.length > MAX_NAME_LENGTH) {
      errors.name = 'child.validation.nameTooLong';
    }

    if (birthDate.trim().length === 0) {
      errors.birthDate = 'child.validation.birthDateRequired';
    } else if (birthDate > todayAsIsoDate()) {
      errors.birthDate = 'child.validation.birthDateFuture';
    }

    if (photoFile) {
      if (
        !ALLOWED_PHOTO_MIME_TYPES.includes(
          photoFile.type as (typeof ALLOWED_PHOTO_MIME_TYPES)[number],
        )
      ) {
        errors.photo = 'child.validation.photoInvalidType';
      } else if (photoFile.size > MAX_PHOTO_BYTES) {
        errors.photo = 'child.validation.photoTooLarge';
      }
    }

    return errors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextFieldErrorKeys = validate();
    if (nextFieldErrorKeys.name || nextFieldErrorKeys.birthDate || nextFieldErrorKeys.photo) {
      setFieldErrorKeys(nextFieldErrorKeys);
      setFormErrorKey(null);
      return;
    }

    setFieldErrorKeys({});
    setFormErrorKey(null);
    setIsSubmitting(true);
    try {
      const formData = buildChildFormData({ name, birthDate, photo: photoFile });
      await onSubmit(formData);
      // No `finally`-reset here — a successful submit navigates away, so
      // resetting `isSubmitting` right before unmount would be pure churn.
    } catch (err) {
      setFormErrorKey(mapChildError(err));
      setIsSubmitting(false);
    }
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPhotoFile(event.target.files?.[0] ?? null);
    if (fieldErrorKeys.photo) {
      setFieldErrorKeys((prev) => ({ ...prev, photo: undefined }));
    }
  };

  const submitButtonTextKey =
    mode === 'create'
      ? isSubmitting
        ? 'child.create.submitButtonPending'
        : 'child.create.submitButton'
      : isSubmitting
        ? 'child.edit.submitButtonPending'
        : 'child.edit.submitButton';

  return (
    <form className="child-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
      <div className="child-form__field">
        <label htmlFor="child-name">{t('child.fields.nameLabel')}</label>
        <input
          id="child-name"
          type="text"
          required
          maxLength={MAX_NAME_LENGTH}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (fieldErrorKeys.name) {
              setFieldErrorKeys((prev) => ({ ...prev, name: undefined }));
            }
          }}
          aria-invalid={!!fieldErrorKeys.name}
          aria-describedby={fieldErrorKeys.name ? 'child-name-error' : undefined}
          disabled={isSubmitting}
        />
        {fieldErrorKeys.name && (
          <div id="child-name-error">
            <ErrorMessage message={t(fieldErrorKeys.name)} />
          </div>
        )}
      </div>

      <div className="child-form__field">
        <label htmlFor="child-birth-date">{t('child.fields.birthDateLabel')}</label>
        <input
          id="child-birth-date"
          type="date"
          required
          max={todayAsIsoDate()}
          value={birthDate}
          onChange={(event) => {
            setBirthDate(event.target.value);
            if (fieldErrorKeys.birthDate) {
              setFieldErrorKeys((prev) => ({ ...prev, birthDate: undefined }));
            }
          }}
          aria-invalid={!!fieldErrorKeys.birthDate}
          aria-describedby={fieldErrorKeys.birthDate ? 'child-birth-date-error' : undefined}
          disabled={isSubmitting}
        />
        {fieldErrorKeys.birthDate && (
          <div id="child-birth-date-error">
            <ErrorMessage message={t(fieldErrorKeys.birthDate)} />
          </div>
        )}
      </div>

      <div className="child-form__field">
        <label htmlFor="child-photo">{t('child.fields.photoLabel')}</label>
        {mode === 'edit' && initialValues && (
          <ChildPhoto
            childId={initialValues.childId}
            householdId={initialValues.householdId}
            hasPhoto={initialValues.hasPhoto}
            name={initialValues.name}
          />
        )}
        <input
          id="child-photo"
          type="file"
          accept={ALLOWED_PHOTO_MIME_TYPES.join(',')}
          onChange={handlePhotoChange}
          aria-invalid={!!fieldErrorKeys.photo}
          aria-describedby={fieldErrorKeys.photo ? 'child-photo-error' : 'child-photo-hint'}
          disabled={isSubmitting}
        />
        <p id="child-photo-hint">{t('child.fields.photoHint')}</p>
        {fieldErrorKeys.photo && (
          <div id="child-photo-error">
            <ErrorMessage message={t(fieldErrorKeys.photo)} />
          </div>
        )}
      </div>

      {formErrorKey && <ErrorMessage message={t(formErrorKey)} />}

      <button type="submit" disabled={isSubmitting}>
        {t(submitButtonTextKey)}
      </button>
    </form>
  );
}
