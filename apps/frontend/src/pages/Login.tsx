import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams, type Location } from 'react-router';
import { AuthForm } from '../components/AuthForm';
import { ErrorMessage } from '../components/ErrorMessage';
import { OidcProviderButtons } from '../components/OidcProviderButtons';
import { Card } from '../components/ui';
import { useAuth } from '../auth/useAuth';
import { mapOidcError, type OidcErrorKey } from '../auth/mapOidcError';

export function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location } | null)?.from;
  const [searchParams, setSearchParams] = useSearchParams();
  // Lazy initializer: capture the mapped error from the *initial* URL once,
  // so it survives the param being stripped by the effect below (and a
  // later refresh doesn't re-show it, since the param is gone by then).
  const [oidcErrorKey] = useState<OidcErrorKey | null>(() =>
    mapOidcError(searchParams.get('oidc_error')),
  );

  useEffect(() => {
    // Mount-only cleanup: strip `oidc_error` from the URL so a page refresh
    // doesn't re-trigger the error banner via the lazy initializer above.
    if (searchParams.has('oidc_error')) {
      searchParams.delete('oidc_error');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (email: string, password: string) => {
    await login(email, password);
    navigate(from ?? '/', { replace: true });
  };

  return (
    <section className="mx-auto flex w-full max-w-sm flex-col items-center gap-6 py-8">
      <Card className="w-full">
        <Card.Body className="flex flex-col items-center gap-6 p-8">
          <h1 className="text-xl font-bold text-foreground">{t('auth.login.title')}</h1>
          {oidcErrorKey && <ErrorMessage message={t(oidcErrorKey)} />}
          <OidcProviderButtons />
          <AuthForm mode="login" onSubmit={handleSubmit} />
        </Card.Body>
      </Card>
    </section>
  );
}
