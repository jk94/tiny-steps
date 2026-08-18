import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ErrorMessage } from './ErrorMessage';
import { Button, Input } from './ui';
import { mapAuthError, type AuthErrorKey } from '../auth/mapAuthError';

// Practical email-format check, not full RFC 5322 — good enough to catch
// obvious typos before hitting the backend's `@IsEmail()` validation.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mirrors the backend's `@MinLength(8)` on the password field (see
// `apps/backend/src/auth/dto/register.dto.ts`/`login.dto.ts`).
const MIN_PASSWORD_LENGTH = 8;

// Mirrors the backend's `@MaxLength(120)` on the name field (see
// `apps/backend/src/auth/dto/register.dto.ts`).
const MAX_NAME_LENGTH = 120;

type FieldErrorKeys = {
  email?: 'auth.validation.emailInvalid';
  password?: 'auth.validation.passwordTooShort';
  name?: 'auth.validation.nameRequired' | 'auth.validation.nameTooLong';
};

export interface AuthFormProps {
  mode: 'login' | 'register';
  /** `name` is only collected (and thus only passed) in register mode. */
  onSubmit: (email: string, password: string, name?: string) => Promise<void>;
}

export function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const { t } = useTranslation();
  const isRegisterMode = mode === 'register';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [fieldErrorKeys, setFieldErrorKeys] = useState<FieldErrorKeys>({});
  const [formErrorKey, setFormErrorKey] = useState<AuthErrorKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Trimmed before both validating and submitting, so a whitespace-only
    // name can't slip past the backend's `@IsNotEmpty()` (which doesn't trim).
    const trimmedName = name.trim();

    const nextFieldErrorKeys: FieldErrorKeys = {};
    if (!EMAIL_PATTERN.test(email)) {
      nextFieldErrorKeys.email = 'auth.validation.emailInvalid';
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      nextFieldErrorKeys.password = 'auth.validation.passwordTooShort';
    }
    if (isRegisterMode && trimmedName.length === 0) {
      nextFieldErrorKeys.name = 'auth.validation.nameRequired';
    } else if (isRegisterMode && trimmedName.length > MAX_NAME_LENGTH) {
      nextFieldErrorKeys.name = 'auth.validation.nameTooLong';
    }
    if (nextFieldErrorKeys.email || nextFieldErrorKeys.password || nextFieldErrorKeys.name) {
      setFieldErrorKeys(nextFieldErrorKeys);
      // A fresh validation attempt supersedes any stale server-side error
      // from a prior submit (e.g. a 401 "invalid credentials" message).
      setFormErrorKey(null);
      return;
    }

    setFieldErrorKeys({});
    setFormErrorKey(null);
    setIsSubmitting(true);
    try {
      await onSubmit(email, password, isRegisterMode ? trimmedName : undefined);
      // No `finally`-reset here — a successful submit navigates away, so
      // resetting `isSubmitting` right before unmount would be pure churn.
    } catch (err) {
      setFormErrorKey(mapAuthError(err, mode));
      setIsSubmitting(false);
    }
  };

  const submitButtonTextKey = !isRegisterMode
    ? isSubmitting
      ? 'auth.login.submitButtonPending'
      : 'auth.login.submitButton'
    : isSubmitting
      ? 'auth.register.submitButtonPending'
      : 'auth.register.submitButton';

  return (
    <form
      className="flex w-full flex-col gap-4"
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
    >
      {isRegisterMode && (
        <Input
          id="name"
          label={t('auth.fields.nameLabel')}
          type="text"
          required
          autoComplete="name"
          maxLength={MAX_NAME_LENGTH}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            // Clear this field's error the moment the user starts correcting
            // it, rather than leaving a stale message until the next submit.
            if (fieldErrorKeys.name) {
              setFieldErrorKeys((prev) => ({ ...prev, name: undefined }));
            }
          }}
          error={fieldErrorKeys.name ? t(fieldErrorKeys.name) : undefined}
          disabled={isSubmitting}
        />
      )}

      <Input
        id="email"
        label={t('auth.fields.emailLabel')}
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          // Clear this field's error the moment the user starts correcting
          // it, rather than leaving a stale message until the next submit.
          if (fieldErrorKeys.email) {
            setFieldErrorKeys((prev) => ({ ...prev, email: undefined }));
          }
        }}
        error={fieldErrorKeys.email ? t(fieldErrorKeys.email) : undefined}
        disabled={isSubmitting}
      />

      <Input
        id="password"
        label={t('auth.fields.passwordLabel')}
        type="password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          // Clear this field's error the moment the user starts correcting
          // it, rather than leaving a stale message until the next submit.
          if (fieldErrorKeys.password) {
            setFieldErrorKeys((prev) => ({ ...prev, password: undefined }));
          }
        }}
        error={fieldErrorKeys.password ? t(fieldErrorKeys.password) : undefined}
        disabled={isSubmitting}
      />

      {formErrorKey && <ErrorMessage message={t(formErrorKey)} />}

      <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
        {t(submitButtonTextKey)}
      </Button>

      <p className="text-center text-sm">
        {isRegisterMode ? (
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t('auth.register.switchModeLink')}
          </Link>
        ) : (
          <Link to="/register" className="font-medium text-primary hover:underline">
            {t('auth.login.switchModeLink')}
          </Link>
        )}
      </p>
    </form>
  );
}
