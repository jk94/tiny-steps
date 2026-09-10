import type { ComponentType } from 'react';
import type { ParseKeys } from 'i18next';
import type { HealthRecordKind } from '../api/health-record-api';
import type { BadgeVariant } from '../components/ui';
import type { EventTypeIconProps } from '../components/ui/icons/event-types/EventTypeIconBase';
import { healthRecordIcons } from '../components/ui/icons/health';

export interface HealthRecordVisual {
  Icon: ComponentType<EventTypeIconProps>;
  // Typed as `ParseKeys` rather than `string` so `t(visual.labelKey)` keeps the
  // compile-time key checking the rest of the app gets (see i18n/i18next.d.ts).
  /** i18n key of the kind's label. */
  labelKey: ParseKeys;
  /** The `Badge` variant carrying this kind's token pair. */
  badgeVariant: BadgeVariant;
}

/**
 * Icon/label lookup for the two health-record kinds, deliberately hand-written
 * and separate from `eventTypeVisuals.ts` — a medication or vaccination is not
 * an `Event` (see ADR-0006's addendum), so it has no entry in
 * `design-system/tokens/event-types.json`.
 *
 * Both kinds use the neutral `default` badge on purpose: unlike the milestone
 * categories, the kind is already carried by its own icon *and* its written
 * label, so a second colour would add no information — and the only colour that
 * should catch the eye on this screen is the overdue warning below.
 */
export const healthRecordVisuals: Record<HealthRecordKind, HealthRecordVisual> = {
  MEDICATION: {
    Icon: healthRecordIcons.MEDICATION,
    labelKey: 'health.kinds.medication',
    badgeVariant: 'default',
  },
  VACCINATION: {
    Icon: healthRecordIcons.VACCINATION,
    labelKey: 'health.kinds.vaccination',
    badgeVariant: 'default',
  },
};

/** Stable render order wherever the two kinds are enumerated (the form's tabs). */
export const HEALTH_RECORD_KINDS: HealthRecordKind[] = ['MEDICATION', 'VACCINATION'];

/**
 * The badge an overdue appointment carries (MED-6/MED-12). An existing design
 * -system variant, so Phase 7.3 adds no colour token and needs no
 * `design-tokens:build` run. `warning` rather than `destructive`: a missed
 * vaccination date is something to act on, not a failure to alarm a parent
 * about.
 */
export const OVERDUE_BADGE_VARIANT: BadgeVariant = 'warning';
