import { useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import {
  decideAlexaAuthorization,
  describeAlexaAuthorization,
  readAlexaAuthorizationParams,
} from '../api/alexa-api';
import { childOptionLabel, NO_DEFAULT_CHILD } from '../alexa/childOptionLabel';
import { mapAlexaLinkError } from '../alexa/mapAlexaLinkError';
import { useAuth } from '../auth/useAuth';
import { ErrorMessage } from '../components/ErrorMessage';
import { Button, Card, Select } from '../components/ui';
import { navigateToExternalUrl } from '../lib/navigateToExternalUrl';

/**
 * The OAuth consent page Amazon opens during Alexa account linking (ALX-7,
 * ADR-0017) — configured as the skill's "Web Authorization URI".
 *
 * A normal `ProtectedRoute` page: a visitor without a session is sent to
 * `/login` with this location as `from`, and both local and OIDC login bring
 * them back here (the OIDC login carries it as `returnTo`). The query string
 * is relayed to the backend, which validates client and redirect URI; only
 * the backend ever builds the URL the browser is sent back to.
 */
export function AlexaLink() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const params = readAlexaAuthorizationParams(searchParams);
  const [defaultChild, setDefaultChild] = useState(NO_DEFAULT_CHILD);

  const requestQuery = useQuery({
    queryKey: ['alexa', 'authorize', searchParams.toString()],
    queryFn: () => describeAlexaAuthorization(params!),
    enabled: params !== null,
    retry: false,
  });

  const decision = useMutation({
    mutationFn: (approve: boolean) =>
      decideAlexaAuthorization(
        params!,
        approve,
        defaultChild === NO_DEFAULT_CHILD ? null : defaultChild,
      ),
    onSuccess: ({ redirectTo }) => navigateToExternalUrl(redirectTo),
  });

  const shell = (body: ReactNode, footer?: ReactNode) => (
    <section className="mx-auto w-full max-w-md py-8">
      <Card>
        <Card.Header>
          <h1 className="text-2xl font-black text-foreground">{t('alexa.link.title')}</h1>
        </Card.Header>
        <Card.Body className="flex flex-col gap-4">{body}</Card.Body>
        {footer && <Card.Footer className="flex-col items-stretch gap-2">{footer}</Card.Footer>}
      </Card>
    </section>
  );

  if (params === null) {
    return shell(<ErrorMessage message={t('alexa.link.errors.invalidRequest')} />);
  }
  if (requestQuery.isLoading) {
    return shell(<p className="text-sm text-muted-foreground">{t('alexa.link.loading')}</p>);
  }
  if (requestQuery.isError || !requestQuery.data) {
    return shell(<ErrorMessage message={t(mapAlexaLinkError(requestQuery.error))} />);
  }

  const { children } = requestQuery.data;
  // Once the backend answered with the redirect, the page is on its way out.
  const isRedirecting = decision.isSuccess;
  const isBusy = decision.isPending || isRedirecting;

  return shell(
    <>
      <p className="text-sm text-foreground">{t('alexa.link.intro')}</p>
      {user && (
        <p className="text-xs text-muted-foreground">
          {t('alexa.link.signedInAs', { email: user.email })}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{t('alexa.link.permissionsTitle')}</p>
        <ul className="list-disc ps-5 text-sm text-foreground">
          <li>{t('alexa.link.permissionRecord')}</li>
          <li>{t('alexa.link.permissionRead')}</li>
          <li>{t('alexa.link.permissionHealth')}</li>
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">{t('alexa.link.rolesNote')}</p>

      {children.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('alexa.link.noChildrenHint')}</p>
      )}
      {children.length === 1 && (
        <p className="text-sm text-muted-foreground">
          {t('alexa.link.singleChildHint', { name: children[0].name })}
        </p>
      )}
      {children.length > 1 && (
        <div className="flex flex-col gap-1">
          <Select
            label={t('alexa.link.defaultChildLabel')}
            value={defaultChild}
            onValueChange={setDefaultChild}
            disabled={isBusy}
          >
            <Select.Item value={NO_DEFAULT_CHILD}>{t('alexa.link.defaultChildNone')}</Select.Item>
            {children.map((child) => (
              <Select.Item key={child.id} value={child.id}>
                {childOptionLabel(child, children)}
              </Select.Item>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">{t('alexa.link.defaultChildHint')}</p>
        </div>
      )}

      {decision.isError && <ErrorMessage message={t(mapAlexaLinkError(decision.error))} />}
      {isRedirecting && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('alexa.link.redirecting')}
        </p>
      )}
    </>,
    <>
      <Button
        type="button"
        variant="primary"
        className="w-full"
        onClick={() => decision.mutate(true)}
        isLoading={decision.isPending && decision.variables === true}
        disabled={isBusy}
      >
        {t(
          decision.isPending && decision.variables === true
            ? 'alexa.link.approveButtonPending'
            : 'alexa.link.approveButton',
        )}
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={() => decision.mutate(false)}
        disabled={isBusy}
      >
        {t('alexa.link.denyButton')}
      </Button>
    </>,
  );
}
