import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  deleteAlexaLink,
  fetchAlexaLinks,
  updateAlexaLinkDefaultChild,
  type AlexaChildOption,
  type AlexaLink,
} from '../api/alexa-api';
import { childOptionLabel, NO_DEFAULT_CHILD } from '../alexa/childOptionLabel';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorMessage } from './ErrorMessage';
import { Button, Card, Select } from './ui';

const ALEXA_LINKS_QUERY_KEY = ['alexa', 'links'] as const;

/**
 * The profile page's "Alexa" section (ALX-12): the user's linked Amazon
 * accounts, the default child per link, and unlinking.
 *
 * Renders nothing at all while loading or when the instance has no `alexa`
 * section in `config.yml` (ALX-15) — an instance without Alexa should not
 * mention it.
 */
export function AlexaSettingsCard({ className }: { className?: string }) {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ALEXA_LINKS_QUERY_KEY, queryFn: fetchAlexaLinks });

  if (query.isLoading) {
    return null;
  }
  if (query.isError) {
    return (
      <Card className={className}>
        <Card.Body>
          <ErrorMessage message={t('alexa.settings.loadError')} />
        </Card.Body>
      </Card>
    );
  }
  if (!query.data?.enabled) {
    return null;
  }

  const { links, children } = query.data;

  return (
    <Card className={className}>
      <Card.Body className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-foreground">{t('alexa.settings.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('alexa.settings.description')}</p>
        {links.length === 0 ? (
          <p className="text-sm text-foreground">{t('alexa.settings.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {links.map((link) => (
              <AlexaLinkRow key={link.id} link={link} childOptions={children} />
            ))}
          </ul>
        )}
      </Card.Body>
    </Card>
  );
}

function AlexaLinkRow({
  link,
  childOptions,
}: {
  link: AlexaLink;
  childOptions: readonly AlexaChildOption[];
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { dateStyle: 'medium' });

  const update = useMutation({
    mutationFn: (childId: string | null) => updateAlexaLinkDefaultChild(link.id, childId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ALEXA_LINKS_QUERY_KEY }),
  });
  const unlink = useMutation({
    mutationFn: () => deleteAlexaLink(link.id),
    onSuccess: async () => {
      setIsConfirmOpen(false);
      await queryClient.invalidateQueries({ queryKey: ALEXA_LINKS_QUERY_KEY });
    },
  });

  // Optimistic display of the pending choice, so the select doesn't jump back
  // while the PATCH is in flight.
  const selected = update.isPending
    ? (update.variables ?? NO_DEFAULT_CHILD)
    : (link.defaultChildId ?? NO_DEFAULT_CHILD);

  return (
    <li className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">
          {t('alexa.settings.linkHeading', { date: formatDate(link.createdAt) })}
        </p>
        <p className="text-xs text-muted-foreground">
          {link.lastUsedAt
            ? t('alexa.settings.lastUsed', { date: formatDate(link.lastUsedAt) })
            : t('alexa.settings.neverUsed')}
        </p>
      </div>

      {childOptions.length > 0 && (
        <Select
          label={t('alexa.settings.defaultChildLabel')}
          value={selected}
          disabled={update.isPending}
          onValueChange={(value) => update.mutate(value === NO_DEFAULT_CHILD ? null : value)}
        >
          <Select.Item value={NO_DEFAULT_CHILD}>{t('alexa.settings.defaultChildNone')}</Select.Item>
          {childOptions.map((child) => (
            <Select.Item key={child.id} value={child.id}>
              {childOptionLabel(child, childOptions)}
            </Select.Item>
          ))}
        </Select>
      )}
      {update.isSuccess && (
        <p role="status" className="text-sm text-success">
          {t('alexa.settings.defaultChildSaved')}
        </p>
      )}
      {update.isError && <ErrorMessage message={t('alexa.settings.saveError')} />}

      <div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsConfirmOpen(true)}>
          {t('alexa.settings.unlinkButton')}
        </Button>
      </div>
      {unlink.isError && <ErrorMessage message={t('alexa.settings.unlinkError')} />}

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={t('alexa.settings.unlinkConfirmTitle')}
        description={t('alexa.settings.unlinkConfirmDescription')}
        confirmLabel={t('alexa.settings.unlinkConfirm')}
        cancelLabel={t('alexa.settings.unlinkCancel')}
        onConfirm={() => unlink.mutate()}
        onCancel={() => setIsConfirmOpen(false)}
        isConfirming={unlink.isPending}
      />
    </li>
  );
}
