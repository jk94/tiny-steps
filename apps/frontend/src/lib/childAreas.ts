import type { ComponentType } from 'react';
import type { ParseKeys } from 'i18next';
import {
  Blocks,
  Droplet,
  Milk,
  Moon,
  Sparkles,
  Stethoscope,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import {
  DevelopmentIllustration,
  DiaperIllustration,
  FeedingIllustration,
  GrowthIllustration,
  HealthIllustration,
  MilestoneIllustration,
  SleepIllustration,
  type IllustrationProps,
} from '../components/illustrations';

export type ChildAreaKey =
  'feeding' | 'sleep' | 'diaper' | 'growth' | 'milestones' | 'health' | 'development';

export interface ChildArea {
  key: ChildAreaKey;
  /** Route segment below `/households/:householdId/children/:childId/`. */
  segment: string;
  // `ParseKeys` rather than `string` keeps `t(area.labelKey)` compile-checked.
  labelKey: ParseKeys;
  Icon: LucideIcon;
  Illustration: ComponentType<IllustrationProps>;
  /**
   * Tailwind classes, spelled out literally so Tailwind's scanner sees them:
   * `tint` is a soft area-colored surface, `ink` colors an icon/accent in the
   * area color, `solid` is the full color with its paired foreground.
   */
  tint: string;
  ink: string;
  solid: string;
}

/**
 * The visual identity and route of every per-child area, in one place so the
 * bottom navigation, the desktop sidebar, the "more" sheet, the quick-add sheet
 * and the area page headers can't drift apart (the same idea as
 * `eventTypeVisuals.ts` for event rows).
 *
 * Feeding/sleep/diaper reuse their event-type color tokens; the post-MVP areas
 * have their own `growth`/`milestone`/`health`/`development` tokens.
 */
export const CHILD_AREAS: Record<ChildAreaKey, ChildArea> = {
  feeding: {
    key: 'feeding',
    segment: 'feeding',
    labelKey: 'child.list.feedingLink',
    Icon: Milk,
    Illustration: FeedingIllustration,
    tint: 'bg-feeding/15',
    ink: 'text-feeding',
    solid: 'bg-feeding text-feeding-foreground',
  },
  sleep: {
    key: 'sleep',
    segment: 'sleep',
    labelKey: 'child.list.sleepLink',
    Icon: Moon,
    Illustration: SleepIllustration,
    tint: 'bg-sleep/15',
    ink: 'text-sleep',
    solid: 'bg-sleep text-sleep-foreground',
  },
  diaper: {
    key: 'diaper',
    segment: 'diaper',
    labelKey: 'child.list.diaperLink',
    Icon: Droplet,
    Illustration: DiaperIllustration,
    tint: 'bg-diaper/15',
    ink: 'text-diaper',
    solid: 'bg-diaper text-diaper-foreground',
  },
  growth: {
    key: 'growth',
    segment: 'growth',
    labelKey: 'child.list.growthLink',
    Icon: TrendingUp,
    Illustration: GrowthIllustration,
    tint: 'bg-growth/15',
    ink: 'text-growth',
    solid: 'bg-growth text-growth-foreground',
  },
  milestones: {
    key: 'milestones',
    segment: 'milestones',
    labelKey: 'child.list.milestonesLink',
    Icon: Sparkles,
    Illustration: MilestoneIllustration,
    tint: 'bg-milestone/15',
    ink: 'text-milestone',
    solid: 'bg-milestone text-milestone-foreground',
  },
  health: {
    key: 'health',
    segment: 'health',
    labelKey: 'child.list.healthLink',
    // A generic Lucide icon like every other nav entry — the two hand-drawn
    // health icons belong to the records themselves, where they distinguish
    // medication from vaccination.
    Icon: Stethoscope,
    Illustration: HealthIllustration,
    tint: 'bg-health/15',
    ink: 'text-health',
    solid: 'bg-health text-health-foreground',
  },
  development: {
    key: 'development',
    segment: 'development',
    labelKey: 'development.card.title',
    Icon: Blocks,
    Illustration: DevelopmentIllustration,
    tint: 'bg-development/15',
    ink: 'text-development',
    solid: 'bg-development text-development-foreground',
  },
};

/** Base path of one child, optionally extended by a sub-path. */
export function childPath(householdId: string, childId: string, subPath?: string): string {
  const base = `/households/${householdId}/children/${childId}`;
  return subPath ? `${base}/${subPath}` : base;
}
