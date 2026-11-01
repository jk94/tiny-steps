import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, type Location } from 'react-router';
import { AuthForm } from '../components/AuthForm';
import { OidcProviderButtons } from '../components/OidcProviderButtons';
import { toReturnToPath } from '../auth/returnToPath';
import { AuthShell } from '../components/AuthShell';
import { useAuth } from '../auth/useAuth';

export function Register() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location } | null)?.from;

  const handleSubmit = async (email: string, password: string, name?: string) => {
    // Registration auto-logs-in (backend sets the same auth cookies as
    // login), so the redirect behaviour mirrors Login exactly. `name` is
    // always present here — `AuthForm` collects and validates it in register
    // mode — the `?? ''` just satisfies the shared, mode-agnostic signature.
    await register(email, password, name ?? '');
    navigate(from ?? '/', { replace: true });
  };

  return (
    <AuthShell title={t('auth.register.title')}>
      <OidcProviderButtons returnTo={toReturnToPath(from)} />
      <AuthForm mode="register" onSubmit={handleSubmit} />
    </AuthShell>
  );
}
