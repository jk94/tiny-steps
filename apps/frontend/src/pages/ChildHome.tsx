import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { ArrowLeft, CalendarDays, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { fetchChild, type ChildSummary } from '../api/child-api';
import { type EventStatsSummary, fetchEventStats } from '../api/event-api';
import { mapChildError } from '../child/mapChildError';
import { ChildPhoto } from '../components/ChildPhoto';
import { DevelopmentStageCard } from '../components/development/DevelopmentStageCard';
import { ErrorMessage } from '../components/ErrorMessage';
import { GrowthSummaryCard } from '../components/growth/GrowthSummaryCard';
import { MilestoneSummaryCard } from '../components/milestone/MilestoneSummaryCard';
import { HealthSummaryCard } from '../components/health/HealthSummaryCard';
import { TimeSinceBadgeCard } from '../components/TimeSinceBadgeCard';
import { TransitionLink } from '../components/TransitionLink';
import { Skeleton } from '../components/ui';
import { formatChildAge } from '../lib/childAge';
import { childPath } from '../lib/childAreas';
import { childGradientClass } from '../lib/childTheme';
import { cn } from '../lib/cn';
import { getLocalDayBoundaries } from '../lib/dayBoundaries';
import { viewTransitionStyle } from '../lib/viewTransition';
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

interface TimeSinceSectionProps {
  isLoading: boolean;
  /** The stats query's payload, or `undefined` while it is loading or after it failed. */
  lastEventAt: EventStatsSummary['lastEventAt'] | undefined;
  /** The child's base path; each tile links to its event type's screen below it. */
  basePath: string;
}

/**
 * The three "time since last <event type>" cards, rendered only once the stats
 * query has actually answered. Mirrors `DailyStatsSummary`'s posture: a
 * loading indicator while in flight, and nothing at all when the query failed —
 * this section is supplementary to the child card above, so it neither blocks
 * the page nor raises a second error UI.
 *
 * Crucially, a failed query must NOT fall through to the cards' "no entries
 * yet" state: that is a factual claim about the child's history, and it would
 * be a lie for a child that does have events but whose stats just couldn't be
 * loaded right now.
 */
function TimeSinceSection({ isLoading, lastEventAt, basePath }: TimeSinceSectionProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!lastEventAt) {
    return null;
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <TimeSinceBadgeCard
        eventType="FEEDING"
        lastEventAt={lastEventAt.FEEDING}
        to={`${basePath}/feeding`}
      />
      <TimeSinceBadgeCard
        eventType="SLEEP"
        lastEventAt={lastEventAt.SLEEP}
        to={`${basePath}/sleep`}
      />
      <TimeSinceBadgeCard
        eventType="DIAPER"
        lastEventAt={lastEventAt.DIAPER}
        to={`${basePath}/diaper`}
      />
    </div>
  );
}

interface ChildHeroProps {
  child: ChildSummary;
  householdId: string;
  greeting: string;
  ageLabel: string;
}

/**
 * The child's header: greeting, name, age and photo on the child's own
 * gradient. It shares its `view-transition-name`s with the child's tile in
 * `ChildList`, so arriving from the household the tile expands into this hero
 * (and the back link shrinks it again). Edge to edge on phones, a rounded
 * card from `sm:` up.
 */
function ChildHero({ child, householdId, greeting, ageLabel }: ChildHeroProps) {
  const { t } = useTranslation();

  return (
    <header
      className={cn(
        'relative isolate -mx-4 -mt-4 overflow-hidden rounded-b-xl px-5 pt-4 pb-6 text-white shadow-md sm:mx-0 sm:mt-0 sm:rounded-xl',
        childGradientClass(child.id),
      )}
      style={viewTransitionStyle('child', child.id)}
    >
      <span
        aria-hidden="true"
        className="absolute -top-16 -right-10 -z-10 h-48 w-48 rounded-full bg-white/10"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-20 left-1/3 -z-10 h-40 w-40 rounded-full bg-white/10"
      />
      <TransitionLink
        to={`/households/${householdId}`}
        className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
      >
        <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
        {t('child.home.backToHousehold')}
      </TransitionLink>
      <div className="mt-4 flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold text-white/85">{greeting}</h1>
          <h2 className="truncate text-3xl font-black tracking-tight">{child.name}</h2>
          <p className="mt-1 inline-flex rounded-full bg-white/20 px-3 py-0.5 text-sm font-bold">
            {ageLabel}
          </p>
        </div>
        <ChildPhoto
          childId={child.id}
          householdId={householdId}
          hasPhoto={child.hasPhoto}
          name={child.name}
          size="lg"
          illustrationFallback
          className="h-24 w-24 ring-4 ring-white/35"
          style={viewTransitionStyle('child-avatar', child.id)}
          aria-hidden="true"
        />
      </div>
    </header>
  );
}

