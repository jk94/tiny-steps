import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { fetchChild } from '../api/child-api';
import { fetchEventStats } from '../api/event-api';
import { mapChildError } from '../child/mapChildError';
import { ChildPhoto } from '../components/ChildPhoto';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { TimeSinceBadgeCard } from '../components/TimeSinceBadgeCard';
import { Card } from '../components/ui';
import { ageInMonths } from '../lib/childAge';
import { getLocalDayBoundaries } from '../lib/dayBoundaries';
import { useHouseholdRoom } from '../realtime/useHouseholdRoom';

// Where the greeting flips over. A judgment call rather than anything
// standardized: before noon is "morning", noon until 18:00 is "afternoon",
// and the rest of the day is "evening".
const AFTERNOON_START_HOUR = 12;
const EVENING_START_HOUR = 18;

/**
 * The greeting matching the browser's local time of day. Reads `now`'s local
 * hour directly (same convention as `dayBoundaries.ts`) — no timezone service,
 * no UTC arithmetic; "evening" means evening where the user is sitting.
 *
 * A `switch`-style chain calling `t()` with a literal key per branch rather
 * than a lookup table, for the reason spelled out on `timeSinceTitle`.
 */
function greetingFor(t: TFunction, now: Date): string {
  const hour = now.getHours();

  if (hour < AFTERNOON_START_HOUR) {
    return t('child.home.greetingMorning');
  }
  if (hour < EVENING_START_HOUR) {
    return t('child.home.greetingAfternoon');
  }
  return t('child.home.greetingEvening');
}

/**
 * Per-child home/dashboard — the landing screen after drilling into a
 * household and picking a child (`ChildList` links here). Shows who you're
 * looking at (photo, name, age) and how long ago each of the three tracked
 * event types last happened, then hands off to the daily timeline for detail.
 *
 * Deliberately not the app's `/` route: that stays the generic post-login
 * welcome page, since there is no global "current child" concept.
 *
 * The greeting and the stats day-range are both computed once via lazy
 * `useState` initializers rather than on every render — the same reasoning as
 * `DailyTimeline`: a page mounted across a boundary (noon, or local midnight)
 * should not silently reshuffle itself mid-session.
 */
export function ChildHome() {
  const { t } = useTranslation();
  const { householdId, childId } = useParams<{ householdId: string; childId: string }>();
  useHouseholdRoom(householdId);

  const [dayBoundaries] = useState(() => getLocalDayBoundaries());
  const [mountedAt] = useState(() => new Date());

  const childQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId],
    queryFn: () => fetchChild(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  // The `from`/`to` range only exists to satisfy the endpoint's contract: the
  // `lastEventAt` figures this page renders are "most recent ever" per type,
  // not scoped to the range (see `EventStatsSummary`'s doc comment).
  const statsQuery = useQuery({
    queryKey: [
      'households',
      householdId,
      'children',
      childId,
      'events',
      'stats',
      dayBoundaries.dateKey,
    ],
    queryFn: () => fetchEventStats(householdId!, childId!, dayBoundaries.from, dayBoundaries.to),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  if (childQuery.isLoading) {
    return <LoadingIndicator />;
  }

  if (childQuery.error || !childQuery.data) {
    return <ErrorMessage message={t(mapChildError(childQuery.error))} />;
  }

  const child = childQuery.data;
  // Supplementary to the child card, exactly like `DailyStatsSummary`: while
  // the stats are loading or after they fail, the cards render their
  // "no entries" state rather than blocking or duplicating an error UI.
  const lastEventAt = statsQuery.data?.lastEventAt;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-bold text-foreground">{greetingFor(t, mountedAt)}</h1>

      <Card>
        <Card.Body className="flex items-center gap-3">
          <ChildPhoto
            childId={child.id}
            householdId={householdId!}
            hasPhoto={child.hasPhoto}
            name={child.name}
            size="md"
            aria-hidden="true"
          />
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold text-foreground">{child.name}</h2>
            <p className="text-sm text-muted-foreground">
              {t('child.home.ageMonths', { count: ageInMonths(child.birthDate, mountedAt) })}
            </p>
          </div>
        </Card.Body>
      </Card>

      <div className="flex flex-col gap-2">
        <TimeSinceBadgeCard eventType="FEEDING" lastEventAt={lastEventAt?.FEEDING ?? null} />
        <TimeSinceBadgeCard eventType="SLEEP" lastEventAt={lastEventAt?.SLEEP ?? null} />
        <TimeSinceBadgeCard eventType="DIAPER" lastEventAt={lastEventAt?.DIAPER ?? null} />
      </div>

      <Link
        to={`/households/${householdId}/children/${childId}/timeline`}
        className="text-sm font-medium text-primary hover:underline"
      >
        {t('child.home.timelineLink')}
      </Link>
    </section>
  );
}
