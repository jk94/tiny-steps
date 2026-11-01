import type { ComponentType } from 'react';
import type { ParseKeys } from 'i18next';
import { Baby, Footprints, MessageCircle, Smile, type LucideIcon } from 'lucide-react';
import type { MilestoneCategory } from '../api/milestone-api';
import {
  FootprintsIllustration,
  HeartsIllustration,
  MilestoneIllustration,
  SpeechIllustration,
  ToothIllustration,
  type IllustrationProps,
} from '../components/illustrations';
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
  /** Drawn on a milestone tile's cover when the milestone has no photo. */
  Illustration: ComponentType<IllustrationProps>;
  /** Soft category-tinted surface behind that illustration (literal for Tailwind). */
  coverTint: string;
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
    Illustration: FootprintsIllustration,
    coverTint: 'bg-milestone-motor/15',
  },
  LANGUAGE: {
    colorVar: '--color-milestone-language',
    Icon: MessageCircle,
    labelKey: 'milestone.categories.language',
    badgeVariant: 'milestone-language',
    Illustration: SpeechIllustration,
    coverTint: 'bg-milestone-language/15',
  },
  SOCIAL: {
    colorVar: '--color-milestone-social',
    Icon: Smile,
    labelKey: 'milestone.categories.social',
    badgeVariant: 'milestone-social',
    Illustration: HeartsIllustration,
    coverTint: 'bg-milestone-social/20',
  },
  PHYSICAL: {
    colorVar: '--color-milestone-physical',
    Icon: Baby,
    labelKey: 'milestone.categories.physical',
    badgeVariant: 'milestone-physical',
    Illustration: ToothIllustration,
    coverTint: 'bg-milestone-physical/15',
  },
};

/** Cover art for a milestone without a category (a free entry left uncategorised). */
export const UNCATEGORISED_MILESTONE_COVER = {
  Illustration: MilestoneIllustration,
  coverTint: 'bg-milestone/15',
};

/**
 * Stable render order for anywhere the four categories are enumerated — the
 * free-entry category `Select` and the catalog grouping. (There is deliberately
 * no category filter on the timeline.)
 */
export const MILESTONE_CATEGORIES: MilestoneCategory[] = [
  'MOTOR',
  'LANGUAGE',
  'SOCIAL',
  'PHYSICAL',
];
