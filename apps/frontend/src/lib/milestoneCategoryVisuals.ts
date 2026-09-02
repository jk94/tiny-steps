import type { ParseKeys } from 'i18next';
import { Baby, Footprints, MessageCircle, Smile, type LucideIcon } from 'lucide-react';
import type { MilestoneCategory } from '../api/milestone-api';
import type { BadgeVariant } from '../components/ui';

export interface MilestoneCategoryVisual {
  /** CSS custom-property name holding the category's color. */
  colorVar: string;
  Icon: LucideIcon;
  // Typed as `ParseKeys` rather than `string` so `t(visual.labelKey)` keeps the
  // compile-time key checking the rest of the app gets (see i18n/i18next.d.ts).
  /** i18n key of the category's label. */
  labelKey: ParseKeys;
  /** The `Badge` variant carrying this category's token pair. */
  badgeVariant: BadgeVariant;
}

/**
 * Color/icon/label lookup for the four milestone categories, deliberately
 * hand-written and separate from `eventTypeVisuals.ts`.
 *
 * A milestone is not an `Event` (see ADR-0006's addendum), so it has no entry
 * in `design-system/tokens/event-types.json` — extending `getEventTypeVisual`
 * would have meant either inventing fake event types or loosening its "unknown
 * key throws" contract. Generic `lucide-react` icons are enough here; the
 * hand-authored SVG set exists specifically for the event types shown in the
 * mixed daily timeline, which milestones are deliberately not part of.
 *
 * The category is decorative *and* labelled: every badge renders the
 * translated label as text, so color is never the sole carrier of meaning.
 */
export const milestoneCategoryVisuals: Record<MilestoneCategory, MilestoneCategoryVisual> = {
  MOTOR: {
    colorVar: '--color-milestone-motor',
    Icon: Footprints,
    labelKey: 'milestone.categories.motor',
    badgeVariant: 'milestone-motor',
  },
  LANGUAGE: {
    colorVar: '--color-milestone-language',
    Icon: MessageCircle,
    labelKey: 'milestone.categories.language',
    badgeVariant: 'milestone-language',
  },
  SOCIAL: {
    colorVar: '--color-milestone-social',
    Icon: Smile,
    labelKey: 'milestone.categories.social',
    badgeVariant: 'milestone-social',
  },
  PHYSICAL: {
    colorVar: '--color-milestone-physical',
    Icon: Baby,
    labelKey: 'milestone.categories.physical',
    badgeVariant: 'milestone-physical',
  },
};

/** Stable render order for the category filter/select and the catalog view. */
export const MILESTONE_CATEGORIES: MilestoneCategory[] = [
  'MOTOR',
  'LANGUAGE',
  'SOCIAL',
  'PHYSICAL',
];
