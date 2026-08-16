import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, type Location } from 'react-router';
import { AuthForm } from '../components/AuthForm';
import { OidcProviderButtons } from '../components/OidcProviderButtons';
import { Card } from '../components/ui';
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
    <section className="mx-auto flex w-full max-w-sm flex-col items-center gap-6 py-8">
      <Card className="w-full">
        <Card.Body className="flex flex-col items-center gap-6 p-8">
          <h1 className="text-xl font-bold text-foreground">{t('auth.register.title')}</h1>
          <OidcProviderButtons />
          <AuthForm mode="register" onSubmit={handleSubmit} />
        </Card.Body>
      </Card>
    </section>
  );
}
