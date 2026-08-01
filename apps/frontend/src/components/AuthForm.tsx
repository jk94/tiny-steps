import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ErrorMessage } from './ErrorMessage';
import { mapAuthError, type AuthErrorKey } from '../auth/mapAuthError';

// Practical email-format check, not full RFC 5322 — good enough to catch
// obvious typos before hitting the backend's `@IsEmail()` validation.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mirrors the backend's `@MinLength(8)` on the password field (see
// `apps/backend/src/auth/dto/register.dto.ts`/`login.dto.ts`).
const MIN_PASSWORD_LENGTH = 8;

type FieldErrorKeys = {
  email?: 'auth.validation.emailInvalid';
  password?: 'auth.validation.passwordTooShort';
};

export interface AuthFormProps {
  mode: 'login' | 'register';
  onSubmit: (email: string, password: string) => Promise<void>;
}

export function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrorKeys, setFieldErrorKeys] = useState<FieldErrorKeys>({});
  const [formErrorKey, setFormErrorKey] = useState<AuthErrorKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextFieldErrorKeys: FieldErrorKeys = {};
    if (!EMAIL_PATTERN.test(email)) {
      nextFieldErrorKeys.email = 'auth.validation.emailInvalid';
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      nextFieldErrorKeys.password = 'auth.validation.passwordTooShort';
    }
    if (nextFieldErrorKeys.email || nextFieldErrorKeys.password) {
      setFieldErrorKeys(nextFieldErrorKeys);
      return;
    }

    setFieldErrorKeys({});
    setFormErrorKey(null);
    setIsSubmitting(true);
    try {
      await onSubmit(email, password);
      // No `finally`-reset here — a successful submit navigates away, so
      // resetting `isSubmitting` right before unmount would be pure churn.
    } catch (err) {
      setFormErrorKey(mapAuthError(err, mode));
      setIsSubmitting(false);
    }
  };

  const submitButtonTextKey =
    mode === 'login'
      ? isSubmitting
        ? 'auth.login.submitButtonPending'
        : 'auth.login.submitButton'
      : isSubmitting
        ? 'auth.register.submitButtonPending'
        : 'auth.register.submitButton';

  return (
    <form className="auth-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
      <div className="auth-form__field">
        <label htmlFor="email">{t('auth.fields.emailLabel')}</label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={!!fieldErrorKeys.email}
          aria-describedby={fieldErrorKeys.email ? 'email-error' : undefined}
          disabled={isSubmitting}
        />
        {fieldErrorKeys.email && (
          <div id="email-error">
            <ErrorMessage message={t(fieldErrorKeys.email)} />
          </div>
        )}
      </div>

      <div className="auth-form__field">
        <label htmlFor="password">{t('auth.fields.passwordLabel')}</label>
        <input
          id="password"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={!!fieldErrorKeys.password}
          aria-describedby={fieldErrorKeys.password ? 'password-error' : undefined}
          disabled={isSubmitting}
        />
        {fieldErrorKeys.password && (
          <div id="password-error">
            <ErrorMessage message={t(fieldErrorKeys.password)} />
          </div>
        )}
      </div>

      {formErrorKey && <ErrorMessage message={t(formErrorKey)} />}

      <button type="submit" disabled={isSubmitting}>
        {t(submitButtonTextKey)}
      </button>

      {mode === 'register' ? (
        <Link to="/login">{t('auth.register.switchModeLink')}</Link>
      ) : (
        <Link to="/register">{t('auth.login.switchModeLink')}</Link>
      )}
    </form>
  );
}
