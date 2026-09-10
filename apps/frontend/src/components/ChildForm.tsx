import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { buildChildFormData, CLEAR_CHILD_SEX } from '../api/child-api';
import { ALLOWED_PHOTO_MIME_TYPES, MAX_PHOTO_BYTES } from '../lib/photoConstraints';
import { mapChildError, type ChildErrorKey } from '../child/mapChildError';
import { cn } from '../lib/cn';
import { ChildPhoto } from './ChildPhoto';
import { ErrorMessage } from './ErrorMessage';
import { Button, Input, Select } from './ui';

const MAX_NAME_LENGTH = 120;

/**
 * UI-only value of the "not specified" option. Radix's `Select` reserves the
 * empty string (an item may not use it), so the wire sentinel
 * `CLEAR_CHILD_SEX` cannot double as the option value and is mapped on submit.
 */
const SEX_NOT_SPECIFIED_OPTION = 'NOT_SPECIFIED';

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
  /** `'FEMALE' | 'MALE'`, or `CLEAR_CHILD_SEX` for "not specified". */
  sex: string;
  childId: string;
  householdId: string;
  hasPhoto: boolean;
}

/** Maps the select's UI value onto what create/edit should actually send. */
function resolveSubmittedSex(mode: 'create' | 'edit', sex: string): string | undefined {
  if (sex !== SEX_NOT_SPECIFIED_OPTION) {
    return sex;
  }
  return mode === 'edit' ? CLEAR_CHILD_SEX : undefined;
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
  // "Not specified" is the default and a first-class choice, never a guessed
  // value — see W-10 and `child.fields.sexHint`.
  const [sex, setSex] = useState(initialValues?.sex || SEX_NOT_SPECIFIED_OPTION);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [fieldErrorKeys, setFieldErrorKeys] = useState<FieldErrorKeys>({});
  const [formErrorKey, setFormErrorKey] = useState<ChildErrorKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Local preview of a newly picked (not-yet-uploaded) photo, shown inside the
  // circular dropzone instead of the stale `ChildPhoto` in edit mode.
  const photoPreviewUrl = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : null),
    [photoFile],
  );
  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

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
      const formData = buildChildFormData({
        name,
        birthDate,
        // Create omits the field entirely for "not specified" (there is
        // nothing to clear yet); edit sends the empty sentinel, which is how
        // a previously-set sex is reset — see `CLEAR_CHILD_SEX`.
        sex: resolveSubmittedSex(mode, sex),
        photo: photoFile,
      });
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
    <form
      className="flex w-full flex-col gap-6"
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div className="flex flex-col items-center gap-1 self-center">
        <label
          htmlFor="child-photo"
          className={cn(
            'flex h-28 w-28 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-border text-center text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary',
            fieldErrorKeys.photo && 'border-destructive text-destructive',
          )}
        >
          {photoPreviewUrl ? (
            <img
              src={photoPreviewUrl}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
            />
          ) : mode === 'edit' && initialValues?.hasPhoto ? (
            <ChildPhoto
              aria-hidden="true"
              childId={initialValues.childId}
              householdId={initialValues.householdId}
              hasPhoto={initialValues.hasPhoto}
              name={initialValues.name}
              size="lg"
              className="h-full w-full"
            />
          ) : (
            <span aria-hidden="true">{t('child.fields.photoPlaceholder')}</span>
          )}
        </label>
        <input
          id="child-photo"
          type="file"
          accept={ALLOWED_PHOTO_MIME_TYPES.join(',')}
          onChange={handlePhotoChange}
          aria-label={t('child.fields.photoLabel')}
          aria-invalid={!!fieldErrorKeys.photo}
          aria-describedby={fieldErrorKeys.photo ? 'child-photo-error' : 'child-photo-hint'}
          disabled={isSubmitting}
          className="sr-only"
        />
        <p id="child-photo-hint" className="text-center text-xs text-muted-foreground">
          {t('child.fields.photoHint')}
        </p>
        {fieldErrorKeys.photo && (
          <div id="child-photo-error">
            <ErrorMessage message={t(fieldErrorKeys.photo)} />
          </div>
        )}
      </div>

      <Input
        id="child-name"
        label={t('child.fields.nameLabel')}
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
        error={fieldErrorKeys.name ? t(fieldErrorKeys.name) : undefined}
        disabled={isSubmitting}
      />

      <Input
        id="child-birth-date"
        label={t('child.fields.birthDateLabel')}
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
        error={fieldErrorKeys.birthDate ? t(fieldErrorKeys.birthDate) : undefined}
        disabled={isSubmitting}
      />

      <div className="flex flex-col gap-1">
        <Select
          id="child-sex"
          label={t('child.fields.sexLabel')}
          value={sex}
          disabled={isSubmitting}
          onValueChange={setSex}
        >
          <Select.Item value={SEX_NOT_SPECIFIED_OPTION}>
            {t('child.fields.sexOptionNotSpecified')}
          </Select.Item>
          <Select.Item value="FEMALE">{t('child.fields.sexOptionFemale')}</Select.Item>
          <Select.Item value="MALE">{t('child.fields.sexOptionMale')}</Select.Item>
        </Select>
        <p className="text-xs text-muted-foreground">{t('child.fields.sexHint')}</p>
      </div>

      {formErrorKey && <ErrorMessage message={t(formErrorKey)} />}

      <Button type="submit" variant="primary" className="self-start" disabled={isSubmitting}>
        {t(submitButtonTextKey)}
      </Button>
    </form>
  );
}
