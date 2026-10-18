import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { fetchChild } from '../api/child-api';
import { mapChildError } from '../child/mapChildError';
import { ErrorMessage } from '../components/ErrorMessage';
import { Badge, Card, Skeleton } from '../components/ui';
import { developmentEntryFor, toDevelopmentLocale } from '../development/developmentContent';
import { DEVELOPMENT_STAGE_MILESTONES } from '../development/developmentMilestones';
import { DEVELOPMENT_SOURCES } from '../development/developmentSources';
import {
  ALL_DEVELOPMENT_STAGES,
  adjacentStages,
  developmentStageAt,
  developmentStageKey,
  isSameStage,
  parseDevelopmentStageKey,
} from '../development/developmentStage';
import { developmentStageLabel } from '../development/developmentStageLabel';
import { useDevelopmentContent } from '../development/useDevelopmentContent';
import { useHouseholdRole } from '../household/useHouseholdRole';
import { canWrite, ENTRY_WRITE_ROLES } from '../lib/householdPermissions';
import { milestoneTemplateLabelKey } from '../lib/milestoneCatalog';

const LAST_STAGE = ALL_DEVELOPMENT_STAGES[ALL_DEVELOPMENT_STAGES.length - 1];

/**
 * The development calendar's detail screen: the full text for one week or
 * month of life, everyday ideas, links to the sources, and paging through the
 * whole calendar.
 *
 * Without a `:stageKey` it shows the child's *current* stage — that is what
 * the dashboard card links to, so a bookmark keeps following the child as it
 * grows. With one (`week-12`, `month-18`) it shows that stage, which is how
 * the previous/next links page through the calendar. Past the third birthday
 * the key-less view falls back to the last stage with a closing note.
 *
 * Static content only, so — like the milestone catalog — every role may read
 * it; the one write-adjacent element (the shortcut into the milestone create
 * form) is gated on the same role check the milestone screens use.
 */
