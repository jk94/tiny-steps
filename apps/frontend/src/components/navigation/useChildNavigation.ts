import type { LucideIcon } from 'lucide-react';
import { CalendarDays, House, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CHILD_AREAS, childPath, type ChildArea, type ChildAreaKey } from '../../lib/childAreas';

export interface ChildNavLink {
  key: string;
  to: string;
  label: string;
  Icon: LucideIcon;
  isActive: boolean;
  /** Present for the per-area links, which carry an area color. */
  area?: ChildArea;
}

export interface ChildNavigation {
  overview: ChildNavLink;
  timeline: ChildNavLink;
  settings: ChildNavLink;
  /** Every area link, keyed for the places that pick a subset. */
  areas: Record<ChildAreaKey, ChildNavLink>;
  /** Whether the current route lives behind the mobile "more" tab. */
  isInMoreSection: boolean;
}

/** Areas the mobile bottom bar does not list directly; reached via "more". */
export const MORE_AREA_KEYS: ChildAreaKey[] = [
  'feeding',
  'sleep',
  'diaper',
  'growth',
  'health',
  'development',
];

/**
 * Every per-child navigation target with its active state, shared by the
 * mobile bottom bar, the "more" sheet and the desktop sidebar so the three
 * can't disagree about labels, icons, routes or what counts as active.
 *
 * Active matching is by path prefix, so sub-routes (`…/growth/new`,
 * `…/milestones/:id/edit`) keep their area highlighted.
 */
export function useChildNavigation(
  householdId: string,
  childId: string,
  pathname: string,
): ChildNavigation {
  const { t } = useTranslation();
  const base = childPath(householdId, childId);
  const startsWith = (sub: string) =>
    pathname === `${base}/${sub}` || pathname.startsWith(`${base}/${sub}/`);

  const areas = Object.fromEntries(
    Object.values(CHILD_AREAS).map((area) => [
      area.key,
      {
        key: area.key,
        to: `${base}/${area.segment}`,
        label: t(area.labelKey),
        Icon: area.Icon,
        isActive: startsWith(area.segment),
        area,
      } satisfies ChildNavLink,
    ]),
  ) as Record<ChildAreaKey, ChildNavLink>;

  const settings: ChildNavLink = {
    key: 'settings',
    to: `${base}/settings`,
    label: t('nav.settingsLink'),
    Icon: Settings,
    isActive: startsWith('settings'),
  };

  return {
    overview: {
      key: 'overview',
      to: base,
      label: t('nav.child.overview'),
      Icon: House,
      isActive: pathname === base || pathname === `${base}/`,
    },
    timeline: {
      key: 'timeline',
      to: `${base}/timeline`,
      label: t('nav.child.timeline'),
      Icon: CalendarDays,
      isActive: startsWith('timeline'),
    },
    settings,
    areas,
    isInMoreSection: settings.isActive || MORE_AREA_KEYS.some((key) => areas[key].isActive),
  };
}
