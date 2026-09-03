import type { ComponentType } from 'react';
import type { EventTypeIconProps } from '../event-types/EventTypeIconBase';
import { MedicationIcon } from './MedicationIcon';
import { VaccinationIcon } from './VaccinationIcon';

export { MedicationIcon } from './MedicationIcon';
export { VaccinationIcon } from './VaccinationIcon';

/**
 * Icons for the two health-record kinds, hand-authored in the same visual
 * language as the event-type set (they share `EventTypeIconBase`).
 *
 * They live in their own folder rather than under `event-types/`, and there is
 * deliberately **no** entry for them in
 * `design-system/tokens/event-types.json`: a medication or vaccination is not
 * an `EventType` (see ADR-0006's addendum) and is not part of the mixed daily
 * timeline. Hand-drawn rather than `lucide-react` because the roadmap asks for
 * two icons "in the style of the existing hand-drawn set" — unlike the
 * milestone categories, which are generic enough for Lucide.
 */
export const healthRecordIcons = {
  MEDICATION: MedicationIcon,
  VACCINATION: VaccinationIcon,
} as const satisfies Record<string, ComponentType<EventTypeIconProps>>;
