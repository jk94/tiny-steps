import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { fetchActiveFeedingTimer } from '../../api/feeding-api';
import { fetchActiveSleepTimer } from '../../api/sleep-api';
import { CHILD_AREAS, childPath, type ChildAreaKey } from '../../lib/childAreas';
import { cn } from '../../lib/cn';
import { DiaperQuickEntry } from '../DiaperQuickEntry';
import { FeedingQuickEntry } from '../FeedingQuickEntry';
import { SleepQuickEntry } from '../SleepQuickEntry';
import { Sheet, toast } from '../ui';

/** Areas logged right inside the sheet, with their screens' own quick entry. */
type InlineArea = 'feeding' | 'sleep' | 'diaper';

/** Areas that need a full form; their tiles open the create route. */
const FORM_TILES: { area: ChildAreaKey; createPath: string }[] = [
  { area: 'growth', createPath: 'growth/new' },
  { area: 'milestones', createPath: 'milestones/new' },
  { area: 'health', createPath: 'health/new' },
];

export interface QuickAddFabProps {
  householdId: string;
  childId: string;
}

/**
 * The floating action button for logging something without first navigating
 * to an area. Docked into the middle of the mobile bottom bar, floating in the
 * bottom-right corner from `lg:` up.
 *
 * Its sheet puts the everyday one-tap actions *first and directly*: feeding,
 * sleep and diaper each show their screen's own quick-entry buttons (the very
 * same components, so offline buffering, validation and errors behave
 * identically). That keeps a standard event at two taps from any child screen
 * — FAB, then e.g. "Pee" — which is the PRD's tap budget (section 6) and what
 * the old per-area tab bar offered. Growth, milestones and health need more
 * than a tap, so they are illustrated tiles that open their full create form.
 *
 * A running feeding/sleep timer is not duplicated: its section points to the
 * timer's screen instead, exactly like those screens swap their quick entry
 * for the timer. Starting a timer from the sheet likewise lands on that screen,
 * where the timer is visible. Only rendered for roles allowed to log entries.
 */
export function QuickAddFab({ householdId, childId }: QuickAddFabProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={t('quickAdd.fabLabel')}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-30 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-primary),var(--color-milestone))] text-primary-foreground shadow-lg ring-4 ring-canvas transition-transform hover:scale-105 focus-visible:ring-ring focus-visible:outline-none active:scale-95 lg:right-8 lg:bottom-8 lg:left-auto lg:translate-x-0"
        style={{ viewTransitionName: 'app-fab' }}
      >
        <Plus
          aria-hidden="true"
          className={cn('h-7 w-7 transition-transform duration-300', isOpen && 'rotate-45')}
          strokeWidth={2.75}
        />
      </button>

      <Sheet isOpen={isOpen} onOpenChange={setIsOpen} side="bottom" title={t('quickAdd.title')}>
        <QuickAddContent
          householdId={householdId}
          childId={childId}
          onDone={() => setIsOpen(false)}
        />
      </Sheet>
    </>
  );
}

function QuickAddContent({
  householdId,
  childId,
  onDone,
}: {
  householdId: string;
  childId: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      {(['feeding', 'sleep', 'diaper'] as const).map((area, index) => (
        <QuickAddSection
          key={area}
          area={area}
          index={index}
          householdId={householdId}
          childId={childId}
          onDone={onDone}
        />
      ))}

      <section className="flex flex-col gap-2 border-t border-border/70 pt-4">
        <h3 className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">
          {t('quickAdd.moreEntries')}
        </h3>
        <ul className="grid grid-cols-3 gap-2">
          {FORM_TILES.map((tile, index) => {
            const area = CHILD_AREAS[tile.area];
            const label =
              tile.area === 'milestones'
                ? t('quickAdd.milestone')
                : tile.area === 'growth'
                  ? t('quickAdd.growth')
                  : t(area.labelKey);
            return (
              <li
                key={tile.area}
                className="animate-pop-in"
                style={{ animationDelay: `${120 + index * 35}ms` }}
              >
                <Link
                  to={childPath(householdId, childId, tile.createPath)}
                  onClick={onDone}
                  className={cn(
                    'flex h-full flex-col items-center gap-1 rounded-lg p-2.5 text-center text-sm font-bold text-foreground transition-transform hover:brightness-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-95',
                    area.tint,
                  )}
                >
                  <area.Illustration className="h-11 w-11" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function QuickAddSection({
  area: areaKey,
  index,
  householdId,
  childId,
  onDone,
}: {
  area: InlineArea;
  index: number;
  householdId: string;
  childId: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const area = CHILD_AREAS[areaKey];
  const areaPath = childPath(householdId, childId, area.segment);

  // Same query keys as FeedingHome/SleepHome, so this is usually a cache hit.
  const feedingTimerQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId, 'feeding-events', 'active-timer'],
    queryFn: () => fetchActiveFeedingTimer(householdId, childId),
    retry: false,
    enabled: areaKey === 'feeding',
  });
  const sleepTimerQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId, 'sleep-events', 'active-timer'],
    queryFn: () => fetchActiveSleepTimer(householdId, childId),
    retry: false,
    enabled: areaKey === 'sleep',
  });
  const timerQuery =
    areaKey === 'feeding' ? feedingTimerQuery : areaKey === 'sleep' ? sleepTimerQuery : null;

  const finishAndOpenArea = (message: string) => {
    onDone();
    toast.success(message);
    void navigate(areaPath);
  };

  const headingId = `quick-add-${areaKey}`;

  return (
    <section
      aria-labelledby={headingId}
      className="animate-pop-in flex flex-col gap-2"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-center gap-2">
        <area.Illustration className="h-9 w-9" />
        <h3 id={headingId} className="flex-1 font-extrabold text-foreground">
          {t(area.labelKey)}
        </h3>
        <Link
          to={`${areaPath}/new`}
          onClick={onDone}
          className="text-xs font-bold text-primary hover:underline"
        >
          {t('quickAdd.backfill')}
        </Link>
      </div>

      {timerQuery?.isLoading ? (
        <div className="h-14 animate-pulse rounded-md bg-muted" aria-hidden="true" />
      ) : timerQuery?.data ? (
        <div className={cn('flex flex-wrap items-center gap-3 rounded-md p-3', area.tint)}>
          <p className="flex flex-1 items-center gap-2 text-sm font-semibold text-foreground">
            <Timer aria-hidden="true" className={cn('h-5 w-5 shrink-0', area.ink)} />
            {t(
              areaKey === 'feeding'
                ? 'quickAdd.timerRunning.feeding'
                : 'quickAdd.timerRunning.sleep',
            )}
          </p>
          <Link
            to={areaPath}
            onClick={onDone}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            {t('quickAdd.openTimer')}
          </Link>
        </div>
      ) : areaKey === 'feeding' ? (
        <FeedingQuickEntry
          hideTitle
          householdId={householdId}
          childId={childId}
          onCreated={(input) => {
            if (input.feedingType === 'BREAST') {
              finishAndOpenArea(t('quickAdd.toast.breastStarted'));
            } else {
              onDone();
              toast.success(t('quickAdd.toast.feeding'));
            }
          }}
        />
      ) : areaKey === 'sleep' ? (
        <SleepQuickEntry
          hideTitle
          householdId={householdId}
          childId={childId}
          onCreated={() => finishAndOpenArea(t('quickAdd.toast.sleepStarted'))}
        />
      ) : (
        <DiaperQuickEntry
          hideTitle
          householdId={householdId}
          childId={childId}
          onCreated={() => {
            onDone();
            toast.success(t('quickAdd.toast.diaper'));
          }}
        />
      )}
    </section>
  );
}
