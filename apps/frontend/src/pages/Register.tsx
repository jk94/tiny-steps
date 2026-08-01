import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, type Location } from 'react-router';
import { AuthForm } from '../components/AuthForm';
import { OidcProviderButtons } from '../components/OidcProviderButtons';
import { useAuth } from '../auth/useAuth';

export function Register() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location } | null)?.from;

  const handleSubmit = async (email: string, password: string) => {
    // Registration auto-logs-in (backend sets the same auth cookies as
    // login), so the redirect behaviour mirrors Login exactly.
    await register(email, password);
    navigate(from ?? '/', { replace: true });
  };

  return (
    <section>
      <h1>{t('auth.register.title')}</h1>
      <OidcProviderButtons />
      <AuthForm mode="register" onSubmit={handleSubmit} />
    </section>
  );
}