export function DevelopmentDetail() {
  const { t, i18n } = useTranslation();
  const { householdId, childId, stageKey } = useParams<{
    householdId: string;
    childId: string;
    stageKey?: string;
  }>();
  const { role } = useHouseholdRole(householdId);
  // Captured once, as on `ChildHome`: a page left open across midnight should
  // not silently swap the text under the reader.
  const [mountedAt] = useState(() => new Date());

  // Paging only swaps `:stageKey`, so this component stays mounted — and the
  // paging links sit at the bottom. Without this, every next stage would open
  // scrolled to its end.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [stageKey]);

  const childQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId],
    queryFn: () => fetchChild(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });
  const contentQuery = useDevelopmentContent();

  if (childQuery.isLoading || contentQuery.isLoading) {
    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-4" aria-hidden="true">
        <Skeleton shape="text" className="h-4 w-32" />
        <Skeleton shape="text" className="h-7 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </section>
    );
  }

  if (childQuery.error || !childQuery.data) {
    return <ErrorMessage message={t(mapChildError(childQuery.error))} />;
  }

  const child = childQuery.data;
  const childHomePath = `/households/${householdId}/children/${childId}`;
  const developmentPath = `${childHomePath}/development`;
  const backLink = (
    <Link to={childHomePath} className="text-sm font-medium text-primary hover:underline">
      {t('development.detail.backLink')}
    </Link>
  );

  if (contentQuery.error || !contentQuery.data) {
    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div>{backLink}</div>
        <ErrorMessage message={t('development.detail.loadFailed')} />
      </section>
    );
  }

  const currentStage = developmentStageAt(child.birthDate, mountedAt);
  const stage = stageKey ? parseDevelopmentStageKey(stageKey) : (currentStage ?? LAST_STAGE);
  const entry = stage ? developmentEntryFor(contentQuery.data, stage) : undefined;

  if (!stage || !entry) {
    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div>{backLink}</div>
        <ErrorMessage message={t('development.detail.notFound')} />
      </section>
    );
  }

  const isCurrent = currentStage !== null && isSameStage(currentStage, stage);
  const { previous, next } = adjacentStages(stage);
  const milestoneKeys = canWrite(role, ENTRY_WRITE_ROLES)
    ? (DEVELOPMENT_STAGE_MILESTONES[developmentStageKey(stage)] ?? [])
    : [];
  const uiLocale = toDevelopmentLocale(i18n.resolvedLanguage ?? i18n.language);

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        {backLink}
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          {developmentStageLabel(t, stage)}
          {stage.kind === 'month' &&
            ` · ${t('development.stage.monthAge', { count: stage.number - 1 })}`}
        </p>
        <h1 className="text-xl font-bold text-foreground">{entry.title}</h1>
        {isCurrent && (
          <Badge variant="success" size="sm" className="self-start">
            {t('development.detail.currentHint', { name: child.name })}
          </Badge>
        )}
      </div>

      {currentStage === null && !stageKey && (
        <p className="text-sm text-muted-foreground">
          {t('development.detail.beyondNotice', { name: child.name })}
        </p>
      )}

      <Card>
        <Card.Body className="flex flex-col gap-3">
          {entry.body.map((paragraph) => (
            <p key={paragraph} className="text-foreground">
              {paragraph}
            </p>
          ))}
        </Card.Body>
      </Card>

      <Card>
        <Card.Body className="flex flex-col gap-2">
          <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            {t('development.detail.tipsTitle')}
          </h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
            {entry.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </Card.Body>
      </Card>

      {milestoneKeys.length > 0 && (
        <Card>
          <Card.Body className="flex flex-col gap-2">
            <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
              {t('development.detail.milestonesTitle')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('development.detail.milestonesText')}
            </p>
            <ul className="flex flex-col gap-1">
              {milestoneKeys.map((key) => (
                <li key={key}>
                  <Link
                    to={`${childHomePath}/milestones/new?templateKey=${key}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {t(milestoneTemplateLabelKey(key))}
                  </Link>
                </li>
              ))}
            </ul>
          </Card.Body>
        </Card>
      )}

      <Card>
        <Card.Body className="flex flex-col gap-2">
          <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            {t('development.detail.sourcesTitle')}
          </h2>
          <ul className="flex flex-col gap-2">
            {entry.sources.map((sourceId) => {
              const source = DEVELOPMENT_SOURCES[sourceId];
              return (
                <li key={sourceId} className="flex flex-col">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {source.title}
                    <span className="sr-only"> {t('development.detail.opensInNewTab')}</span>
                  </a>
                  <span className="text-xs text-muted-foreground">
                    {source.publisher}
                    {source.language !== uiLocale &&
                      ` · ${
                        source.language === 'en'
                          ? t('development.detail.sourceLanguage.en')
                          : t('development.detail.sourceLanguage.de')
                      }`}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card.Body>
      </Card>

      <aside className="flex flex-col gap-2 rounded-lg border border-border p-4 text-sm text-muted-foreground">
        <h2 className="font-semibold text-foreground">{t('development.detail.disclaimerTitle')}</h2>
        <p>{t('development.detail.disclaimer')}</p>
        <p>{t('development.detail.prematureHint')}</p>
      </aside>

      <nav
        aria-label={t('development.detail.navLabel')}
        className="flex flex-wrap items-center justify-between gap-3 text-sm font-medium"
      >
        {previous ? (
          <Link
            to={`${developmentPath}/${developmentStageKey(previous)}`}
            className="text-primary hover:underline"
          >
            {t('development.detail.previous', { label: developmentStageLabel(t, previous) })}
          </Link>
        ) : (
          <span />
        )}
        {!isCurrent && currentStage !== null && (
          <Link to={developmentPath} className="text-primary hover:underline">
            {t('development.detail.toCurrent', { name: child.name })}
          </Link>
        )}
        {next ? (
          <Link
            to={`${developmentPath}/${developmentStageKey(next)}`}
            className="text-primary hover:underline"
          >
            {t('development.detail.next', { label: developmentStageLabel(t, next) })}
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </section>
  );
}