/**
 * Per-child home/dashboard — the landing screen after drilling into a
 * household and picking a child (`ChildList` links here). Shows who you're
 * looking at (photo, name, age), what is developmentally typical right now,
 * and how long ago each of the three tracked event types last happened, then
 * hands off to the daily timeline for detail.
 *
 * Deliberately not the app's `/` route: that stays the generic post-login
 * welcome page, since there is no global "current child" concept.
 *
 * The greeting and the stats day-range are both derived once, from a single
 * `mountedAt` capture in a lazy `useState` initializer rather than on every
 * render — the same reasoning as `DailyTimeline`: a page mounted across a
 * boundary (noon, or local midnight) should not silently reshuffle itself
 * mid-session.
 */
export function ChildHome() {
  const { t } = useTranslation();
  const { householdId, childId } = useParams<{ householdId: string; childId: string }>();
  useHouseholdRoom(householdId);

  // One single `Date` capture feeds both the greeting/age and the stats
  // day-range, so they can never disagree about which day it is (two separate
  // captures could straddle local midnight).
  const [mountedAt] = useState(() => new Date());
  const [dayBoundaries] = useState(() => getLocalDayBoundaries(mountedAt));

  const queryClient = useQueryClient();
  const childQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId],
    queryFn: () => fetchChild(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
    // Coming from the household's child list, the child is already in that
    // list's cache: rendering the hero from it straight away is what lets the
    // tile→hero view transition capture a finished page instead of a skeleton.
    placeholderData: () =>
      queryClient
        .getQueryData<ChildSummary[]>(['households', householdId, 'children'])
        ?.find((candidate) => candidate.id === childId),
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
    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-5" aria-hidden="true">
        <Skeleton className="-mx-4 -mt-4 h-44 rounded-t-none rounded-b-xl sm:mx-0 sm:mt-0 sm:rounded-xl" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
        <Skeleton className="h-36 w-full rounded-lg" />
      </section>
    );
  }

  if (childQuery.error || !childQuery.data) {
    return <ErrorMessage message={t(mapChildError(childQuery.error))} />;
  }

  const child = childQuery.data;

  const basePath = childPath(householdId!, childId!);
  // Staggers the cards below the hero into view one after another.
  const stagger = (index: number) => ({ animationDelay: `${80 + index * 60}ms` });

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <ChildHero
        child={child}
        householdId={householdId!}
        greeting={greetingFor(t, mountedAt)}
        ageLabel={formatChildAge(t, child.birthDate, mountedAt)}
      />

      <div className="animate-rise-in" style={stagger(0)}>
        <TimeSinceSection
          isLoading={statsQuery.isLoading}
          lastEventAt={statsQuery.data?.lastEventAt}
          basePath={basePath}
        />
      </div>

      <div className="animate-rise-in" style={stagger(1)}>
        <DevelopmentStageCard
          householdId={householdId!}
          childId={childId!}
          birthDate={child.birthDate}
          now={mountedAt}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="animate-rise-in" style={stagger(2)}>
          <MilestoneSummaryCard householdId={householdId!} childId={childId!} />
        </div>
        <div className="animate-rise-in" style={stagger(3)}>
          <GrowthSummaryCard
            householdId={householdId!}
            childId={childId!}
            birthDate={child.birthDate}
          />
        </div>
      </div>

      <div className="animate-rise-in" style={stagger(4)}>
        <HealthSummaryCard householdId={householdId!} childId={childId!} />
      </div>

      <Link
        to={`${basePath}/timeline`}
        className="group flex items-center gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 font-bold text-foreground shadow-sm transition-colors hover:border-primary"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <CalendarDays aria-hidden="true" className="h-5 w-5" />
        </span>
        <span className="flex-1">{t('child.home.timelineLink')}</span>
        <ChevronRight
          aria-hidden="true"
          className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1"
        />
      </Link>
    </section>
  );
}
