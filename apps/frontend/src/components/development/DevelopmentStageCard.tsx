import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { developmentEntryFor } from '../../development/developmentContent';
import { developmentStageAt } from '../../development/developmentStage';
import { developmentStageLabel } from '../../development/developmentStageLabel';
import { useDevelopmentContent } from '../../development/useDevelopmentContent';
import { Badge, Card, Skeleton } from '../ui';

export interface DevelopmentStageCardProps {
  householdId: string;
  childId: string;
  birthDate: string;
  /** The page's single `mountedAt` capture, so the card agrees with the age shown above it. */
  now: Date;
}

/**
 * The "Entwicklung" tile on `ChildHome`: what is typical for the child's
 * current week (first year) or month (up to the third birthday), as a title
 * and a one- or two-sentence teaser. The whole card is the link to the detail
 * screen.
 *
 * Mirrors the other summary cards' failure posture: if the content chunk
 * cannot be loaded, the card renders nothing rather than an error — the child
 * overview must not turn into an error page over one optional card. Past the
 * third birthday it switches to a short closing note that still lets the
 * calendar be browsed.
 */
export function DevelopmentStageCard({
  householdId,
  childId,
  birthDate,
  now,
}: DevelopmentStageCardProps) {
  const { t } = useTranslation();
  const contentQuery = useDevelopmentContent();
  const stage = developmentStageAt(birthDate, now);
  const developmentPath = `/households/${householdId}/children/${childId}/development`;

  const heading = (
    <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
      {t('development.card.title')}
    </h2>
  );

  if (stage === null) {
    return (
      <Card>
        <Card.Body className="flex flex-col gap-2">
          {heading}
          <p className="font-medium text-foreground">{t('development.card.beyondTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('development.card.beyondText')}</p>
          <Link to={developmentPath} className="text-sm font-medium text-primary hover:underline">
            {t('development.card.beyondLink')}
          </Link>
        </Card.Body>
      </Card>
    );
  }

  if (contentQuery.isLoading) {
    return (
      <Card>
        <Card.Body className="flex flex-col gap-2" aria-hidden="true">
          <Skeleton shape="text" className="h-4 w-24" />
          <Skeleton shape="text" className="h-5 w-48" />
          <Skeleton shape="text" className="h-4 w-full" />
        </Card.Body>
      </Card>
    );
  }

  const entry = contentQuery.data ? developmentEntryFor(contentQuery.data, stage) : undefined;
  if (!entry) {
    return null;
  }

  return (
    <Link
      to={developmentPath}
      className="group block rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <Card className="transition-colors group-hover:border-primary">
        <Card.Body className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {heading}
            <Badge size="sm">{developmentStageLabel(t, stage)}</Badge>
          </div>
          <p className="font-medium text-foreground">{entry.title}</p>
          <p className="text-sm text-muted-foreground">{entry.teaser}</p>
          <span className="text-sm font-medium text-primary group-hover:underline">
            {t('development.card.readMore')}
          </span>
        </Card.Body>
      </Card>
    </Link>
  );
}
