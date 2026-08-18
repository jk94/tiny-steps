import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorMessage } from './ErrorMessage';
import { Button, Input } from './ui';

// Mirrors the backend's `@MaxLength(120)` on the name field (see
// `apps/backend/src/auth/dto/update-auth-me.dto.ts`).
export const MAX_NAME_LENGTH = 120;

export interface NameFormProps {
  /** Seeds the field; the caller owns whether that's the current name or blank. */
  initialName: string;
  label: string;
  submitLabel: string;
  submitPendingLabel: string;
  /** Shown instead of the raw failure when `onSubmit` rejects. */
  errorMessage: string;
  onSubmit: (name: string) => Promise<void>;
  /** Rendered between the field and the submit button (e.g. a success notice). */
  children?: ReactNode;
}

/**
 * The single "type a display name and save it" form, shared by the profile
 * page and the blocking `MandatoryNameDialog` so their validation, trimming
 * and pending/error handling can't diverge.
 *
 * Deliberately keeps the typed value on a failed submit rather than resetting:
 * a network blip shouldn't cost the user their input, and in the dialog's case
 * there is no way out other than succeeding.
 */
export function NameForm({
  initialName,
  label,
  submitLabel,
  submitPendingLabel,
  errorMessage,
  onSubmit,
  children,
}: NameFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [fieldErrorKey, setFieldErrorKey] = useState<
    'auth.validation.nameRequired' | 'auth.validation.nameTooLong' | null
  >(null);
  const [hasFailed, setHasFailed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Trimmed before validating and submitting, so a whitespace-only name
    // can't slip past the backend's `@IsNotEmpty()` (which doesn't trim).
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      setFieldErrorKey('auth.validation.nameRequired');
      setHasFailed(false);
      return;
    }
    if (trimmedName.length > MAX_NAME_LENGTH) {
      setFieldErrorKey('auth.validation.nameTooLong');
      setHasFailed(false);
      return;
    }

    setFieldErrorKey(null);
    setHasFailed(false);
    setIsSubmitting(true);
    try {
      await onSubmit(trimmedName);
    } catch {
      setHasFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={(event) => void handleSubmit(event)}>
      <Input
        label={label}
        type="text"
        required
        autoComplete="name"
        maxLength={MAX_NAME_LENGTH}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          // Clear this field's error the moment the user starts correcting it,
          // rather than leaving a stale message until the next submit.
          if (fieldErrorKey) {
            setFieldErrorKey(null);
          }
        }}
        error={fieldErrorKey ? t(fieldErrorKey) : undefined}
        disabled={isSubmitting}
      />

      {hasFailed && <ErrorMessage message={errorMessage} />}
      {children}

      <Button type="submit" variant="primary" className="w-full" isLoading={isSubmitting}>
        {isSubmitting ? submitPendingLabel : submitLabel}
      </Button>
    </form>
  );
}
